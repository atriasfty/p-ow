import { NextResponse } from "next/server"
import { jwtVerify } from "jose"
import { prisma } from "@/lib/db"
import { verifyVisionDevice, getVisionCorsHeaders } from "@/lib/vision-auth"
import { checkSecurity } from "@/lib/security"

// Lists the servers the requesting user is a member of, for the Vision
// app's server picker (which server to run punishments against / read the
// roster from). New route, additive — nothing else depends on it.

export async function OPTIONS(req: Request) {
    return NextResponse.json({}, { headers: getVisionCorsHeaders(req) })
}

export async function GET(req: Request) {
    try {
        const secBlock = await checkSecurity(req)
        if (secBlock) return secBlock

        if (!process.env.VISION_JWT_SECRET) {
            console.error("[Vision Servers] VISION_JWT_SECRET is not set!")
            return NextResponse.json(
                { error: "Server configuration error" },
                { status: 500, headers: getVisionCorsHeaders(req) }
            )
        }

        const VISION_SECRET = new TextEncoder().encode(process.env.VISION_JWT_SECRET)

        const authHeader = req.headers.get("Authorization")
        if (!authHeader?.startsWith("Bearer ")) {
            return NextResponse.json({ error: "No token provided" }, { status: 401, headers: getVisionCorsHeaders(req) })
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

        const validDevice = await verifyVisionDevice(
            req.headers.get("X-Vision-Sig"),
            payload.userId as string,
            req,
            ""
        )
        if (!validDevice) {
            return NextResponse.json(
                { error: "Unauthorized: invalid or unregistered device" },
                { status: 403, headers: getVisionCorsHeaders(req) }
            )
        }

        const members = await prisma.member.findMany({
            where: { userId: payload.userId as string },
            select: { serverId: true }
        })
        const serverIds = members.map((m: { serverId: string }) => m.serverId)

        const servers = await prisma.server.findMany({
            where: { id: { in: serverIds } },
            select: { id: true, name: true, customName: true }
        })

        return NextResponse.json(
            servers.map((s: { id: string; name: string; customName: string | null }) => ({
                id: s.id,
                name: s.customName || s.name
            })),
            { headers: getVisionCorsHeaders(req) }
        )
    } catch (error) {
        console.error("[Vision Servers] Error:", error)
        return NextResponse.json({ error: "Internal server error" }, { status: 500, headers: getVisionCorsHeaders(req) })
    }
}
