import { prisma } from "@/lib/db"
import { fetchAndSaveLogs } from "@/lib/log-syncer"
import { trackSyncCycle } from "@/lib/metrics"
import { NextResponse } from "next/server"
import crypto from "crypto"

const INTERNAL_SECRET = process.env.INTERNAL_SYNC_SECRET!

export async function POST(req: Request) {
    const authHeader = req.headers.get("x-internal-secret")

    if (!authHeader || authHeader.length !== INTERNAL_SECRET.length || !crypto.timingSafeEqual(Buffer.from(authHeader), Buffer.from(INTERNAL_SECRET))) {
        console.error(`[SYNC 401] Auth header length: ${authHeader?.length}. Expected length: ${INTERNAL_SECRET?.length}. Evaluated INTERNAL_SECRET: ${INTERNAL_SECRET ? 'Exists' : 'Undefined'} | Header: ${authHeader ? 'Exists' : 'Undefined'}`)
        return new NextResponse("Unauthorized", { status: 401 })
    }

    try {
        const body = await req.json().catch(() => ({}))
        const { serverId } = body

        let servers = []

        if (serverId) {
            const s = await prisma.server.findUnique({ where: { id: serverId } })
            if (s) servers.push(s)
        } else {
            servers = await prisma.server.findMany({
                where: {
                    apiUrl: { not: "" }
                }
            })
        }

        const syncResults = []

        for (const server of servers) {
            if (!server.apiUrl) continue

            const syncStart = Date.now()
            try {
                const res = await fetchAndSaveLogs(server.apiUrl, server.id)

                // Tick automations (time-based)
                const { AutomationEngine } = await import("@/lib/automation-engine")
                await AutomationEngine.tick(server.id)

                trackSyncCycle(server.id, Date.now() - syncStart, res.newLogsCount, "ok")
                syncResults.push({ serverId: server.id, newLogs: res.newLogsCount })
            } catch (e: any) {
                trackSyncCycle(server.id, Date.now() - syncStart, 0, "error", e.message)
                // Log but don't stop the whole sync for one server failure
                console.error(`[SYNC] Failed for server ${server.id}:`, e.message)
            }
        }

        return NextResponse.json({ success: true, results: syncResults })
    } catch (e: any) {
        return new NextResponse(e.message, { status: 500 })
    }
}

