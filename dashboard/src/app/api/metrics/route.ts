import { NextResponse } from "next/server"
import { register } from "@/lib/prometheus"
import crypto from "crypto"

export const dynamic = "force-dynamic"

const METRICS_SECRET = process.env.PROMETHEUS_METRICS_SECRET

export async function GET(req: Request) {
    const authHeader = req.headers.get("authorization") || ""
    const expected = `Bearer ${METRICS_SECRET || ""}`

    if (
        !METRICS_SECRET ||
        authHeader.length !== expected.length ||
        !crypto.timingSafeEqual(Buffer.from(authHeader), Buffer.from(expected))
    ) {
        return new NextResponse("Unauthorized", { status: 401 })
    }

    const body = await register.metrics()
    return new NextResponse(body, {
        headers: { "Content-Type": register.contentType },
    })
}
