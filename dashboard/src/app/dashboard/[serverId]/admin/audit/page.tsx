import { AuditLogClient } from "./audit-log-client"

export default async function AuditLogPage({ params }: { params: Promise<{ serverId: string }> }) {
    const { serverId } = await params
    return <AuditLogClient serverId={serverId} />
}
