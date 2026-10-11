import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import crypto from "crypto"

// PRC Global Public Key (Ed25519 SPKI DER Base64)
const PRC_PUBLIC_KEY_BASE64 = "MCowBQYDK2VwAyEAjSICb9pp0kHizGQtdG8ySWsDChfGqi+gyFCttigBNOA="

export async function POST(
    req: Request,
    { params }: { params: Promise<{ webhookId: string }> }
) {
    const { webhookId } = await params

    try {
        const server = await prisma.server.findUnique({
            where: { prcWebhookId: webhookId }
        })

        if (!server || !server.webhookEnabled) {
            return new NextResponse("Webhook Not Found or Disabled", { status: 404 })
        }

        const signature = req.headers.get("X-PRC-Signature")
        const timestamp = req.headers.get("X-PRC-Timestamp")
        const rawBody = await req.text()

        if (!signature || !timestamp) {
            return new NextResponse("Missing Signature or Timestamp", { status: 401 })
        }

        // Reject stale/future-dated payloads to prevent replay of a captured
        // (validly signed) webhook. PRC timestamps are seconds since epoch;
        // allow a 5-minute window for clock skew.
        const tsSeconds = Number(timestamp)
        const nowSeconds = Math.floor(Date.now() / 1000)
        if (!Number.isFinite(tsSeconds) || Math.abs(nowSeconds - tsSeconds) > 300) {
            return new NextResponse("Stale or invalid timestamp", { status: 401 })
        }

        // Verify Signature
        try {
            const publicKey = crypto.createPublicKey({
                key: Buffer.from(server.webhookPublicKey || PRC_PUBLIC_KEY_BASE64, "base64"),
                format: "der",
                type: "spki"
            })

            const isVerified = crypto.verify(
                null,
                Buffer.from(timestamp + rawBody),
                publicKey,
                Buffer.from(signature, "base64")
            )

            if (!isVerified) {
                console.error(`[WEBHOOK] Signature verification failed for server ${server.id}`)
                return new NextResponse("Invalid Signature", { status: 401 })
            }
        } catch (e) {
            console.error(`[WEBHOOK] Crypto error during verification for server ${server.id}:`, e)
            return new NextResponse("Verification Error", { status: 500 })
        }

        // Parse and Ingest Data
        const payload = JSON.parse(rawBody)
        const events = payload.events || []

        // ⚡ Bolt: Push all database creation promises to an array and await concurrently to avoid N+1 I/O blocking
        const dbPromises: Promise<any>[] = []

        for (const event of events) {
            if (event.event === "CustomCommand") {
                // Log custom command (starting with ;)
                dbPromises.push(prisma.log.create({
                    data: {
                        serverId: server.id,
                        type: "command",
                        playerName: "Webhook", // We'd need to lookup the origin ID to get the real name
                        playerId: event.origin,
                        command: event.data.command,
                        arguments: event.data.argument,
                        prcTimestamp: event.timestamp
                    }
                }))
            } else if (event.event === "EmergencyCallStarted") {
                // Log emergency call
                dbPromises.push(prisma.emergencyCall.create({
                    data: {
                        serverId: server.id,
                        team: event.data.team,
                        callerId: String(event.data.caller),
                        callerName: "Unknown", // Webhook doesn't provide name
                        description: event.data.description,
                        callNumber: event.data.callNumber,
                        positionX: (event.data.position && event.data.position.length >= 2) ? event.data.position[0] : 0,
                        positionZ: (event.data.position && event.data.position.length >= 2) ? event.data.position[1] : 0,
                        positionDescriptor: event.data.positionDescriptor,
                        timestamp: event.timestamp
                    }
                }))
            } else if (event.event === "ModCallStarted") {
                // Log mod call
                dbPromises.push(prisma.modCall.create({
                    data: {
                        serverId: server.id,
                        callerId: String(event.data.caller),
                        callerName: "Unknown",
                        description: event.data.description,
                        callNumber: event.data.callNumber,
                        positionX: (event.data.position && event.data.position.length >= 2) ? event.data.position[0] : 0,
                        positionZ: (event.data.position && event.data.position.length >= 2) ? event.data.position[1] : 0,
                        timestamp: event.timestamp
                    }
                }))
            } else if (event.event === "WebhookProbe") {
                console.info(`[WEBHOOK] Probe received for server ${server.id}`)
            }
        }

        await Promise.all(dbPromises)

        return new NextResponse("OK", { status: 200 })

    } catch (error: any) {
        console.error("[WEBHOOK] Fatal Error:", error)
        return new NextResponse("Internal Server Error", { status: 500 })
    }
}
