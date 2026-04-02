import { NextResponse } from "next/server"
import { jwtVerify } from "jose"
import { verifyVisionSignature, getVisionCorsHeaders } from "@/lib/vision-auth"

// Mistral API Key
const MISTRAL_API_KEY = process.env.MISTRAL_API_KEY

export async function OPTIONS(req: Request) {
    return NextResponse.json({}, { headers: getVisionCorsHeaders(req.headers.get("origin")) })
}

export async function POST(req: Request) {
    try {
        // Validate required environment variables
        if (!process.env.VISION_JWT_SECRET) {
            console.error("[Vision Identify] VISION_JWT_SECRET is not set!")
            return NextResponse.json(
                { error: "Server configuration error" },
                { status: 500, headers: getVisionCorsHeaders(req.headers.get("origin")) }
            )
        }
        if (!MISTRAL_API_KEY) {
            console.error("[Vision Identify] MISTRAL_API_KEY is not set!")
            return NextResponse.json(
                { error: "Server configuration error" },
                { status: 500, headers: getVisionCorsHeaders(req.headers.get("origin")) }
            )
        }

        const VISION_SECRET = new TextEncoder().encode(process.env.VISION_JWT_SECRET)
        // 1. Verify Request Signature (HMAC)
        const signature = req.headers.get("X-Vision-Sig")
        if (!verifyVisionSignature(signature)) {
            return NextResponse.json(
                { error: "Unauthorized - Invalid Signature" },
                { status: 403, headers: getVisionCorsHeaders(req.headers.get("origin")) }
            )
        }

        // 2. Verify Session Token (JWT)
        const authHeader = req.headers.get("Authorization")
        if (!authHeader?.startsWith("Bearer ")) {
            return NextResponse.json({ error: "No token provided" }, { status: 401, headers: getVisionCorsHeaders(req.headers.get("origin")) })
        }

        const token = authHeader.substring(7)
        try {
            await jwtVerify(token, VISION_SECRET, {
                issuer: "pow-dashboard",
                audience: "pow-vision"
            })
        } catch {
            return NextResponse.json({ error: "Invalid token" }, { status: 401, headers: getVisionCorsHeaders(req.headers.get("origin")) })
        }

        // 3. Get Image Data
        const body = await req.json()
        const { image } = body

        if (!image) {
            return NextResponse.json({ error: "No image provided" }, { status: 400, headers: getVisionCorsHeaders(req.headers.get("origin")) })
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
            return NextResponse.json({ error: "AI service error" }, { status: 502, headers: getVisionCorsHeaders(req.headers.get("origin")) })
        }

        const data = await response.json()
        const content = data.choices[0]?.message?.content?.trim() || "null"
        const username = content === "null" ? null : content.replace(/^@/, '')

        return NextResponse.json({ username }, { headers: getVisionCorsHeaders(req.headers.get("origin")) })

    } catch (error) {
        console.error("[Vision Identify] Error:", error)
        return NextResponse.json({ error: "Internal server error" }, { status: 500, headers: getVisionCorsHeaders(req.headers.get("origin")) })
    }
}
