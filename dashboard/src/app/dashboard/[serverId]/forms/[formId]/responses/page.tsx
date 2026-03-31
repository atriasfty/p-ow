"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { ArrowLeft, Download, BarChart3, FileText, Users, Calendar, ChevronDown, ChevronUp, PieChart, Trash2 } from "lucide-react"
import { useDialog } from "@/components/providers/dialog-provider"

interface Response {
    id: string
    submittedAt: string
    respondent: { id: string; email?: string; name: string } | null
    answers: Record<string, { questionLabel: string; value: any }>
}

interface Analytics {
    formId: string
    formTitle: string
    totalResponses: number
    questionAnalytics: Record<string, {
        questionLabel: string
        questionType: string
        type: string
        chartTypes?: string[]
        data?: { label: string; value: number }[]
        total: number
        average?: number
        samples?: string[]
    }>
    responseTimeline: { date: string; count: number }[]
}

const renderAnswerValue = (value: any) => {
    const safeUrl = (url?: string) => {
        if (!url) return "#"
        const trimmed = url.trim()
        const lower = trimmed.toLowerCase()
        if (lower.startsWith("javascript:") || lower.startsWith("data:") || lower.startsWith("vbscript:")) {
            return "about:blank"
        }
        return trimmed
    }

    // Handle file upload objects (stored as {url, filename})
    if (value && typeof value === "object" && value.url && value.filename) {
        return (
            <a
                href={safeUrl(value.url)}
                target="_blank"
                rel="noopener noreferrer"
                download={value.filename}
                className="inline-flex items-center gap-2 px-3 py-2 bg-[#222] hover:bg-[#333] rounded-lg text-sm text-indigo-400 hover:text-indigo-300 transition-colors"
                onClick={(e) => e.stopPropagation()}
            >
                <Download className="h-4 w-4" />
                {value.filename}
            </a>
        )
    }

    // Handle array of file uploads
    if (Array.isArray(value) && value.length > 0 && value[0]?.url) {
        return (
            <div className="flex flex-wrap gap-2">
                {value.map((file, i) => (
                    <a
                        key={i}
                        href={safeUrl(file.url)}
                        target="_blank"
                        rel="noopener noreferrer"
                        download={file.filename}
                        className="inline-flex items-center gap-2 px-3 py-2 bg-[#222] hover:bg-[#333] rounded-lg text-sm text-indigo-400 hover:text-indigo-300 transition-colors"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <Download className="h-4 w-4" />
                        {file.filename}
                    </a>
                ))}
            </div>
        )
    }

    if (Array.isArray(value)) {
        return value.join(", ")
    }

    if (typeof value === "object") {
        return JSON.stringify(value)
    }

    return String(value)
}

export default function ResponsesPage({
    params,
}: {
    params: Promise<{ serverId: string; formId: string }>
}) {
    const [tab, setTab] = useState<"responses" | "analytics">("analytics")
    const [responses, setResponses] = useState<Response[]>([])
    const [analytics, setAnalytics] = useState<Analytics | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [expandedResponse, setExpandedResponse] = useState<string | null>(null)
    const [resolvedParams, setResolvedParams] = useState<{ serverId: string; formId: string } | null>(null)
    const [deleting, setDeleting] = useState<string | null>(null)

    const [canExport, setCanExport] = useState(false)
    const { showConfirm } = useDialog()

    useEffect(() => {
        params.then(p => {
            setResolvedParams(p)
            loadData(p.formId, p.serverId)
        })
    }, [params])

    const loadData = async (formId: string, serverId: string) => {
        try {
            const [responsesRes, analyticsRes, planRes] = await Promise.all([
                fetch(`/api/forms/${formId}/responses`),
                fetch(`/api/forms/${formId}/analytics`),
                fetch(`/api/server/${serverId}/plan`)
            ])

            if (responsesRes.ok) {
                const data = await responsesRes.json()
                setResponses(data.responses || [])
            }
            if (analyticsRes.ok) {
                setAnalytics(await analyticsRes.json())
            }
            if (planRes.ok) {
                const planData = await planRes.json()
                setCanExport(planData.hasExports)
            }
        } catch (error) {
            console.error("Failed to load data:", error)
            setError("Failed to load responses. You may not have permission.")
        }
        setLoading(false)
    }

    const downloadCsv = () => {
        if (!resolvedParams) return
        window.open(`/api/forms/${resolvedParams.formId}/responses?format=csv`, "_blank")
    }

    const deleteResponse = async (responseId: string) => {
        if (!resolvedParams) return
        const confirmed = await showConfirm("Delete Response", "Are you sure you want to delete this response?", "Delete", "destructive")
        if (!confirmed) return
        setDeleting(responseId)
        try {
            const res = await fetch(`/api/forms/${resolvedParams.formId}/responses?responseId=${responseId}`, {
                method: "DELETE"
            })
            if (res.ok) {
                setResponses(prev => prev.filter(r => r.id !== responseId))
                if (analytics) {
                    setAnalytics({ ...analytics, totalResponses: analytics.totalResponses - 1 })
                }
            }
        } catch (e) {
            console.error("Failed to delete response", e)
        }
        setDeleting(null)
    }

    const deleteAllResponses = async () => {
        if (!resolvedParams) return
        const confirmed = await showConfirm("Delete All Responses", "Are you sure you want to delete ALL responses? This cannot be undone.", "Delete All", "destructive")
        if (!confirmed) return
        setDeleting("all")
        try {
            const res = await fetch(`/api/forms/${resolvedParams.formId}/responses?deleteAll=true`, {
                method: "DELETE"
            })
            if (res.ok) {
                setResponses([])
                if (analytics) {
                    setAnalytics({ ...analytics, totalResponses: 0 })
                }
            }
        } catch (e) {
            console.error("Failed to delete all responses", e)
        }
        setDeleting(null)
    }

    if (loading) {
        return (
            <div className="min-h-screen bg-[#111] flex items-center justify-center">
                <div className="text-zinc-400">Loading...</div>
            </div>
        )
    }

    if (!resolvedParams) return null

    return (
        <div className="min-h-screen bg-[#111]">
            {/* Header */}
            <div className="sticky top-0 z-10 bg-[#111]/95 backdrop-blur border-b border-[#333] px-6 py-4">
                <div className="max-w-6xl mx-auto flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Link href={`/dashboard/${resolvedParams.serverId}/forms/${resolvedParams.formId}/edit`} className="text-zinc-400 hover:text-white">
                            <ArrowLeft className="h-5 w-5" />
                        </Link>
                        <div>
                            <h1 className="text-lg font-semibold text-white">{analytics?.formTitle || "Form"} Responses</h1>
                            <p className="text-sm text-zinc-500">{analytics?.totalResponses || 0} total responses</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="flex bg-[#222] rounded-lg p-1">
                            <button
                                onClick={() => setTab("analytics")}
                                className={`px-3 py-1.5 rounded text-sm ${tab === "analytics" ? "bg-indigo-600 text-white" : "text-zinc-400"}`}
                            >
                                <BarChart3 className="h-4 w-4 inline mr-1" /> Analytics
                            </button>
                            <button
                                onClick={() => setTab("responses")}
                                className={`px-3 py-1.5 rounded text-sm ${tab === "responses" ? "bg-indigo-600 text-white" : "text-zinc-400"}`}
                            >
                                <FileText className="h-4 w-4 inline mr-1" /> Responses
                            </button>
                        </div>
                        {canExport && (
                            <button
                                onClick={downloadCsv}
                                className="flex items-center gap-2 px-3 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg text-sm"
                            >
                                <Download className="h-4 w-4" /> Export CSV
                            </button>
                        )}
                        {responses.length > 0 && (
                            <button
                                onClick={deleteAllResponses}
                                disabled={deleting === "all"}
                                className="flex items-center gap-2 px-3 py-2 bg-red-600/20 hover:bg-red-600/30 text-red-400 rounded-lg text-sm border border-red-600/30"
                            >
                                <Trash2 className="h-4 w-4" />
                                {deleting === "all" ? "Deleting..." : "Delete All"}
                            </button>
                        )}
                    </div>
                </div>
            </div>



            <div className="max-w-6xl mx-auto p-6">
                {error ? (
                    <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-6 text-center text-red-400">
                        {error}
                    </div>
                ) : (
                    <>
                        {tab === "analytics" && analytics && (
                            <div className="space-y-6">
                                {/* Overview Stats */}
                                <div className="grid grid-cols-3 gap-4">
                                    <div className="bg-[#1a1a1a] border border-[#333] rounded-xl p-6">
                                        <Users className="h-8 w-8 text-indigo-400 mb-2" />
                                        <p className="text-3xl font-bold text-white">{analytics.totalResponses}</p>
                                        <p className="text-zinc-500">Total Responses</p>
                                    </div>
                                    <div className="bg-[#1a1a1a] border border-[#333] rounded-xl p-6">
                                        <Calendar className="h-8 w-8 text-emerald-400 mb-2" />
                                        <p className="text-3xl font-bold text-white">
                                            {analytics.responseTimeline.length > 0
                                                ? analytics.responseTimeline[analytics.responseTimeline.length - 1].count
                                                : 0}
                                        </p>
                                        <p className="text-zinc-500">Today's Responses</p>
                                    </div>
                                    <div className="bg-[#1a1a1a] border border-[#333] rounded-xl p-6">
                                        <BarChart3 className="h-8 w-8 text-amber-400 mb-2" />
                                        <p className="text-3xl font-bold text-white">{Object.keys(analytics.questionAnalytics).length}</p>
                                        <p className="text-zinc-500">Questions</p>
                                    </div>
                                </div>

                                {/* Timeline */}
                                {analytics.responseTimeline.length > 0 && (
                                    <div className="bg-[#1a1a1a] border border-[#333] rounded-xl p-6">
                                        <h3 className="text-lg font-semibold text-white mb-4">Response Timeline</h3>
                                        <div className="flex items-end gap-1 h-32">
                                            {analytics.responseTimeline.slice(-30).map((d, i) => {
                                                const max = Math.max(...analytics.responseTimeline.map(t => t.count))
                                                // Ensure standard height if max is low to avoid "blue rectangle" look
                                                const normalizedMax = Math.max(max, 5)
                                                const height = (d.count / normalizedMax) * 100
                                                return (
                                                    <div
                                                        key={i}
                                                        className="flex-1 bg-indigo-600 rounded-t"
                                                        style={{ height: `${height}%`, minHeight: d.count > 0 ? "4px" : 0 }}
                                                        title={`${d.date}: ${d.count}`}
                                                    />
                                                )
                                            })}
                                        </div>
                                        <p className="text-xs text-zinc-500 mt-2">Last 30 days</p>
                                    </div>
                                )}

                                {/* Question Analytics */}
                                <div className="space-y-4">
                                    {Object.entries(analytics.questionAnalytics).map(([qId, qa]) => (
                                        <div key={qId} className="bg-[#1a1a1a] border border-[#333] rounded-xl p-6">
                                            <div className="flex items-start justify-between mb-4">
                                                <div>
                                                    <h3 className="font-medium text-white">{qa.questionLabel}</h3>
                                                    <p className="text-sm text-zinc-500">{qa.total} responses</p>
                                                </div>
                                                <span className="text-xs bg-zinc-800 px-2 py-1 rounded text-zinc-400">{qa.questionType}</span>
                                            </div>

                                            {qa.type === "distribution" && qa.data && (
                                                <div className="space-y-2">
                                                    {qa.data.map((d, i) => {
                                                        const percentage = qa.total > 0 ? (d.value / qa.total) * 100 : 0
                                                        return (
                                                            <div key={i}>
                                                                <div className="flex justify-between text-sm mb-1">
                                                                    <span className="text-zinc-300">{d.label}</span>
                                                                    <span className="text-zinc-500">{d.value} ({percentage.toFixed(1)}%)</span>
                                                                </div>
                                                                <div className="h-2 bg-[#333] rounded-full overflow-hidden">
                                                                    <div
                                                                        className="h-full bg-indigo-600 rounded-full"
                                                                        style={{ width: `${percentage}%` }}
                                                                    />
                                                                </div>
                                                            </div>
                                                        )
                                                    })}
                                                </div>
                                            )}

                                            {qa.type === "scale" && qa.data && (
                                                <div className="space-y-3">
                                                    <p className="text-2xl font-bold text-white">Average: {qa.average}</p>
                                                    <div className="flex items-end gap-1 h-20">
                                                        {qa.data.map((d, i) => {
                                                            const max = Math.max(...qa.data!.map(x => x.value))
                                                            const height = max > 0 ? (d.value / max) * 100 : 0
                                                            return (
                                                                <div key={i} className="flex-1 flex flex-col items-center">
                                                                    <div
                                                                        className="w-full bg-indigo-600 rounded-t"
                                                                        style={{ height: `${height}%`, minHeight: d.value > 0 ? "4px" : 0 }}
                                                                    />
                                                                    <span className="text-xs text-zinc-500 mt-1">{d.label}</span>
                                                                </div>
                                                            )
                                                        })}
                                                    </div>
                                                </div>
                                            )}

                                            {qa.type === "text" && qa.samples && (
                                                <div className="space-y-2">
                                                    <p className="text-sm text-zinc-500">Recent responses:</p>
                                                    {qa.samples.slice(0, 3).map((s, i) => (
                                                        <div key={i} className="bg-[#222] p-3 rounded text-sm text-zinc-300">
                                                            "{s}"
                                                        </div>
                                                    ))}
                                                </div>
                                            )}

                                            {qa.type === "date" && qa.data && qa.data.length > 0 && (
                                                <div className="flex items-end gap-1 h-20">
                                                    {qa.data.map((d, i) => {
                                                        const max = Math.max(...qa.data!.map(x => x.value))
                                                        const height = max > 0 ? (d.value / max) * 100 : 0
                                                        return (
                                                            <div key={i} className="flex-1 flex flex-col items-center">
                                                                <div
                                                                    className="w-full bg-emerald-600 rounded-t"
                                                                    style={{ height: `${height}%`, minHeight: d.value > 0 ? "4px" : 0 }}
                                                                />
                                                                <span className="text-xs text-zinc-500 mt-1">{d.label}</span>
                                                            </div>
                                                        )
                                                    })}
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {tab === "responses" && (
                            <div className="space-y-4">
                                {responses.length === 0 ? (
                                    <div className="bg-[#1a1a1a] border border-[#333] rounded-xl p-12 text-center">
                                        <FileText className="h-12 w-12 text-zinc-600 mx-auto mb-4" />
                                        <p className="text-zinc-400">No responses yet</p>
                                    </div>
                                ) : (
                                    responses.map((r) => (
                                        <div key={r.id} className="bg-[#1a1a1a] border border-[#333] rounded-xl overflow-hidden">
                                            <div className="flex items-center justify-between p-4">
                                                <button
                                                    onClick={() => setExpandedResponse(expandedResponse === r.id ? null : r.id)}
                                                    className="flex-1 flex items-center justify-between text-left"
                                                >
                                                    <div>
                                                        <p className="text-white font-medium">
                                                            {r.respondent ? r.respondent.name : "Anonymous"}
                                                        </p>
                                                        <p className="text-sm text-zinc-500">
                                                            {new Date(r.submittedAt).toLocaleString()}
                                                        </p>
                                                    </div>
                                                    {expandedResponse === r.id ? (
                                                        <ChevronUp className="h-5 w-5 text-zinc-500" />
                                                    ) : (
                                                        <ChevronDown className="h-5 w-5 text-zinc-500" />
                                                    )}
                                                </button>
                                                <button
                                                    onClick={() => deleteResponse(r.id)}
                                                    disabled={deleting === r.id}
                                                    className="ml-3 p-2 hover:bg-red-500/20 rounded-lg text-zinc-500 hover:text-red-400 transition-colors"
                                                    title="Delete response"
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </button>
                                            </div>
                                            {expandedResponse === r.id && (
                                                <div className="border-t border-[#333] p-4 space-y-3">
                                                    {Object.entries(r.answers).map(([qId, answer]) => (
                                                        <div key={qId}>
                                                            <p className="text-sm text-zinc-500">{(answer as any).questionLabel}</p>
                                                            <div className="text-white">
                                                                {renderAnswerValue((answer as any).value)}
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    ))
                                )}
                            </div>
                        )}
                    </>
                )}
            </div>
        </div >
    )
}
