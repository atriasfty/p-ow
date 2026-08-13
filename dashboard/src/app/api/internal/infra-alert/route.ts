import { NextResponse } from "next/server"
import { sendAlert, type AlertSeverity } from "@/lib/alerting"
import crypto from "crypto"

/**
 * Receives Alertmanager's webhook POST for infra-level alerts (host mem/disk
 * pressure, PM2 process down, container down — anything Alertmanager itself
 * detects rather than app code) and routes it through the same sendAlert()
 * cooldown/dedup logic the rest of the app already uses, just on the
 * separate "infra" Discord channel. See observability/prometheus/alertmanager.yml.
 */

const INTERNAL_SECRET = process.env.INTERNAL_SYNC_SECRET

interface AlertmanagerAlert {
    status: "firing" | "resolved"
    labels: Record<string, string>
    annotations: Record<string, string>
    startsAt: string
    endsAt: string
    generatorURL: string
    fingerprint: string
}

interface AlertmanagerWebhookPayload {
    status: "firing" | "resolved"
    groupLabels: Record<string, string>
    commonAnnotations: Record<string, string>
    alerts: AlertmanagerAlert[]
}

function severityOf(labels: Record<string, string>): AlertSeverity {
    if (labels.severity === "critical") return "critical"
    if (labels.severity === "warning") return "warning"
    return "info"
}

export async function POST(req: Request) {
    const authHeader = req.headers.get("authorization") || ""
    const expected = `Bearer ${INTERNAL_SECRET || ""}`

    if (
        !INTERNAL_SECRET ||
        authHeader.length !== expected.length ||
        !crypto.timingSafeEqual(Buffer.from(authHeader), Buffer.from(expected))
    ) {
        return new NextResponse("Unauthorized", { status: 401 })
    }

    const payload = (await req.json().catch(() => null)) as AlertmanagerWebhookPayload | null
    if (!payload || !Array.isArray(payload.alerts)) {
        return new NextResponse("Bad Request", { status: 400 })
    }

    for (const alert of payload.alerts) {
        const name = alert.labels.alertname || "UnknownAlert"
        const resolved = alert.status === "resolved"

        sendAlert({
            key: `infra:${name}:${JSON.stringify(alert.labels)}`,
            title: `${resolved ? "Resolved: " : ""}${name}`,
            message: alert.annotations.summary || alert.annotations.description || "(no summary)",
            severity: resolved ? "info" : severityOf(alert.labels),
            channel: "infra",
            cooldownMs: resolved ? 0 : undefined,
            fields: { ...alert.labels },
        })
    }

    return NextResponse.json({ ok: true })
}
