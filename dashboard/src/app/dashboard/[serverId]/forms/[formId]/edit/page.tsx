"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, Save, Trash2, Plus, GripVertical, Settings2, Eye, Share2, Copy, Check, ExternalLink, BarChart3, ChevronUp, ChevronDown, UserMinus, Loader2 } from "lucide-react"
import { useDialog } from "@/components/providers/dialog-provider"
import { LiveEditorProvider, useLiveEditor } from "@/components/forms/live-editor-provider"
import { LiveCursors } from "@/components/forms/live-cursors"
import { ActiveEditorsAvatar } from "@/components/forms/active-editors-avatar"
import * as Y from "yjs"

interface Question {
    id: string
    type: string
    label: string
    description: string | null
    required: boolean
    config: Record<string, any>
    conditions: Record<string, any>
    order: number
}

interface Section {
    id: string
    title: string
    description: string | null
    order: number
    questions: Question[]
}

interface Form {
    id: string
    title: string
    description: string | null
    bannerUrl: string | null
    status: string
    requiresAuth: boolean
    isAnonymous: boolean
    allowMultiple: boolean
    isApplication: boolean
    acceptedRoleId: string | null
    recruitmentChannelId: string | null
    congratsChannelId: string | null
    maxResponses: number | null
    expiresAt: string | null
    notifyChannelId: string | null
    publicShareId: string
    editorShareId: string
    sections: Section[]
    thankYouMessage: string | null
    requiredRoleIds: string[] // Parsed from JSON
    ignoredRoleIds: string[]  // Parsed from JSON
    _count: { responses: number }
}

interface DiscordRole {
    id: string
    name: string
    color: number
}

interface DiscordChannel {
    id: string
    name: string
}

const QUESTION_TYPES = [
    { value: "short_text", label: "Short Answer", icon: "📝" },
    { value: "long_text", label: "Long Answer", icon: "📄" },
    { value: "multiple_choice", label: "Multiple Choice", icon: "○" },
    { value: "checkbox", label: "Checkboxes", icon: "☑" },
    { value: "dropdown", label: "Dropdown", icon: "▼" },
    { value: "scale", label: "Scale (1-10)", icon: "📊" },
    { value: "date", label: "Date", icon: "📅" },
    { value: "time", label: "Time", icon: "🕐" },
    { value: "file_upload", label: "File Upload", icon: "📎" },
]

export default function EditFormPageWrapper({
    params,
}: {
    params: Promise<{ serverId: string; formId: string }>
}) {
    const [resolvedParams, setResolvedParams] = useState<{ serverId: string; formId: string } | null>(null)
    
    useEffect(() => {
        params.then(p => setResolvedParams(p))
    }, [params])

    if (!resolvedParams) return (
        <div className="min-h-screen bg-[#111] flex items-center justify-center">
            <Loader2 className="h-6 w-6 text-zinc-500 animate-spin" />
        </div>
    )

    return (
        <LiveEditorProvider formId={resolvedParams.formId}>
            <EditFormInner params={params} resolvedParams={resolvedParams} />
        </LiveEditorProvider>
    )
}

function EditFormInner({
    params,
    resolvedParams
}: {
    params: Promise<{ serverId: string; formId: string }>
    resolvedParams: { serverId: string; formId: string }
}) {
    const router = useRouter()
    const [form, setForm] = useState<Form | null>(null)
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [lastSaved, setLastSaved] = useState<Date | null>(null)
    const [error, setError] = useState("")
    const [showSettings, setShowSettings] = useState(false)
    const [openAddMenu, setOpenAddMenu] = useState<string | null>(null) // sectionId
    const [copied, setCopied] = useState<string | null>(null)
    const { showConfirm } = useDialog()
    const { doc, connected } = useLiveEditor()

    const [availableRoles, setAvailableRoles] = useState<DiscordRole[]>([])
    const [availableChannels, setAvailableChannels] = useState<DiscordChannel[]>([])

    const [editors, setEditors] = useState<{ userId: string; grantedAt: string; robloxUsername?: string; imageUrl?: string }[]>([])
    const [loadingEditors, setLoadingEditors] = useState(false)

    useEffect(() => {
        loadForm(resolvedParams.formId)
        loadDiscordData(resolvedParams.serverId)
    }, [resolvedParams])

    // --- YJS Syncing Logic ---
    useEffect(() => {
        if (!doc) return
        const yMap = doc.getMap("formState")

        const handleSync = (event: Y.YEvent<any>, transaction: Y.Transaction) => {
            if (!transaction.local) {
                const updatedForm = yMap.get("data") as Form | undefined
                if (updatedForm) setForm(updatedForm)
            }
        }

        yMap.observe(handleSync)
        return () => yMap.unobserve(handleSync)
    }, [doc])

    const broadcastFormState = (newState: Form) => {
        if (!doc) return
        const yMap = doc.getMap("formState")
        doc.transact(() => {
            yMap.set("data", newState)
        }, "local")
    }

    useEffect(() => {
        if (showSettings && resolvedParams) {
            fetchEditors()
        }
    }, [showSettings, resolvedParams])

    const fetchEditors = async () => {
        if (!resolvedParams) return
        setLoadingEditors(true)
        try {
            const res = await fetch(`/api/forms/editor-access?formId=${resolvedParams.formId}&listAll=true`)
            if (res.ok) {
                setEditors(await res.json())
            }
        } catch (e) {
            console.error("Failed to fetch editors", e)
        } finally {
            setLoadingEditors(false)
        }
    }

    const removeEditor = async (userId: string) => {
        if (!resolvedParams || !form) return
        const confirmed = await showConfirm("Remove Editor", `Are you sure you want to remove edit access for this user?`, "Remove", "destructive")
        if (!confirmed) return

        try {
            const res = await fetch(`/api/forms/editor-access?formId=${form.id}&userId=${userId}`, {
                method: "DELETE"
            })
            if (res.ok) {
                setEditors(prev => prev.filter(e => e.userId !== userId))
            }
        } catch (e) {
            console.error("Failed to remove editor", e)
        }
    }

    const loadDiscordData = async (serverId: string) => {
        try {
            const [rolesRes, channelsRes] = await Promise.all([
                fetch(`/api/discord/roles?serverId=${serverId}`),
                fetch(`/api/discord/channels?serverId=${serverId}`)
            ])

            if (rolesRes.ok) setAvailableRoles(await rolesRes.json())
            if (channelsRes.ok) setAvailableChannels(await channelsRes.json())
        } catch (e) {
            console.error("Failed to load Discord data", e)
        }
    }

    const safeJSONParse = (str: any, fallback: any) => {
        if (!str) return fallback
        try {
            return typeof str === "string" ? JSON.parse(str) : str
        } catch {
            return fallback
        }
    }

    const loadForm = async (formId: string) => {
        try {
            const res = await fetch(`/api/forms/${formId}`)
            if (!res.ok) throw new Error("Failed to load form")
            const data = await res.json()

            const parsedForm: Form = {
                ...data,
                sections: data.sections.map((s: Section) => ({
                    ...s,
                    questions: s.questions.map((q: Question) => ({
                        ...q,
                        config: safeJSONParse(q.config, {}),
                        conditions: safeJSONParse(q.conditions, {})
                    }))
                })),
                requiredRoleIds: safeJSONParse(data.requiredRoleIds, []),
                ignoredRoleIds: safeJSONParse(data.ignoredRoleIds, [])
            }
            setForm(parsedForm)
            
            // Initial seed to Yjs if we are the first to load
            if (doc) {
                const yMap = doc.getMap("formState")
                if (!yMap.has("data")) {
                    yMap.set("data", parsedForm)
                } else {
                    // We join an existing session, adopt their state instead of our DB load
                    setForm(yMap.get("data") as Form)
                }
            }
        } catch (e: any) {
            setError(e.message)
        } finally {
            setLoading(false)
        }
    }

    const saveForm = async (updates: Partial<Form>) => {
        if (!form || !resolvedParams) return
        setSaving(true)
        try {
            const res = await fetch(`/api/forms/${form.id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(updates)
            })
            if (!res.ok) throw new Error("Failed to save")
            const data = await res.json()

            const parsedForm: Form = {
                ...data,
                sections: data.sections.map((s: any) => ({
                    ...s,
                    questions: s.questions.map((q: any) => ({
                        ...q,
                        config: safeJSONParse(q.config, {}),
                        conditions: safeJSONParse(q.conditions, {})
                    }))
                })),
                requiredRoleIds: safeJSONParse(data.requiredRoleIds, []),
                ignoredRoleIds: safeJSONParse(data.ignoredRoleIds, [])
            }
            setForm(parsedForm)
            broadcastFormState(parsedForm)
        } catch (e: any) {
            setError(e.message)
        } finally {
            setSaving(false)
        }
    }

    const addSection = async () => {
        if (!form) return
        try {
            const res = await fetch(`/api/forms/${form.id}/sections`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ title: `Section ${form.sections.length + 1}` })
            })
            if (res.ok) await loadForm(form.id)
        } catch { }
    }

    const updateSection = async (sectionId: string, updates: { title?: string; description?: string }) => {
        if (!form) return
        try {
            await fetch(`/api/forms/${form.id}/sections`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ sectionId, ...updates })
            })
            const newForm = {
                ...form,
                sections: form.sections.map(s =>
                    s.id === sectionId ? { ...s, ...updates } : s
                )
            }
            setForm(newForm)
            broadcastFormState(newForm)
        } catch { }
    }

    const deleteSection = async (sectionId: string) => {
        if (!form || form.sections.length <= 1) return
        try {
            await fetch(`/api/forms/${form.id}/sections?sectionId=${sectionId}`, { method: "DELETE" })
            await loadForm(form.id)
        } catch { }
    }

    const addQuestion = async (sectionId: string, type: string) => {
        if (!form) return
        const typeInfo = QUESTION_TYPES.find(t => t.value === type)
        const defaultConfig: Record<string, any> = {}
        if (type === "multiple_choice" || type === "checkbox" || type === "dropdown") {
            defaultConfig.options = ["Option 1", "Option 2"]
        } else if (type === "scale") {
            defaultConfig.min = 1
            defaultConfig.max = 10
        }

        try {
            await fetch(`/api/forms/${form.id}/questions`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    sectionId,
                    type,
                    label: typeInfo?.label || "Question",
                    config: defaultConfig
                })
            })
            await loadForm(form.id)
        } catch { }
    }

    const questionUpdateTimeouts = useRef<Record<string, NodeJS.Timeout>>({})

    const updateQuestion = (questionId: string, updates: Partial<Question>) => {
        if (!form) return

        // 1. Optimistic Update (Immediate UI response)
        const newForm = {
            ...form,
            sections: form.sections.map(s => ({
                ...s,
                questions: s.questions.map(q =>
                    q.id === questionId ? { ...q, ...updates } : q
                )
            }))
        }
        setForm(newForm)
        broadcastFormState(newForm)

        // 2. Debounced Network Call
        if (questionUpdateTimeouts.current[questionId]) {
            clearTimeout(questionUpdateTimeouts.current[questionId])
        }

        setSaving(true)
        questionUpdateTimeouts.current[questionId] = setTimeout(async () => {
            try {
                const res = await fetch(`/api/forms/${form.id}/questions`, {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ questionId, ...updates })
                })

                if (res.ok) {
                    setLastSaved(new Date())
                }
            } catch (err) {
                console.error("Failed to save question", err)
            } finally {
                setSaving(false)
                delete questionUpdateTimeouts.current[questionId]
            }
        }, 1000) // 1s debounce
    }

    const deleteQuestion = async (questionId: string) => {
        if (!form) return
        try {
            await fetch(`/api/forms/${form.id}/questions?questionId=${questionId}`, { method: "DELETE" })
            await loadForm(form.id)
        } catch { }
    }

    const copyToClipboard = (text: string, type: string) => {
        navigator.clipboard.writeText(text)
        setCopied(type)
        setTimeout(() => setCopied(null), 2000)
    }

    const moveQuestion = async (questionId: string, direction: "up" | "down") => {
        if (!form) return

        // Find current section and question
        let sectionIndex = -1
        let questionIndex = -1
        for (let i = 0; i < form.sections.length; i++) {
            const idx = form.sections[i].questions.findIndex(q => q.id === questionId)
            if (idx !== -1) {
                sectionIndex = i
                questionIndex = idx
                break
            }
        }

        if (sectionIndex === -1 || questionIndex === -1) return

        const questions = [...form.sections[sectionIndex].questions]
        const newIndex = direction === "up" ? questionIndex - 1 : questionIndex + 1

        if (newIndex < 0 || newIndex >= questions.length) return

        // Swap
        const [moved] = questions.splice(questionIndex, 1)
        questions.splice(newIndex, 0, moved)

        // Update orders
        const updatedQuestions = questions.map((q, i) => ({ ...q, order: i }))

        // Optimistic update
        const updatedSections = [...form.sections]
        updatedSections[sectionIndex] = { ...updatedSections[sectionIndex], questions: updatedQuestions }
        const newForm = { ...form, sections: updatedSections }
        setForm(newForm)
        broadcastFormState(newForm)

        // Save to server
        try {
            await fetch(`/api/forms/${form.id}/questions`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    questions: updatedQuestions.map(q => ({ id: q.id, order: q.order }))
                })
            })
        } catch (e) {
            console.error("Failed to reorder questions", e)
            loadForm(form.id) // Rollback
        }
    }

    const moveSection = async (sectionId: string, direction: "up" | "down") => {
        if (!form) return

        const sectionIndex = form.sections.findIndex(s => s.id === sectionId)
        if (sectionIndex === -1) return

        const newIndex = direction === "up" ? sectionIndex - 1 : sectionIndex + 1
        if (newIndex < 0 || newIndex >= form.sections.length) return

        const sections = [...form.sections]
        const [moved] = sections.splice(sectionIndex, 1)
        sections.splice(newIndex, 0, moved)

        // Update orders
        const updatedSections = sections.map((s, i) => ({ ...s, order: i }))

        // Optimistic update
        const newForm = { ...form, sections: updatedSections }
        setForm(newForm)
        broadcastFormState(newForm)

        // Save to server
        try {
            await fetch(`/api/forms/${form.id}/sections`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    sections: updatedSections.map(s => ({ id: s.id, order: s.order }))
                })
            })
        } catch (e) {
            console.error("Failed to reorder sections", e)
            loadForm(form.id) // Rollback
        }
    }

    const deleteForm = async () => {
        if (!form || !resolvedParams) return
        const confirmed = await showConfirm("Delete Form", "Are you sure you want to delete this form? All responses will be lost.", "Delete", "destructive")
        if (!confirmed) return
        try {
            await fetch(`/api/forms/${form.id}`, { method: "DELETE" })
            router.push(`/dashboard/${resolvedParams.serverId}/forms`)
        } catch { }
    }

    if (loading) {
        return (
            <div className="min-h-screen bg-[#111] flex items-center justify-center">
                <div className="text-zinc-400">Loading...</div>
            </div>
        )
    }

    if (error || !form || !resolvedParams) {
        return (
            <div className="min-h-screen bg-[#111] flex items-center justify-center">
                <div className="text-red-400">{error || "Form not found"}</div>
            </div>
        )
    }

    const publicUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/forms/${form.publicShareId}`
    const editorUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/forms/editor/${form.editorShareId}`

    return (
        <div className="min-h-screen bg-[#111]">
            {/* Header */}
            <div className="sticky top-0 z-10 bg-[#111]/95 backdrop-blur border-b border-[#333] px-6 py-4">
                <div className="max-w-4xl mx-auto flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Link href={`/dashboard/${resolvedParams.serverId}/forms`} className="text-zinc-400 hover:text-white">
                            <ArrowLeft className="h-5 w-5" />
                        </Link>
                        <div>
                            <input
                                type="text"
                                value={form.title}
                                onChange={(e) => {
                                    const nf = { ...form, title: e.target.value }
                                    setForm(nf)
                                    broadcastFormState(nf)
                                }}
                                onBlur={() => saveForm({ title: form.title })}
                                className="bg-transparent text-lg font-semibold text-white outline-none"
                            />
                            <div className="flex items-center gap-3 text-sm">
                                <span className={`px-2 py-0.5 rounded text-xs ${form.status === "published" ? "bg-emerald-500/20 text-emerald-400" :
                                    form.status === "closed" ? "bg-red-500/20 text-red-400" :
                                        "bg-amber-500/20 text-amber-400"
                                    }`}>
                                    {form.status}
                                </span>
                                {form._count && <span className="text-zinc-500">{form._count.responses} responses</span>}
                                <div className="w-px h-3 bg-[#333]"></div>
                                {saving ? (
                                    <span className="text-indigo-400 animate-pulse">Saving...</span>
                                ) : lastSaved ? (
                                    <span className="text-zinc-500 flex items-center gap-1">
                                        <Check className="h-3 w-3" /> Saved {lastSaved.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                ) : (
                                    <span className="text-zinc-600">All changes saved</span>
                                )}
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <ActiveEditorsAvatar />
                        <Link
                            href={`/dashboard/${resolvedParams.serverId}/forms/${form.id}/responses`}
                            className="flex items-center gap-2 px-3 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg text-sm transition-colors"
                        >
                            <BarChart3 className="h-4 w-4" />
                            Results
                        </Link>
                        <button
                            onClick={() => setShowSettings(!showSettings)}
                            className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors whitespace-nowrap ${showSettings ? "bg-indigo-600 text-white" : "bg-zinc-800 text-zinc-400 hover:text-white"}`}
                        >
                            <Settings2 className="h-4 w-4" />
                            <span className="hidden sm:inline">Settings</span>
                        </button>
                        <select
                            value={form.status}
                            onChange={(e) => saveForm({ status: e.target.value })}
                            className="px-3 py-2 bg-zinc-800 text-white rounded-lg text-sm outline-none"
                        >
                            <option value="draft">Draft</option>
                            <option value="published">Published</option>
                            <option value="closed">Closed</option>
                        </select>
                    </div>
                </div>
            </div>

            <div className="max-w-4xl mx-auto p-6 space-y-6 relative">
                <LiveCursors />
                
                {showSettings ? (
                    <div className="bg-[#1a1a1a] border border-[#333] rounded-xl p-6 space-y-6">
                        <div className="flex items-center justify-between">
                            <h3 className="text-lg font-semibold text-white">Form Settings</h3>
                            <button
                                onClick={() => setShowSettings(false)}
                                className="text-sm text-zinc-400 hover:text-white"
                            >
                                Close Settings
                            </button>
                        </div>

                        {/* Sharing */}
                        <div className="space-y-4">
                            <div className="space-y-3">
                                <h4 className="text-sm font-medium text-zinc-400">Share Links</h4>
                                <div className="space-y-2">
                                    <p className="text-sm text-white mb-1">Public Link</p>
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="text"
                                            readOnly
                                            value={publicUrl}
                                            className="flex-1 bg-[#222] px-3 py-2 rounded text-sm text-zinc-300 outline-none"
                                        />
                                        <button
                                            onClick={() => copyToClipboard(publicUrl, "public")}
                                            className="p-2 bg-zinc-700 hover:bg-zinc-600 rounded"
                                        >
                                            {copied === "public" ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4 text-zinc-400" />}
                                        </button>
                                        <a href={publicUrl} target="_blank" className="p-2 bg-zinc-700 hover:bg-zinc-600 rounded">
                                            <ExternalLink className="h-4 w-4 text-zinc-400" />
                                        </a>
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <p className="text-sm text-white mb-1">Editor Link (Grants edit access)</p>
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="text"
                                            readOnly
                                            value={editorUrl}
                                            className="flex-1 bg-[#222] px-3 py-2 rounded text-sm text-zinc-300 outline-none"
                                        />
                                        <button
                                            onClick={() => copyToClipboard(editorUrl, "editor")}
                                            className="p-2 bg-zinc-700 hover:bg-zinc-600 rounded"
                                        >
                                            {copied === "editor" ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4 text-zinc-400" />}
                                        </button>
                                    </div>
                                    <p className="text-xs text-zinc-600">Editor link grants edit access to POW users who open it</p>
                                </div>
                            </div>

                            {/* Current Editors */}
                            <div className="space-y-3 pt-4 border-t border-[#333]">
                                <h4 className="text-sm font-medium text-white flex items-center gap-2">
                                    <Share2 className="h-4 w-4 text-indigo-400" />
                                    Current Editors
                                </h4>
                                {loadingEditors ? (
                                    <div className="text-xs text-zinc-500 animate-pulse">Loading editors...</div>
                                ) : editors.length === 0 ? (
                                    <div className="text-xs text-zinc-600 italic">No additional editors added yet.</div>
                                ) : (
                                    <div className="space-y-2">
                                        {editors.map((editor: { userId: string; grantedAt: string; robloxUsername?: string; imageUrl?: string }) => (
                                            <div key={editor.userId} className="flex items-center justify-between bg-[#222] p-3 rounded-lg border border-[#333]">
                                                <div className="flex items-center gap-3">
                                                    {editor.imageUrl ? (
                                                        <img
                                                            src={editor.imageUrl}
                                                            alt=""
                                                            className="w-8 h-8 rounded-full object-cover border border-zinc-700"
                                                        />
                                                    ) : (
                                                        <div className="w-8 h-8 rounded-full bg-indigo-500/20 flex items-center justify-center text-xs text-indigo-400 font-medium">
                                                            {(editor.robloxUsername || editor.userId).slice(0, 2).toUpperCase()}
                                                        </div>
                                                    )}
                                                    <div>
                                                        <p className="text-sm text-white font-medium">{editor.robloxUsername || editor.userId}</p>
                                                        <p className="text-[10px] text-zinc-500">Added {new Date(editor.grantedAt).toLocaleDateString()}</p>
                                                    </div>
                                                </div>
                                                <button
                                                    onClick={() => removeEditor(editor.userId)}
                                                    className="p-2 text-zinc-500 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors"
                                                    title="Remove access"
                                                >
                                                    <UserMinus className="h-4 w-4" />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                                <div className="border-t border-[#333] pt-2 mt-4" />
                            </div>
                        </div>

                        {/* Options Grid */}
                        <div className="grid grid-cols-2 gap-4">
                            <label className="flex items-center gap-3 bg-[#222] p-3 rounded-lg cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={form.requiresAuth}
                                    onChange={(e) => {
                                        const nf = { ...form, requiresAuth: e.target.checked }
                                        setForm(nf)
                                        broadcastFormState(nf)
                                        saveForm({ requiresAuth: e.target.checked })
                                    }}
                                    className="rounded"
                                />
                                <div>
                                    <p className="text-sm text-white">Require login</p>
                                    <p className="text-xs text-zinc-500">Users must have POW account</p>
                                </div>
                            </label>
                            <label className="flex items-center gap-3 bg-[#222] p-3 rounded-lg cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={form.isAnonymous}
                                    onChange={(e) => {
                                        const nf = { ...form, isAnonymous: e.target.checked }
                                        setForm(nf)
                                        broadcastFormState(nf)
                                        saveForm({ isAnonymous: e.target.checked })
                                    }}
                                    className="rounded"
                                />
                                <div>
                                    <p className="text-sm text-white">Anonymous responses</p>
                                    <p className="text-xs text-zinc-500">Hide respondent identity</p>
                                </div>
                            </label>
                            <label className="flex items-center gap-3 bg-[#222] p-3 rounded-lg cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={form.allowMultiple}
                                    onChange={(e) => saveForm({ allowMultiple: e.target.checked })}
                                    className="rounded"
                                />
                                <div>
                                    <p className="text-sm text-white">Allow multiple</p>
                                    <p className="text-xs text-zinc-500">Users can submit more than once</p>
                                </div>
                            </label>
                            <div className="bg-[#222] p-3 rounded-lg">
                                <p className="text-sm text-white mb-1">Max responses</p>
                                <input
                                    type="number"
                                    value={form.maxResponses || ""}
                                    onChange={(e) => saveForm({ maxResponses: e.target.value ? parseInt(e.target.value) : null })}
                                    placeholder="Unlimited"
                                    className="w-full bg-[#1a1a1a] px-2 py-1 rounded text-sm text-white outline-none"
                                />
                            </div>
                        </div>

                        {/* Expiration */}
                        <div className="bg-[#222] p-3 rounded-lg">
                            <p className="text-sm text-white mb-2">Expiration date</p>
                            <input
                                type="datetime-local"
                                value={form.expiresAt ? new Date(form.expiresAt).toISOString().slice(0, 16) : ""}
                                onChange={(e) => saveForm({ expiresAt: e.target.value || null })}
                                className="bg-[#1a1a1a] px-3 py-2 rounded text-sm text-white outline-none"
                            />
                        </div>

                        {/* Discord Integration */}
                        <div className="space-y-4 pt-4 border-t border-[#333]">
                            <h4 className="text-sm font-medium text-white">Discord Integration</h4>

                            {/* Notification Channel */}
                            <div className="bg-[#222] p-3 rounded-lg">
                                <p className="text-sm text-white mb-2">Notification Channel</p>
                                <select
                                    value={form.notifyChannelId || ""}
                                    onChange={(e) => {
                                        const val = e.target.value || null
                                        setForm({ ...form, notifyChannelId: val })
                                        saveForm({ notifyChannelId: val })
                                    }}
                                    className="w-full bg-[#1a1a1a] px-3 py-2 rounded text-sm text-white outline-none"
                                >
                                    <option value="">Select a channel...</option>
                                    {availableChannels.map(c => (
                                        <option key={c.id} value={c.id}>#{c.name}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Role Gating */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {/* ... (Required Roles and Ignored Roles UI) ... */}
                            </div>

                            {/* Recruitment Workflow */}
                            <div className="space-y-4 pt-4 border-t border-[#333]">
                                <label className="flex items-center gap-3 bg-[#222] p-3 rounded-lg cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={form.isApplication}
                                        onChange={(e) => {
                                            setForm({ ...form, isApplication: e.target.checked })
                                            saveForm({ isApplication: e.target.checked })
                                        }}
                                        className="rounded"
                                    />
                                    <div>
                                        <p className="text-sm text-white font-medium">Recruitment Application</p>
                                        <p className="text-xs text-zinc-500">Enable recruitment workflow (Review → Approval → Role Grant)</p>
                                    </div>
                                </label>

                                {form.isApplication && (
                                    <div className="pl-4 space-y-4 border-l-2 border-indigo-500/30 animate-in fade-in slide-in-from-left-2 duration-300">
                                        <div className="bg-[#222] p-3 rounded-lg">
                                            <p className="text-sm text-white mb-2">Recruitment Review Channel</p>
                                            <select
                                                value={form.recruitmentChannelId || ""}
                                                onChange={(e) => {
                                                    const val = e.target.value || null
                                                    setForm({ ...form, recruitmentChannelId: val })
                                                    saveForm({ recruitmentChannelId: val })
                                                }}
                                                className="w-full bg-[#1a1a1a] px-3 py-2 rounded text-sm text-white outline-none"
                                            >
                                                <option value="">Select a channel...</option>
                                                {availableChannels.map(c => (
                                                    <option key={c.id} value={c.id}>#{c.name}</option>
                                                ))}
                                            </select>
                                            <p className="text-[10px] text-zinc-500 mt-1">Where admins review submitted applications</p>
                                        </div>

                                        <div className="bg-[#222] p-3 rounded-lg">
                                            <p className="text-sm text-white mb-2">Staff Role to Grant</p>
                                            <select
                                                value={form.acceptedRoleId || ""}
                                                onChange={(e) => {
                                                    const val = e.target.value || null
                                                    setForm({ ...form, acceptedRoleId: val })
                                                    saveForm({ acceptedRoleId: val })
                                                }}
                                                className="w-full bg-[#1a1a1a] px-3 py-2 rounded text-sm text-white outline-none"
                                            >
                                                <option value="">Select a role...</option>
                                                {availableRoles.map(r => (
                                                    <option key={r.id} value={r.id}>{r.name}</option>
                                                ))}
                                            </select>
                                            <p className="text-[10px] text-zinc-500 mt-1">Role automatically granted upon approval</p>
                                        </div>

                                        <div className="bg-[#222] p-3 rounded-lg">
                                            <p className="text-sm text-white mb-2">Celebration Channel</p>
                                            <select
                                                value={form.congratsChannelId || ""}
                                                onChange={(e) => {
                                                    const val = e.target.value || null
                                                    setForm({ ...form, congratsChannelId: val })
                                                    saveForm({ congratsChannelId: val })
                                                }}
                                                className="w-full bg-[#1a1a1a] px-3 py-2 rounded text-sm text-white outline-none"
                                            >
                                                <option value="">Select a channel...</option>
                                                {availableChannels.map(c => (
                                                    <option key={c.id} value={c.id}>#{c.name}</option>
                                                ))}
                                            </select>
                                            <p className="text-[10px] text-zinc-500 mt-1">Where promotions/approvals are publicly announced</p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Post-Submission */}
                        <div className="space-y-4 pt-4 border-t border-[#333]">
                            <h4 className="text-sm font-medium text-white">Post-Submission</h4>
                            <div className="bg-[#222] p-3 rounded-lg">
                                <p className="text-sm text-white mb-2">Custom Thank You Message</p>
                                <textarea
                                    value={form.thankYouMessage || ""}
                                    onChange={(e) => {
                                        const nf = { ...form, thankYouMessage: e.target.value || null }
                                        setForm(nf)
                                        broadcastFormState(nf)
                                    }}
                                    onBlur={() => saveForm({ thankYouMessage: form.thankYouMessage })}
                                    placeholder="Thanks for submitting! We have received your response."
                                    className="w-full bg-[#1a1a1a] px-3 py-2 rounded text-sm text-white outline-none resize-none"
                                    rows={2}
                                />
                            </div>
                        </div>

                        {/* Delete */}
                        <button
                            onClick={deleteForm}
                            className="flex items-center gap-2 px-4 py-2 bg-red-600/20 hover:bg-red-600/30 text-red-400 rounded-lg text-sm"
                        >
                            <Trash2 className="h-4 w-4" />
                            Delete Form
                        </button>
                    </div>
                ) : (
                    <>
                        {/* Description */}
                        <div className="bg-[#1a1a1a] border border-[#333] rounded-xl p-4">
                            <textarea
                                value={form.description || ""}
                                onChange={(e) => {
                                    const nf = { ...form, description: e.target.value }
                                    setForm(nf)
                                    broadcastFormState(nf)
                                }}
                                onBlur={() => saveForm({ description: form.description })}
                                placeholder="Add a description..."
                                className="w-full bg-transparent text-zinc-400 placeholder:text-zinc-600 outline-none resize-none"
                                rows={2}
                            />
                        </div>

                        {/* Sections */}
                        {form.sections.map((section) => (
                            <div key={section.id} className="bg-[#1a1a1a] border border-[#333] rounded-xl overflow-hidden">
                                <div className="flex items-center gap-3 p-4 border-b border-[#333] bg-[#222]">
                                    <div className="flex flex-col gap-1">
                                        <button
                                            onClick={() => moveSection(section.id, "up")}
                                            className="text-zinc-600 hover:text-white"
                                        >
                                            <ChevronUp className="h-4 w-4" />
                                        </button>
                                        <button
                                            onClick={() => moveSection(section.id, "down")}
                                            className="text-zinc-600 hover:text-white"
                                        >
                                            <ChevronDown className="h-4 w-4" />
                                        </button>
                                    </div>
                                    <input
                                        type="text"
                                        value={section.title}
                                        onChange={(e) => updateSection(section.id, { title: e.target.value })}
                                        className="flex-1 bg-transparent text-lg font-semibold text-white outline-none"
                                    />
                                    {form.sections.length > 1 && (
                                        <button onClick={() => deleteSection(section.id)} className="p-2 text-zinc-500 hover:text-red-400">
                                            <Trash2 className="h-4 w-4" />
                                        </button>
                                    )}
                                </div>

                                <div className="px-4 py-2 border-b border-[#333]">
                                    <input
                                        type="text"
                                        placeholder="Section description (optional)"
                                        value={section.description || ""}
                                        onChange={(e) => updateSection(section.id, { description: e.target.value })}
                                        className="w-full bg-transparent text-sm text-zinc-400 placeholder:text-zinc-600 outline-none"
                                    />
                                </div>

                                <div className="p-4 space-y-4">
                                    {section.questions.map((q: any) => (
                                        <QuestionCard
                                            key={q.id}
                                            question={q}
                                            allQuestions={form.sections.flatMap((s: any) => s.questions.filter((qq: any) => qq.id !== q.id))}
                                            onUpdate={(updates: Partial<Question>) => updateQuestion(q.id, updates)}
                                            onDelete={() => deleteQuestion(q.id)}
                                            onMove={(dir: "up" | "down") => moveQuestion(q.id, dir)}
                                        />
                                    ))}

                                    <div className="relative">
                                        <button
                                            onClick={() => setOpenAddMenu(openAddMenu === section.id ? null : section.id)}
                                            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm transition-colors shadow-lg shadow-indigo-500/20"
                                        >
                                            <Plus className="h-4 w-4" />
                                            Add Question
                                        </button>

                                        {openAddMenu === section.id && (
                                            <>
                                                <div
                                                    className="fixed inset-0 z-10"
                                                    onClick={() => setOpenAddMenu(null)}
                                                />
                                                <div className="absolute bottom-full left-0 mb-2 w-48 bg-[#1a1a1a] border border-[#333] rounded-xl shadow-2xl py-2 z-20 overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-200">
                                                    {QUESTION_TYPES.map((type) => (
                                                        <button
                                                            key={type.value}
                                                            onClick={() => {
                                                                addQuestion(section.id, type.value)
                                                                setOpenAddMenu(null)
                                                            }}
                                                            className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-zinc-400 hover:text-white hover:bg-white/5 transition-colors group/item"
                                                        >
                                                            <span className="text-lg grayscale group-hover/item:grayscale-0">{type.icon}</span>
                                                            {type.label}
                                                        </button>
                                                    ))}
                                                </div>
                                            </>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}

                        <button
                            onClick={addSection}
                            className="w-full flex items-center justify-center gap-2 p-4 border-2 border-dashed border-[#333] hover:border-[#555] rounded-xl text-zinc-500 hover:text-white transition-colors"
                        >
                            Add Section
                        </button>
                    </>
                )
                }
            </div >
        </div >
    )
}

function QuestionCard({
    question,
    allQuestions,
    onUpdate,
    onDelete,
    onMove
}: {
    question: Question
    allQuestions: Question[]
    onUpdate: (updates: Partial<Question>) => void
    onDelete: () => void
    onMove: (direction: "up" | "down") => void
}) {
    const [showConditions, setShowConditions] = useState(!!question.conditions?.showIf)

    const updateOption = (index: number, value: string) => {
        const options = [...(question.config.options || [])]
        options[index] = value
        onUpdate({ config: { ...question.config, options } })
    }

    const addOption = () => {
        const options = [...(question.config.options || []), `Option ${(question.config.options?.length || 0) + 1}`]
        onUpdate({ config: { ...question.config, options } })
    }

    const removeOption = (index: number) => {
        const options = [...(question.config.options || [])]
        options.splice(index, 1)
        onUpdate({ config: { ...question.config, options } })
    }

    return (
        <div className="bg-[#252525] border border-[#3a3a3a] rounded-lg p-4 space-y-3">
            <div className="flex items-start gap-3">
                <div className="flex flex-col gap-0.5 mt-1">
                    <button
                        onClick={() => onMove("up")}
                        className="text-zinc-600 hover:text-white"
                    >
                        <ChevronUp className="h-4 w-4" />
                    </button>
                    <button
                        onClick={() => onMove("down")}
                        className="text-zinc-600 hover:text-white"
                    >
                        <ChevronDown className="h-4 w-4" />
                    </button>
                </div>
                <div className="flex-1 space-y-2">
                    <input
                        type="text"
                        value={question.label}
                        onChange={(e) => onUpdate({ label: e.target.value })}
                        className="w-full bg-transparent text-white font-medium outline-none"
                    />
                    <input
                        type="text"
                        value={question.description || ""}
                        onChange={(e) => onUpdate({ description: e.target.value })}
                        className="w-full bg-transparent text-sm text-zinc-500 outline-none"
                        placeholder="Description (optional)"
                    />
                </div>
                <button
                    onClick={() => setShowConditions(!showConditions)}
                    className={`p-2 rounded ${showConditions ? "bg-indigo-600 text-white" : "text-zinc-500 hover:text-white"}`}
                >
                    <Settings2 className="h-4 w-4" />
                </button>
                <button onClick={onDelete} className="p-2 text-zinc-500 hover:text-red-400">
                    <Trash2 className="h-4 w-4" />
                </button>
            </div>

            {(question.type === "multiple_choice" || question.type === "checkbox" || question.type === "dropdown") && (
                <div className="pl-7 space-y-2">
                    {(question.config.options || []).map((opt: string, i: number) => (
                        <div key={i} className="flex items-center gap-2">
                            <span className="text-zinc-500">{question.type === "checkbox" ? "☐" : "○"}</span>
                            <input
                                type="text"
                                value={opt}
                                onChange={(e) => updateOption(i, e.target.value)}
                                className="flex-1 bg-[#1a1a1a] px-3 py-1.5 rounded text-sm text-white outline-none"
                            />
                            <button onClick={() => removeOption(i)} className="text-zinc-600 hover:text-red-400">
                                <Trash2 className="h-3 w-3" />
                            </button>
                        </div>
                    ))}
                    <button onClick={addOption} className="flex items-center gap-1 text-sm text-zinc-500 hover:text-white">
                        <Plus className="h-3 w-3" /> Add option
                    </button>
                </div>
            )}

            {question.type === "scale" && (
                <div className="pl-7 flex items-center gap-4 text-sm">
                    <label className="text-zinc-500">
                        Min:
                        <input
                            type="number"
                            value={question.config.min || 1}
                            onChange={(e) => onUpdate({ config: { ...question.config, min: parseInt(e.target.value) } })}
                            className="ml-2 w-16 bg-[#1a1a1a] px-2 py-1 rounded text-white outline-none"
                        />
                    </label>
                    <label className="text-zinc-500">
                        Max:
                        <input
                            type="number"
                            value={question.config.max || 10}
                            onChange={(e) => onUpdate({ config: { ...question.config, max: parseInt(e.target.value) } })}
                            className="ml-2 w-16 bg-[#1a1a1a] px-2 py-1 rounded text-white outline-none"
                        />
                    </label>
                </div>
            )}

            {showConditions && (
                <div className="pl-7 pt-2 border-t border-[#3a3a3a] space-y-2">
                    <p className="text-xs text-zinc-500">Show this question if:</p>
                    <div className="flex items-center gap-2 text-sm flex-wrap">
                        <select
                            value={question.conditions?.showIf?.questionId || ""}
                            onChange={(e) => onUpdate({
                                conditions: e.target.value ? {
                                    showIf: { questionId: e.target.value, operator: "equals", value: "" }
                                } : {}
                            })}
                            className="bg-[#1a1a1a] px-3 py-1.5 rounded text-white outline-none"
                        >
                            <option value="">Always show</option>
                            {allQuestions.map(q => (
                                <option key={q.id} value={q.id}>{q.label}</option>
                            ))}
                        </select>
                        {question.conditions?.showIf?.questionId && (
                            <>
                                <select
                                    value={question.conditions.showIf.operator}
                                    onChange={(e) => onUpdate({
                                        conditions: { showIf: { ...question.conditions.showIf, operator: e.target.value } }
                                    })}
                                    className="bg-[#1a1a1a] px-3 py-1.5 rounded text-white outline-none"
                                >
                                    <option value="equals">equals</option>
                                    <option value="not_equals">does not equal</option>
                                    <option value="contains">contains</option>
                                </select>
                                <input
                                    type="text"
                                    value={question.conditions.showIf.value}
                                    onChange={(e) => onUpdate({
                                        conditions: { showIf: { ...question.conditions.showIf, value: e.target.value } }
                                    })}
                                    placeholder="Value"
                                    className="flex-1 min-w-[100px] bg-[#1a1a1a] px-3 py-1.5 rounded text-white outline-none"
                                />
                            </>
                        )}
                    </div>
                </div>
            )}

            <div className="pl-7 pt-2 border-t border-[#3a3a3a] flex items-center justify-between">
                <span className="text-xs text-zinc-600">{QUESTION_TYPES.find(t => t.value === question.type)?.label}</span>
                <label className="flex items-center gap-2 text-sm text-zinc-400">
                    <input
                        type="checkbox"
                        checked={question.required}
                        onChange={(e) => onUpdate({ required: e.target.checked })}
                        className="rounded"
                    />
                    Required
                </label>
            </div>
        </div>
    )
}
