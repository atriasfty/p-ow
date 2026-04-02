import { getSession } from "@/lib/auth-clerk"
import { isSuperAdmin } from "@/lib/admin"
import { NextResponse } from "next/server"

// Use the app/API host for queries (ingestion host eu.i.posthog.com does not support /query/)
const POSTHOG_HOST = "https://a.atriasafety.org"
const POSTHOG_PERSONAL_KEY = process.env.POSTHOG_PERSONAL_API_KEY
const POSTHOG_PROJECT_ID = process.env.POSTHOG_PROJECT_ID

interface PostHogEvent {
    event: string
    properties: Record<string, any>
    timestamp: string
}

async function queryPostHogEvents(eventName: string, hours: number = 24): Promise<PostHogEvent[]> {
    if (!POSTHOG_PERSONAL_KEY || !POSTHOG_PROJECT_ID) {
        return []
    }

    const after = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString()

    try {
        // Use the HogQL query API (recommended) instead of the deprecated /events endpoint
        // NOTE: Personal API key requests must go to the main API host, not the ingestion host.
        const res = await fetch(
            `${POSTHOG_HOST}/api/projects/${POSTHOG_PROJECT_ID}/query/`,
            {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${POSTHOG_PERSONAL_KEY}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    query: {
                        kind: "HogQLQuery",
                        // Increased limit to effectively "no limit" (100k) as requested.
                        // Standard PostHog limit is 50-100k for direct queries.
                        query: `SELECT event, properties, timestamp FROM events WHERE event = '${eventName}' AND timestamp > toDateTime('${after}') ORDER BY timestamp DESC LIMIT 100000`
                    }
                }),
                cache: "no-store",
            }
        )

        if (!res.ok) {
            const errorText = await res.text()
            console.error(`[METRICS] PostHog query failed: ${res.status} ${res.statusText}`, errorText)
            return []
        }

        const data = await res.json()
        // HogQL returns { columns: [...], results: [[...], [...], ...] }
        const columns: string[] = data.columns || []
        const rows: any[][] = data.results || []
        const eventIdx = columns.indexOf("event")
        const propsIdx = columns.indexOf("properties")
        const tsIdx = columns.indexOf("timestamp")

        return rows.map((row) => {
            const rawProps = row[propsIdx]
            const properties = typeof rawProps === "string" ? JSON.parse(rawProps) : (rawProps || {})
            return {
                event: row[eventIdx] || eventName,
                properties,
                timestamp: row[tsIdx] || "",
            }
        })
    } catch (e) {
        console.error("[METRICS] Failed to query PostHog:", e)
        return []
    }
}

function aggregateServiceMetrics(events: PostHogEvent[], service: string) {
    const serviceEvents = events.filter((e) => e.properties.service === service)
    if (serviceEvents.length === 0) {
        return { service, avgMs: 0, p95Ms: 0, p99Ms: 0, totalCalls: 0, errorRate: 0, errors: 0, timeouts: 0 }
    }

    const durations = serviceEvents.map((e) => e.properties.duration_ms).sort((a: number, b: number) => a - b)
    const errors = serviceEvents.filter((e) => e.properties.status === "error").length
    const timeouts = serviceEvents.filter((e) => e.properties.status === "timeout").length
    const total = serviceEvents.length

    return {
        service,
        avgMs: Math.round(durations.reduce((a: number, b: number) => a + b, 0) / total),
        p95Ms: Math.round(durations[Math.floor(total * 0.95)] || 0),
        p99Ms: Math.round(durations[Math.floor(total * 0.99)] || 0),
        totalCalls: total,
        errorRate: Math.round((errors + timeouts) / total * 100),
        errors,
        timeouts,
    }
}

// Helper to get status code breakdown
function getStatusCodeBreakdown(events: PostHogEvent[]) {
    const codes = new Map<string, number>()
    for (const e of events) {
        // Use the http_status property, fallback to status
        const code = e.properties.http_status || (e.properties.status === "ok" ? 200 : 500)
        const key = code.toString()
        codes.set(key, (codes.get(key) || 0) + 1)
    }

    return Array.from(codes.entries())
        .map(([code, count]) => ({ code, count }))
        .sort((a, b) => b.count - a.count)
}

function getTimeSeries(events: PostHogEvent[], service: string, hours: number, bucketMinutes: number = 5) {
    const serviceEvents = events.filter((e) => e.properties.service === service)
    const buckets = new Map<string, { durations: number[]; errors: number }>()

    // Initialize ALL buckets with zeros to prevent gaps that break charts
    // Use UTC to ensure alignment with PostHog's ISO strings
    const now = new Date()
    const start = new Date(now.getTime() - hours * 60 * 60 * 1000)

    // Round down to nearest bucket minute
    const startMs = start.getTime()
    const bucketMs = bucketMinutes * 60 * 1000
    const roundedStart = Math.floor(startMs / bucketMs) * bucketMs

    for (let t = roundedStart; t <= now.getTime(); t += bucketMs) {
        buckets.set(new Date(t).toISOString(), { durations: [], errors: 0 })
    }

    for (const e of serviceEvents) {
        const ts = new Date(e.timestamp)
        const tMs = ts.getTime()
        const roundedT = Math.floor(tMs / bucketMs) * bucketMs

        // Find the closest bucket key (since ISO strings might differ slightly due to seconds/ms)
        // We regenerate the ISO string from the rounded timestamp
        const key = new Date(roundedT).toISOString()

        // If exact key doesn't exist (edge case), find nearest or create
        if (!buckets.has(key)) {
            buckets.set(key, { durations: [], errors: 0 })
        }

        const bucket = buckets.get(key)!
        bucket.durations.push(e.properties.duration_ms)
        if (e.properties.status !== "ok") bucket.errors++
    }

    return Array.from(buckets.entries())
        .sort(([a], [b]) => a.localeCompare(b)) // ISO sort works for time
        .map(([time, data]) => ({
            time,
            avgMs: data.durations.length > 0 ? Math.round(data.durations.reduce((a, b) => a + b, 0) / data.durations.length) : 0,
            p95Ms: data.durations.length > 0 ? Math.round(data.durations.sort((a, b) => a - b)[Math.floor(data.durations.length * 0.95)] || 0) : 0,
            errors: data.errors,
            calls: data.durations.length,
        }))
}

function getEndpointBreakdown(events: PostHogEvent[], service: string) {
    const serviceEvents = events.filter((e) => e.properties.service === service)
    const byEndpoint = new Map<string, { durations: number[]; errors: number }>()

    for (const e of serviceEvents) {
        // Fallback to "unknown" if endpoint is missing, but it should be there.
        // Also strip query params if present to group correctly
        let endpoint = e.properties.endpoint || "unknown"
        if (endpoint.includes("?")) endpoint = endpoint.split("?")[0]

        const data = byEndpoint.get(endpoint) || { durations: [], errors: 0 }
        data.durations.push(e.properties.duration_ms)
        if (e.properties.status !== "ok") data.errors++
        byEndpoint.set(endpoint, data)
    }

    return Array.from(byEndpoint.entries())
        .map(([endpoint, data]) => ({
            endpoint,
            avgMs: Math.round(data.durations.length > 0 ? data.durations.reduce((a, b) => a + b, 0) / data.durations.length : 0),
            p95Ms: Math.round(data.durations.length > 0 ? data.durations.sort((a, b) => a - b)[Math.floor(data.durations.length * 0.95)] || 0 : 0),
            calls: data.durations.length,
            errors: data.errors,
            errorRate: data.durations.length > 0 ? Math.round(data.errors / data.durations.length * 100) : 0,
        }))
        .sort((a, b) => b.avgMs - a.avgMs)
}

export async function GET(req: Request) {
    // Check for IP bypass (Tailscale/VPN)
    const forwardedFor = req.headers.get("x-forwarded-for")
    const remoteAddr = req.headers.get("remote-addr")
    const ip = forwardedFor ? forwardedFor.split(",")[0].trim() : remoteAddr

    const isAllowedIp = ip === "92.60.38.109"

    // If not on allowed IP, require authentication
    if (!isAllowedIp) {
        const session = await getSession()
        if (!session) return new NextResponse("Unauthorized", { status: 401 })
        if (!isSuperAdmin(session.user as any)) return new NextResponse("Forbidden", { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const hours = parseInt(searchParams.get("hours") || "6")

    const [apiEvents, syncEvents, dbEvents] = await Promise.all([
        queryPostHogEvents("metric_api_call", hours),
        queryPostHogEvents("metric_sync_cycle", hours),
        queryPostHogEvents("metric_db_query", hours),
    ])

    // Service health summaries
    const services = {
        prc: aggregateServiceMetrics(apiEvents, "prc"),
        clerk: aggregateServiceMetrics(apiEvents, "clerk"),
        powApi: aggregateServiceMetrics(apiEvents, "pow-api"),
        database: {
            service: "database",
            avgMs: dbEvents.length > 0
                ? Math.round(dbEvents.reduce((a, e) => a + (e.properties.avg_duration_ms || 0), 0) / dbEvents.length)
                : 0,
            p95Ms: 0,
            totalCalls: dbEvents.reduce((a, e) => a + (e.properties.count || 0), 0),
            errorRate: 0,
            errors: 0,
            timeouts: 0,
        },
    }

    // Sync pipeline stats
    const syncStats = {
        totalCycles: syncEvents.length,
        successRate: syncEvents.length > 0
            ? Math.round(syncEvents.filter((e) => e.properties.status === "ok").length / syncEvents.length * 100)
            : 0,
        avgDurationMs: syncEvents.length > 0
            ? Math.round(syncEvents.reduce((a, e) => a + (e.properties.duration_ms || 0), 0) / syncEvents.length)
            : 0,
        totalLogsIngested: syncEvents.reduce((a, e) => a + (e.properties.new_logs_count || 0), 0),
        lastSync: syncEvents.length > 0 ? syncEvents[0].timestamp : null,
        recentErrors: syncEvents
            .filter((e) => e.properties.status === "error")
            .slice(0, 5)
            .map((e) => ({ time: e.timestamp, error: e.properties.error_message, serverId: e.properties.server_id })),
    }

    // Time series for charts
    const timeSeries = {
        prc: getTimeSeries(apiEvents, "prc", hours),
        clerk: getTimeSeries(apiEvents, "clerk", hours),
        powApi: getTimeSeries(apiEvents, "pow-api", hours),
    }

    // Endpoint breakdown
    const endpoints = {
        prc: getEndpointBreakdown(apiEvents, "prc"),
        powApi: getEndpointBreakdown(apiEvents, "pow-api"),
    }

    // Status code breakdown
    const statusCodes = getStatusCodeBreakdown(apiEvents)

    // Recent errors across all services
    const recentErrors = apiEvents
        .filter((e) => e.properties.status !== "ok")
        .slice(0, 20)
        .map((e) => ({
            service: e.properties.service,
            endpoint: e.properties.endpoint,
            status: e.properties.status,
            error: e.properties.error_message,
            time: e.timestamp,
            durationMs: e.properties.duration_ms,
            serverId: e.properties.server_id
        }))

    return NextResponse.json({
        hours,
        services,
        syncStats,
        timeSeries,
        endpoints,
        statusCodes,
        recentErrors,
        dataPoints: {
            apiEvents: apiEvents.length,
            syncEvents: syncEvents.length,
            dbEvents: dbEvents.length,
        },
    })
}
