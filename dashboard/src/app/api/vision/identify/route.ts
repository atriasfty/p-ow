import { NextResponse } from "next/server"
import { jwtVerify } from "jose"
import { verifyVisionDevice, getVisionCorsHeaders } from "@/lib/vision-auth"
import { checkSecurity } from "@/lib/security"

// Mistral API Key
const MISTRAL_API_KEY = process.env.MISTRAL_API_KEY

export async function OPTIONS(req: Request) {
    return NextResponse.json({}, { headers: getVisionCorsHeaders(req) })
}

export async function POST(req: Request) {
    try {
        // Rate-limit and IP-ban check — this route calls Mistral on every request,
        // so an unthrottled authenticated user can drain the API key budget.
        const secBlock = await checkSecurity(req)
        if (secBlock) return secBlock

        // Reject oversized bodies before reading the full payload. A base64 game
        // screenshot is typically <1 MB; 5 MB is generous but prevents runaway billing.
        const MAX_BODY = 5 * 1024 * 1024
        const contentLength = parseInt(req.headers.get("content-length") ?? "0", 10)
        if (contentLength > MAX_BODY) {
            return NextResponse.json(
                { error: "Request body too large" },
                { status: 413, headers: getVisionCorsHeaders(req) }
            )
        }

        // Validate required environment variables
        if (!process.env.VISION_JWT_SECRET) {
            console.error("[Vision Identify] VISION_JWT_SECRET is not set!")
            return NextResponse.json(
                { error: "Server configuration error" },
                { status: 500, headers: getVisionCorsHeaders(req) }
            )
        }
        if (!MISTRAL_API_KEY) {
            console.error("[Vision Identify] MISTRAL_API_KEY is not set!")
            return NextResponse.json(
                { error: "Server configuration error" },
                { status: 500, headers: getVisionCorsHeaders(req) }
            )
        }

        const VISION_SECRET = new TextEncoder().encode(process.env.VISION_JWT_SECRET)
        // 1. Verify Session Token (JWT)
        const authHeader = req.headers.get("Authorization")
        if (!authHeader?.startsWith("Bearer ")) {
            return NextResponse.json({ error: "No token provided" }, { status: 401, headers: getVisionCorsHeaders(req) })
        }

        const token = authHeader.substring(7)
        let identifyPayload: any
        try {
            const result = await jwtVerify(token, VISION_SECRET, {
                issuer: "pow-dashboard",
                audience: "pow-vision"
            })
            identifyPayload = result.payload
        } catch {
            return NextResponse.json({ error: "Invalid token" }, { status: 401, headers: getVisionCorsHeaders(req) })
        }

        // 2. Read raw body so HMAC verification covers it.
        const rawBody = await req.text()

        const validDevice = await verifyVisionDevice(
            req.headers.get("X-Vision-Sig"),
            identifyPayload.userId as string,
            req,
            rawBody
        )
        if (!validDevice) {
            return NextResponse.json(
                { error: "Unauthorized: invalid or unregistered device" },
                { status: 403, headers: getVisionCorsHeaders(req) }
            )
        }

        // 3. Get Image Data
        let body: any
        try {
            body = JSON.parse(rawBody)
        } catch {
            return NextResponse.json({ error: "Invalid JSON body" }, { status: 400, headers: getVisionCorsHeaders(req) })
        }
        const { image } = body

        if (!image) {
            return NextResponse.json({ error: "No image provided" }, { status: 400, headers: getVisionCorsHeaders(req) })
        }

        // Reject anything that isn't a base64 data URL to prevent SSRF via Mistral
        if (typeof image !== "string" || !image.startsWith("data:image/")) {
            return NextResponse.json({ error: "Invalid image format: must be a data:image/ URL" }, { status: 400, headers: getVisionCorsHeaders(req) })
        }

        // 4. Call Pixtral AI
        const response = await fetch("https://api.mistral.ai/v1/chat/completions", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${MISTRAL_API_KEY}`
            },
            body: JSON.stringify({
                model: "pixtral-large-2411",
                messages: [
                    {
                        role: "user",
                        content: [
                            {
                                type: "text",
                                text: `Identify the Roblox username in this image. 
                                Rules:
                                1. Look for text appearing directly above a character's head/avatar.
                                2. If you see a Display Name and a Username (starts with @), choose the Username (remove the @).
                                3. If there are multiple players, identify the one closest to the CENTER of the image (crosshair position).
                                4. Return ONLY the username string. Do not include explanation or headers. If no username is found, return "null".`
                            },
                            {
                                type: "image_url",
                                image_url: image // Expecting data:image/png;base64,...
                            }
                        ]
                    }
                ],
                max_tokens: 50,
                temperature: 0.1
            })
        })

        if (!response.ok) {
            const err = await response.text()
            console.error("Pixtral API Error:", err)
            return NextResponse.json({ error: "AI service error" }, { status: 502, headers: getVisionCorsHeaders(req) })
        }

        const data = await response.json()
        const content = data.choices[0]?.message?.content?.trim() || "null"
        const username = content === "null" ? null : content.replace(/^@/, '')

        return NextResponse.json({ username }, { headers: getVisionCorsHeaders(req) })

    } catch (error) {
        console.error("[Vision Identify] Error:", error)
        return NextResponse.json({ error: "Internal server error" }, { status: 500, headers: getVisionCorsHeaders(req) })
    }
}
