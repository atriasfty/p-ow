import { apiFetch } from "@/lib/api-fetch"
"use client"

import { useEffect, useState, useCallback } from "react"
import { Activity, Database, Globe, RefreshCw, Clock, AlertTriangle, CheckCircle2, Zap, Server, ArrowLeft } from "lucide-react"
import Link from "next/link"

interface ServiceHealth {
    service: string
    avgMs: number
    p95Ms: number
    p99Ms?: number
    totalCalls: number
    errorRate: number
    errors: number
    timeouts: number
}

interface TimeSeriesPoint {
    time: string
    avgMs: number
    p95Ms: number
    errors: number
    calls: number
}

interface EndpointData {
    endpoint: string
    avgMs: number
    p95Ms: number
    calls: number
    errors: number
    errorRate: number
}

interface SyncStats {
    totalCycles: number
    successRate: number
    avgDurationMs: number
    totalLogsIngested: number
    lastSync: string | null
    recentErrors: { time: string; error: string; serverId: string }[]
}

interface MetricsData {
    hours: number
    services: {
        prc: ServiceHealth
        clerk: ServiceHealth
        powApi: ServiceHealth
        database: ServiceHealth
    }
    syncStats: SyncStats
    timeSeries: {
        prc: TimeSeriesPoint[]
        clerk: TimeSeriesPoint[]
        powApi: TimeSeriesPoint[]
    }
    endpoints: {
        prc: EndpointData[]
        powApi: EndpointData[]
    }
    statusCodes: { code: string; count: number }[]
    recentErrors: {
        service: string
        endpoint: string
        status: string
        error: string
        time: string
        durationMs: number
        serverId?: string
    }[]
    dataPoints: {
        apiEvents: number
        syncEvents: number
        dbEvents: number
    }
}

// Mini sparkline chart component
function SparklineChart({ data, height = 60, color = "#818cf8" }: { data: TimeSeriesPoint[]; height?: number; color?: string }) {
    if (!data || data.length < 2) {
        return (
            <div style={{ height }} className="flex items-center justify-center text-zinc-600 text-xs">
                Waiting for data...
            </div>
        )
    }

    const values = data.map((d) => d.avgMs)
    const max = Math.max(...values, 1)
    const min = Math.min(...values)
    const range = max - min || 1
    const width = 100

    const points = values
        .map((v, i) => {
            const x = (i / (values.length - 1)) * width
            const y = height - ((v - min) / range) * (height - 10) - 5
            return `${x},${y}`
        })
        .join(" ")

    // Area fill
    const areaPoints = `0,${height} ${points} ${width},${height}`

    return (
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full" preserveAspectRatio="none" style={{ height }}>
            <defs>
                <linearGradient id={`grad-${color.replace("#", "")}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={color} stopOpacity="0.3" />
                    <stop offset="100%" stopColor={color} stopOpacity="0" />
                </linearGradient>
            </defs>
            <polygon points={areaPoints} fill={`url(#grad-${color.replace("#", "")})`} />
            <polyline points={points} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    )
}

// Large chart with labels
function ResponseTimeChart({ data, title, color = "#818cf8" }: { data: TimeSeriesPoint[]; title: string; color?: string }) {
    if (!data || data.length < 2) {
        return (
            <div className="bg-[#1a1a1a] rounded-2xl p-6 border border-white/5">
                <h3 className="text-sm font-medium text-zinc-400 mb-4">{title}</h3>
                <div className="h-40 flex items-center justify-center text-zinc-600 text-sm">
                    Collecting data... Check back in a few minutes.
                </div>
            </div>
        )
    }

    const values = data.map((d) => d.avgMs)
    const p95Values = data.map((d) => d.p95Ms)
    const allValues = [...values, ...p95Values]
    const max = Math.max(...allValues, 1)
    const chartHeight = 140
    const chartWidth = 600

    const getPoints = (vals: number[]) =>
        vals
            .map((v, i) => {
                const x = (i / (vals.length - 1)) * chartWidth
                const y = chartHeight - (v / max) * (chartHeight - 20) - 10
                return `${x},${y}`
            })
            .join(" ")

    const avgPoints = getPoints(values)
    const p95Points = getPoints(p95Values)

    // Error bars
    const errorBuckets = data.filter((d) => d.errors > 0)

    return (
        <div className="bg-[#1a1a1a] rounded-2xl p-6 border border-white/5">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-medium text-zinc-400">{title}</h3>
                <div className="flex items-center gap-4 text-xs">
                    <div className="flex items-center gap-1.5">
                        <div className="w-3 h-0.5 rounded" style={{ backgroundColor: color }} />
                        <span className="text-zinc-500">avg</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <div className="w-3 h-0.5 rounded opacity-40" style={{ backgroundColor: color }} />
                        <span className="text-zinc-500">p95</span>
                    </div>
                    {errorBuckets.length > 0 && (
                        <div className="flex items-center gap-1.5">
                            <div className="w-2 h-2 rounded-full bg-red-500" />
                            <span className="text-zinc-500">errors</span>
                        </div>
                    )}
                </div>
            </div>
            <div className="relative">
                {/* Y-axis labels */}
                <div className="absolute left-0 top-0 h-full flex flex-col justify-between text-[10px] text-zinc-600 pr-2" style={{ width: 40 }}>
                    <span>{max}ms</span>
                    <span>{Math.round(max / 2)}ms</span>
                    <span>0ms</span>
                </div>
                <div className="ml-10">
                    <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="w-full" preserveAspectRatio="none" style={{ height: chartHeight }}>
                        {/* Grid lines */}
                        <line x1="0" y1={chartHeight / 2} x2={chartWidth} y2={chartHeight / 2} stroke="#333" strokeWidth="0.5" strokeDasharray="4" />
                        <line x1="0" y1={chartHeight - 10} x2={chartWidth} y2={chartHeight - 10} stroke="#333" strokeWidth="0.5" strokeDasharray="4" />

                        {/* P95 line */}
                        <polyline points={p95Points} fill="none" stroke={color} strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" opacity="0.3" />

                        {/* Avg line */}
                        <defs>
                            <linearGradient id={`area-${color.replace("#", "")}`} x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor={color} stopOpacity="0.15" />
                                <stop offset="100%" stopColor={color} stopOpacity="0" />
                            </linearGradient>
                        </defs>
                        <polygon points={`0,${chartHeight} ${avgPoints} ${chartWidth},${chartHeight}`} fill={`url(#area-${color.replace("#", "")})`} />
                        <polyline points={avgPoints} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />

                        {/* Error dots */}
                        {data.map((d, i) => {
                            if (d.errors === 0) return null
                            const x = (i / (data.length - 1)) * chartWidth
                            return <circle key={i} cx={x} cy={10} r={3} fill="#ef4444" />
                        })}
                    </svg>
                    {/* X-axis labels */}
                    <div className="flex justify-between text-[10px] text-zinc-600 mt-1">
                        <span>{new Date(data[0].time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                        <span>{new Date(data[Math.floor(data.length / 2)].time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                        <span>{new Date(data[data.length - 1].time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                    </div>
                </div>
            </div>
        </div>
    )
}

function StatusBadge({ service }: { service: ServiceHealth }) {
    if (service.totalCalls === 0) {
        return (
            <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-zinc-600 animate-pulse" />
                <span className="text-xs text-zinc-500">No data</span>
            </div>
        )
    }
    if (service.errorRate > 50) {
        return (
            <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                <span className="text-xs text-red-400">Critical</span>
            </div>
        )
    }
    if (service.errorRate > 10) {
        return (
            <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-amber-500" />
                <span className="text-xs text-amber-400">Degraded</span>
            </div>
        )
    }
    return (
        <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-emerald-500" />
            <span className="text-xs text-emerald-400">Healthy</span>
        </div>
    )
}

function ServiceCard({ service, icon: Icon, label, color, sparkline }: {
    service: ServiceHealth
    icon: any
    label: string
    color: string
    sparkline?: TimeSeriesPoint[]
}) {
    return (
        <div className="bg-[#1a1a1a] rounded-2xl p-5 border border-white/5 hover:border-white/10 transition-colors">
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center`} style={{ backgroundColor: `${color}20` }}>
                        <Icon className="h-5 w-5" style={{ color }} />
                    </div>
                    <div>
                        <h3 className="text-sm font-semibold text-white">{label}</h3>
                        <StatusBadge service={service} />
                    </div>
                </div>
            </div>

            {sparkline && <SparklineChart data={sparkline} height={40} color={color} />}

            <div className="grid grid-cols-3 gap-3 mt-4">
                <div>
                    <div className="text-lg font-bold text-white">{service.avgMs}<span className="text-xs text-zinc-500 ml-0.5">ms</span></div>
                    <div className="text-[10px] text-zinc-500 uppercase tracking-wider">Avg Latency</div>
                </div>
                <div>
                    <div className="text-lg font-bold text-white">{service.totalCalls.toLocaleString()}</div>
                    <div className="text-[10px] text-zinc-500 uppercase tracking-wider">Total Calls</div>
                </div>
                <div>
                    <div className={`text-lg font-bold ${service.errorRate > 10 ? "text-red-400" : service.errorRate > 0 ? "text-amber-400" : "text-emerald-400"}`}>
                        {service.errorRate}%
                    </div>
                    <div className="text-[10px] text-zinc-500 uppercase tracking-wider">Error Rate</div>
                </div>
            </div>
        </div>
    )
}

function EndpointTable({ endpoints, title }: { endpoints: EndpointData[]; title: string }) {
    if (!endpoints || endpoints.length === 0) {
        return null
    }

    return (
        <div className="bg-[#1a1a1a] rounded-2xl border border-white/5 overflow-hidden">
            <div className="px-5 py-4 border-b border-white/5">
                <h3 className="text-sm font-medium text-zinc-400">{title}</h3>
            </div>
            <div className="overflow-x-auto">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="text-zinc-500 text-xs uppercase tracking-wider">
                            <th className="text-left px-5 py-3 font-medium">Endpoint</th>
                            <th className="text-right px-5 py-3 font-medium">Avg</th>
                            <th className="text-right px-5 py-3 font-medium">P95</th>
                            <th className="text-right px-5 py-3 font-medium">Calls</th>
                            <th className="text-right px-5 py-3 font-medium">Errors</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                        {endpoints.map((ep) => (
                            <tr key={ep.endpoint} className="hover:bg-white/5 transition-colors">
                                <td className="px-5 py-3">
                                    <code className="text-xs text-indigo-400 bg-indigo-500/10 px-2 py-1 rounded">{ep.endpoint}</code>
                                </td>
                                <td className="text-right px-5 py-3">
                                    <span className={`font-mono ${ep.avgMs > 3000 ? "text-red-400" : ep.avgMs > 1000 ? "text-amber-400" : "text-zinc-300"}`}>
                                        {ep.avgMs}ms
                                    </span>
                                </td>
                                <td className="text-right px-5 py-3 font-mono text-zinc-400">{ep.p95Ms}ms</td>
                                <td className="text-right px-5 py-3 text-zinc-400">{ep.calls}</td>
                                <td className="text-right px-5 py-3">
                                    {ep.errors > 0 ? (
                                        <span className="text-red-400">{ep.errors} ({ep.errorRate}%)</span>
                                    ) : (
                                        <span className="text-zinc-600">—</span>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    )
}

function StatusCodeChart({ data }: { data: { code: string; count: number }[] }) {
    if (!data || data.length === 0) return null

    const total = data.reduce((a, b) => a + b.count, 0)

    return (
        <div className="bg-[#1a1a1a] rounded-2xl p-6 border border-white/5 h-full">
            <h3 className="text-sm font-medium text-zinc-400 mb-4">HTTP Response Codes</h3>
            <div className="space-y-3">
                {data.slice(0, 5).map((item) => {
                    const code = parseInt(item.code)
                    const color = code >= 500 ? "bg-red-500" : code >= 400 ? "bg-amber-500" : "bg-emerald-500"
                    const percent = Math.round((item.count / total) * 100)

                    return (
                        <div key={item.code}>
                            <div className="flex justify-between text-xs mb-1">
                                <span className="text-zinc-300 font-mono">{item.code}</span>
                                <span className="text-zinc-500">{item.count.toLocaleString()} ({percent}%)</span>
                            </div>
                            <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                                <div className={`h-full ${color}`} style={{ width: `${percent}%` }} />
                            </div>
                        </div>
                    )
                })}
            </div>
        </div>
    )
}

export default function StatusPage() {
    const [data, setData] = useState<MetricsData | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [hours, setHours] = useState(6)
    const [lastRefresh, setLastRefresh] = useState<Date | null>(null)

    const fetchMetrics = useCallback(async () => {
        try {
            const res = await apiFetch(`/api/admin/metrics?hours=${hours}`)
            if (!res.ok) {
                if (res.status === 401) throw new Error("Not authenticated")
                if (res.status === 403) throw new Error("Superadmin access required")
                throw new Error(`Failed to load metrics: ${res.status}`)
            }
            const json = await res.json()
            setData(json)
            setError(null)
            setLastRefresh(new Date())
        } catch (e: any) {
            setError(e.message)
        } finally {
            setLoading(false)
        }
    }, [hours])

    useEffect(() => {
        fetchMetrics()
        const interval = setInterval(fetchMetrics, 30000) // Auto-refresh every 30s
        return () => clearInterval(interval)
    }, [fetchMetrics])

    if (loading) {
        return (
            <div className="min-h-screen bg-[#111] flex items-center justify-center">
                <div className="flex items-center gap-3 text-zinc-400">
                    <RefreshCw className="h-5 w-5 animate-spin" />
                    <span>Loading system metrics...</span>
                </div>
            </div>
        )
    }

    if (error) {
        return (
            <div className="min-h-screen bg-[#111] flex items-center justify-center">
                <div className="text-center">
                    <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
                    <h1 className="text-xl font-bold text-white mb-2">Access Denied</h1>
                    <p className="text-zinc-400">{error}</p>
                    <Link href="/dashboard" className="mt-4 inline-block text-indigo-400 hover:text-indigo-300 text-sm">
                        ← Back to Dashboard
                    </Link>
                </div>
            </div>
        )
    }

    if (!data) return null

    const noData = data.dataPoints.apiEvents === 0 && data.dataPoints.syncEvents === 0 && data.dataPoints.dbEvents === 0

    return (
        <div className="min-h-screen bg-[#111] font-sans text-zinc-100">
            <div className="p-4 md:p-8">
                <div className="mx-auto max-w-7xl space-y-6">
                    {/* Header */}
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="flex items-center gap-4">
                            <Link href="/dashboard" className="p-2 rounded-lg hover:bg-white/5 transition-colors">
                                <ArrowLeft className="h-5 w-5 text-zinc-400" />
                            </Link>
                            <div>
                                <h1 className="text-2xl font-bold bg-gradient-to-r from-white to-zinc-400 bg-clip-text text-transparent">
                                    System Status
                                </h1>
                                <p className="text-sm text-zinc-500">
                                    {lastRefresh ? `Last refreshed ${lastRefresh.toLocaleTimeString()}` : "Loading..."}
                                    {" · "}Auto-refreshes every 30s
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            {[1, 6, 24, 168].map((h) => (
                                <button
                                    key={h}
                                    onClick={() => { setHours(h); setLoading(true) }}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${hours === h
                                        ? "bg-indigo-500/20 text-indigo-300 ring-1 ring-indigo-500/30"
                                        : "text-zinc-500 hover:text-zinc-300 hover:bg-white/5"
                                        }`}
                                >
                                    {h === 1 ? "1h" : h === 6 ? "6h" : h === 24 ? "24h" : "7d"}
                                </button>
                            ))}
                            <button
                                onClick={() => { setLoading(true); fetchMetrics() }}
                                className="p-2 rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-white/5 transition-colors ml-1"
                            >
                                <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                            </button>
                        </div>
                    </div>

                    {noData && (
                        <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-5 flex items-start gap-3">
                            <AlertTriangle className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
                            <div>
                                <p className="text-amber-200 text-sm font-medium">No metrics data yet</p>
                                <p className="text-amber-300/60 text-xs mt-1">
                                    Metrics will start appearing after the dashboard processes a few requests. This usually takes 1-2 minutes after deployment.
                                </p>
                            </div>
                        </div>
                    )}

                    {/* Service Health Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        <ServiceCard
                            service={data.services.prc}
                            icon={Globe}
                            label="PRC API"
                            color="#818cf8"
                            sparkline={data.timeSeries.prc}
                        />
                        <ServiceCard
                            service={data.services.clerk}
                            icon={Activity}
                            label="Clerk Auth"
                            color="#f472b6"
                            sparkline={data.timeSeries.clerk}
                        />
                        <ServiceCard
                            service={data.services.powApi}
                            icon={Zap}
                            label="POW API"
                            color="#34d399"
                            sparkline={data.timeSeries.powApi}
                        />
                        <ServiceCard
                            service={data.services.database}
                            icon={Database}
                            label="Database"
                            color="#fbbf24"
                        />
                    </div>

                    {/* Sync Pipeline Card */}
                    <div className="bg-[#1a1a1a] rounded-2xl p-5 border border-white/5">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 rounded-xl bg-cyan-500/10 flex items-center justify-center">
                                <Server className="h-5 w-5 text-cyan-400" />
                            </div>
                            <div>
                                <h3 className="text-sm font-semibold text-white">Sync Pipeline</h3>
                                <div className="flex items-center gap-1.5">
                                    <div className={`w-2 h-2 rounded-full ${data.syncStats.successRate >= 90 ? "bg-emerald-500" : data.syncStats.successRate >= 50 ? "bg-amber-500" : "bg-red-500"}`} />
                                    <span className="text-xs text-zinc-500">{data.syncStats.successRate}% success rate</span>
                                </div>
                            </div>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div>
                                <div className="text-2xl font-bold text-white">{data.syncStats.totalCycles}</div>
                                <div className="text-[10px] text-zinc-500 uppercase tracking-wider">Sync Cycles</div>
                            </div>
                            <div>
                                <div className="text-2xl font-bold text-white">{data.syncStats.avgDurationMs}<span className="text-sm text-zinc-500 ml-0.5">ms</span></div>
                                <div className="text-[10px] text-zinc-500 uppercase tracking-wider">Avg Duration</div>
                            </div>
                            <div>
                                <div className="text-2xl font-bold text-white">{data.syncStats.totalLogsIngested.toLocaleString()}</div>
                                <div className="text-[10px] text-zinc-500 uppercase tracking-wider">Logs Ingested</div>
                            </div>
                            <div>
                                <div className="text-2xl font-bold text-white">
                                    {data.syncStats.lastSync ? new Date(data.syncStats.lastSync).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "—"}
                                </div>
                                <div className="text-[10px] text-zinc-500 uppercase tracking-wider">Last Sync</div>
                            </div>
                        </div>
                    </div>

                    {/* Response Time Charts */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        <ResponseTimeChart data={data.timeSeries.prc} title="PRC API Response Time" color="#818cf8" />
                        <ResponseTimeChart data={data.timeSeries.clerk} title="Clerk Auth Response Time" color="#f472b6" />
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                        <div className="lg:col-span-2">
                            <ResponseTimeChart data={data.timeSeries.powApi} title="POW Internal API Response Time" color="#34d399" />
                        </div>
                        <div>
                            <StatusCodeChart data={data.statusCodes} />
                        </div>
                    </div>

                    {/* Endpoint Tables */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        <EndpointTable endpoints={data.endpoints.prc} title="PRC Endpoints (slowest first)" />
                        <EndpointTable endpoints={data.endpoints.powApi} title="POW API Endpoints (slowest first)" />
                    </div>

                    {/* Recent Errors */}
                    {data.recentErrors.length > 0 && (
                        <div className="bg-[#1a1a1a] rounded-2xl border border-white/5 overflow-hidden">
                            <div className="px-5 py-4 border-b border-white/5 flex items-center gap-2">
                                <AlertTriangle className="h-4 w-4 text-red-400" />
                                <h3 className="text-sm font-medium text-zinc-400">Recent Service Errors</h3>
                                <span className="ml-auto text-xs text-zinc-600">{data.recentErrors.length} errors</span>
                            </div>
                            <div className="divide-y divide-white/5 max-h-96 overflow-y-auto">
                                {data.recentErrors.map((err, i) => (
                                    <div key={i} className="px-5 py-3 flex items-start gap-3 hover:bg-white/5 transition-colors">
                                        <div className={`mt-1 w-2 h-2 rounded-full shrink-0 ${err.status === "timeout" ? "bg-amber-500" : "bg-red-500"}`} />
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center gap-2 text-xs">
                                                <span className="text-zinc-400 font-medium uppercase">{err.service}</span>
                                                <code className="text-zinc-500 truncate">{err.endpoint}</code>
                                                {err.serverId && (
                                                    <span className="text-indigo-400 bg-indigo-500/10 px-1.5 py-0.5 rounded text-[10px] font-mono">
                                                        {err.serverId}
                                                    </span>
                                                )}
                                                <span className="ml-auto text-zinc-600 shrink-0">{err.durationMs}ms</span>
                                            </div>
                                            <p className="text-xs text-red-400/80 mt-0.5 truncate">{err.error}</p>
                                            <p className="text-[10px] text-zinc-600 mt-0.5">
                                                {new Date(err.time).toLocaleString()}
                                            </p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Footer */}
                    <div className="text-center text-xs text-zinc-700 py-4">
                        Data points: {data.dataPoints.apiEvents} API · {data.dataPoints.syncEvents} sync · {data.dataPoints.dbEvents} DB
                    </div>
                </div>
            </div>
        </div>
    )
}
