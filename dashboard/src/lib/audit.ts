import { prisma } from "./db"

export type AuditOrigin = "API" | "DASHBOARD"

export async function logAudit(
    serverId: string,
    event: string,
    details: string,
    origin: AuditOrigin,
    creatorId?: string,
    ip?: string
) {
    try {
        await (prisma.securityLog as any).create({
            data: {
                serverId,
                event,
                details,
                origin,
                creatorId,
                ip
            }
        })
    } catch (e) {
        console.error("Audit log failed:", e)
    }
}
