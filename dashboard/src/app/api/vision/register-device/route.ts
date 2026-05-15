import { NextResponse } from "next/server"
import { jwtVerify } from "jose"
import { prisma } from "@/lib/db"
import { getVisionCorsHeaders } from "@/lib/vision-auth"

const MAX_DEVICES_PER_USER = 10

export async function OPTIONS(req: Request) {
    return NextResponse.json({}, { headers: getVisionCorsHeaders(req) })
}

export async function POST(req: Request) {
    try {
        if (!process.env.VISION_JWT_SECRET) {
            return NextResponse.json(
                { error: "Server configuration error" },
                { status: 500, headers: getVisionCorsHeaders(req) }
            )
        }

        const VISION_SECRET = new TextEncoder().encode(process.env.VISION_JWT_SECRET)

        // Require a valid Vision JWT — proves the user completed Clerk auth
        const authHeader = req.headers.get("Authorization")
        if (!authHeader?.startsWith("Bearer ")) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: getVisionCorsHeaders(req) })
        }

        const token = authHeader.substring(7)
        let payload: any
        try {
            const result = await jwtVerify(token, VISION_SECRET, {
                issuer: "pow-dashboard",
                audience: "pow-vision"
            })
            payload = result.payload
        } catch {
            return NextResponse.json({ error: "Invalid token" }, { status: 401, headers: getVisionCorsHeaders(req) })
        }

        const { deviceSecret, deviceName } = await req.json()

        if (!deviceSecret || typeof deviceSecret !== "string" || deviceSecret.length < 32) {
            return NextResponse.json({ error: "Invalid deviceSecret" }, { status: 400, headers: getVisionCorsHeaders(req) })
        }

        // Cap devices per user to prevent unbounded growth
        const activeDevices = await prisma.visionDevice.count({
            where: { userId: payload.userId as string, revokedAt: null }
        })
        if (activeDevices >= MAX_DEVICES_PER_USER) {
            return NextResponse.json(
                { error: "Device limit reached. Revoke an existing device first." },
                { status: 429, headers: getVisionCorsHeaders(req) }
            )
        }

        const device = await prisma.visionDevice.create({
            data: {
                userId: payload.userId as string,
                deviceSecret,
                deviceName: deviceName?.slice(0, 100) || null
            }
        })

        return NextResponse.json({ deviceId: device.id }, { headers: getVisionCorsHeaders(req) })
    } catch (error) {
        console.error("[Vision Register] Error:", error)
        return NextResponse.json({ error: "Internal server error" }, { status: 500, headers: getVisionCorsHeaders(req) })
    }
}
