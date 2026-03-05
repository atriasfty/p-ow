"use client"

import { useState, useEffect, use, useRef } from "react"
import { useRouter } from "next/navigation"
import { useUser, SignInButton, UserButton } from "@clerk/nextjs"
import { FileText, Upload, X, Check, AlertCircle, ChevronDown, Loader2 } from "lucide-react"

interface Question {
    id: string
    type: string
    label: string
    description: string | null
    required: boolean
    config: Record<string, any>
    conditions: Record<string, any>
}

interface Section {
    id: string
    title: string
    description: string | null
    questions: Question[]
}

interface Form {
    id: string
    title: string
    description: string | null
    bannerUrl: string | null
    requiresAuth: boolean
    isAnonymous: boolean
    sections: Section[]
    maxResponses: number | null
    responseCount: number
    hasSubmitted: boolean
    draftResponseId: string | null
    draftAnswers: Record<string, any> | null
    server: { name: string; customName: string | null; bannerUrl: string | null }
}

export default function PublicFormPage({
    params,
}: {
    params: Promise<{ shareId: string }>
}) {
    const { shareId } = use(params)
    const router = useRouter()
    const { isSignedIn, isLoaded } = useUser()
    const [form, setForm] = useState<Form | null>(null)
    const [answers, setAnswers] = useState<Record<string, any>>({})
    const [responseId, setResponseId] = useState<string | null>(null)
    const [loading, setLoading] = useState(true)
    const [submitting, setSubmitting] = useState(false)
    const [error, setError] = useState("")
    const [submitted, setSubmitted] = useState(false)
    const [validationErrors, setValidationErrors] = useState<Record<string, string>>({})
    const [savingDraft, setSavingDraft] = useState(false)
    const [lastSaved, setLastSaved] = useState<Date | null>(null)
    const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null)

    useEffect(() => {
        loadForm()
    }, [shareId])

    // Autosave Effect - only for authenticated users (anonymous users would create duplicate drafts)
    useEffect(() => {
        // Skip autosave for anonymous users since we can't track their drafts
        if (!isSignedIn || !form || submitted || submitting || Object.keys(answers).length === 0) return

        if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)

        setSavingDraft(true)
        saveTimeoutRef.current = setTimeout(async () => {
            try {
                const res = await fetch(`/api/forms/${form.id}/submit`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ answers, saveAsDraft: true, responseId })
                })
                if (res.ok) {
                    const data = await res.json()
                    if (data.responseId) setResponseId(data.responseId)
                    setLastSaved(new Date())
                }
            } catch (err) {
                console.error("Failed to autosave", err)
            } finally {
                setSavingDraft(false)
            }
        }, 2000) // 2s debounce

        return () => {
            if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
        }
    }, [answers, form, submitted, submitting, isSignedIn, responseId])

    const loadForm = async () => {
        try {
            const res = await fetch(`/api/forms/public/${shareId}`)
            if (!res.ok) {
                const data = await res.json()
                setError(data.error || "Form not found")
            } else {
                const data = await res.json()
                setForm(data)
                if (data.hasSubmitted) {
                    setSubmitted(true)
                }
                // Load draft if exists
                if (data.draftAnswers) {
                    setAnswers(data.draftAnswers)
                    setResponseId(data.draftResponseId)
                    setLastSaved(new Date()) // It was saved previously
                }
            }
        } catch {
            setError("Failed to load form")
        }
        setLoading(false)
    }

    const shouldShowQuestion = (question: Question): boolean => {
        if (!question.conditions?.showIf) return true

        const { questionId, operator, value } = question.conditions.showIf
        const answer = answers[questionId]

        if (answer === undefined || answer === null) return false

        const stringAnswer = Array.isArray(answer) ? answer.join(",") : String(answer)

        switch (operator) {
            case "equals":
                if (Array.isArray(answer)) {
                    return answer.includes(value)
                }
                return String(answer) === value
            case "not_equals":
                if (Array.isArray(answer)) {
                    return !answer.includes(value)
                }
                return String(answer) !== value
            case "contains":
                return stringAnswer.includes(value)
            default:
                return true
        }
    }

    const handleSubmit = async () => {
        if (!form) return

        // Validate required fields
        const errors: Record<string, string> = {}
        for (const section of form.sections) {
            for (const question of section.questions) {
                if (question.required && shouldShowQuestion(question)) {
                    const answer = answers[question.id]
                    if (answer === undefined || answer === null || answer === "" ||
                        (Array.isArray(answer) && answer.length === 0)) {
                        errors[question.id] = "This field is required"
                    }
                }
            }
        }

        if (Object.keys(errors).length > 0) {
            setValidationErrors(errors)
            return
        }

        setSubmitting(true)
        setError("")

        try {
            const res = await fetch(`/api/forms/${form.id}/submit`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ answers, responseId })
            })

            if (!res.ok) {
                const data = await res.json()
                throw new Error(data.error || "Submission failed")
            }

            setSubmitted(true)
        } catch (e: any) {
            setError(e.message)
        } finally {
            setSubmitting(false)
        }
    }

    if (loading) {
        return (
            <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
                <Loader2 className="h-8 w-8 text-indigo-500 animate-spin" />
            </div>
        )
    }

    if (error && !form) {
        return (
            <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-6">
                <div className="bg-[#1a1a1a] border border-[#333] rounded-xl p-8 max-w-md text-center">
                    <AlertCircle className="h-12 w-12 text-red-400 mx-auto mb-4" />
                    <h2 className="text-xl font-bold text-white mb-2">Form Unavailable</h2>
                    <p className="text-zinc-400">{error}</p>
                </div>
            </div>
        )
    }

    if (submitted) {
        return (
            <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-6">
                <div className="bg-[#1a1a1a] border border-[#333] rounded-xl p-8 max-w-md text-center">
                    <div className="h-16 w-16 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Check className="h-8 w-8 text-emerald-400" />
                    </div>
                    <h2 className="text-xl font-bold text-white mb-2">Response Submitted!</h2>
                    <p className="text-zinc-400 mb-6">Thank you for completing this form.</p>
                    <button
                        onClick={() => window.close()}
                        className="px-6 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-colors"
                    >
                        Close
                    </button>
                </div>
            </div>
        )
    }

    if (!form) return null

    // Block form access if login required but not signed in
    if (form.requiresAuth && !isSignedIn && isLoaded) {
        return (
            <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-6">
                <div className="bg-[#1a1a1a] border border-[#333] rounded-xl p-8 max-w-md text-center">
                    <img src="/logo.png" alt="POW" className="h-16 w-16 mx-auto mb-4 opacity-80" />
                    <h2 className="text-xl font-bold text-white mb-2">Login Required</h2>
                    <p className="text-zinc-400 mb-6">You must be signed in to access this form.</p>
                    <SignInButton mode="modal">
                        <button className="px-6 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-lg transition-colors">
                            Sign In to Continue
                        </button>
                    </SignInButton>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-[#0a0a0a] py-8 px-4">
            {/* Auth Header */}
            <div className="max-w-2xl mx-auto mb-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <img src="/logo.png" alt="POW" className="h-8 w-8 opacity-70" />
                    <span className="text-white/70 text-sm font-medium">Project Overwatch</span>
                </div>
                {isLoaded && (
                    isSignedIn ? (
                        <UserButton
                            afterSignOutUrl={`/forms/${shareId}`}
                            appearance={{
                                elements: {
                                    avatarBox: "h-10 w-10"
                                }
                            }}
                        />
                    ) : (
                        <SignInButton mode="modal">
                            <button className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-lg transition-colors">
                                Sign In
                            </button>
                        </SignInButton>
                    )
                )}
            </div>
            <div className="max-w-2xl mx-auto space-y-6">
                {/* Header */}
                <div className="bg-[#1a1a1a] border border-[#333] rounded-xl overflow-hidden">
                    {form.bannerUrl && (
                        <img src={form.bannerUrl} alt="" className="w-full h-32 object-cover" />
                    )}
                    <div className="p-6">
                        <p className="text-sm text-indigo-400 mb-1">{form.server.customName || form.server.name}</p>
                        <h1 className="text-2xl font-bold text-white">{form.title}</h1>
                        {form.description && (
                            <p className="text-zinc-400 mt-2">{form.description}</p>
                        )}


                        {/* Status Bar */}
                        <div className="flex items-center gap-4 mt-4 text-xs">
                            {savingDraft ? (
                                <span className="text-indigo-400 animate-pulse">Saving draft...</span>
                            ) : lastSaved ? (
                                <span className="text-zinc-500 flex items-center gap-1">
                                    <Check className="h-3 w-3" /> Draft saved {lastSaved.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                            ) : null}

                            {form.requiresAuth && (
                                <p className="text-amber-400 flex items-center gap-2 ml-auto">
                                    <AlertCircle className="h-3 w-3" />
                                    Login required
                                </p>
                            )}
                        </div>
                    </div>
                </div>

                {/* Error */}
                {error && (
                    <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-lg">
                        {error}
                    </div>
                )}

                {/* Sections */}
                {form.sections.map((section) => (
                    <div key={section.id} className="bg-[#1a1a1a] border border-[#333] rounded-xl p-6 space-y-6">
                        <div>
                            <h2 className="text-lg font-semibold text-white">{section.title}</h2>
                            {section.description && (
                                <p className="text-sm text-zinc-500 mt-1">{section.description}</p>
                            )}
                        </div>

                        {section.questions.filter(shouldShowQuestion).map((question) => (
                            <QuestionInput
                                key={question.id}
                                question={question}
                                value={answers[question.id]}
                                onChange={(value) => {
                                    setAnswers({ ...answers, [question.id]: value })
                                    setValidationErrors({ ...validationErrors, [question.id]: "" })
                                }}
                                error={validationErrors[question.id]}
                                formId={form.id}
                            />
                        ))}
                    </div>
                ))}

                {/* Submit */}
                <button
                    onClick={handleSubmit}
                    disabled={submitting}
                    className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-medium rounded-xl transition-colors flex items-center justify-center gap-2"
                >
                    {submitting ? (
                        <>
                            <Loader2 className="h-5 w-5 animate-spin" />
                            Submitting...
                        </>
                    ) : (
                        "Submit"
                    )}
                </button>

                {/* Footer */}
                <p className="text-center text-xs text-zinc-600">
                    © 2026 Project Overwatch - erlc moderation but better™
                </p>
            </div>
        </div>
    )
}

function QuestionInput({
    question,
    value,
    onChange,
    error,
    formId
}: {
    question: Question
    value: any
    onChange: (value: any) => void
    error?: string
    formId: string
}) {
    const [uploading, setUploading] = useState(false)

    // Normalize value to array format
    const files = Array.isArray(value) ? value : (value?.url ? [value] : [])

    const handleFileUpload = async (fileList: FileList) => {
        const filesToUpload = Array.from(fileList)
        const totalFiles = files.length + filesToUpload.length

        if (totalFiles > 20) {
            alert(`You can only upload up to 20 files. Currently have ${files.length}, trying to add ${filesToUpload.length}.`)
            return
        }

        setUploading(true)
        const uploaded: { url: string; filename: string }[] = []

        for (const file of filesToUpload) {
            try {
                const formData = new FormData()
                formData.append("file", file)
                formData.append("formId", formId)

                const res = await fetch("/api/forms/upload", {
                    method: "POST",
                    body: formData
                })

                if (res.ok) {
                    const data = await res.json()
                    uploaded.push({ url: data.url, filename: data.filename })
                }
            } catch { }
        }

        // Append new files to existing ones
        onChange([...files, ...uploaded])
        setUploading(false)
    }

    const removeFile = (index: number) => {
        const newFiles = files.filter((_, i) => i !== index)
        onChange(newFiles.length > 0 ? newFiles : null)
    }

    return (
        <div className="space-y-2">
            <label className="block">
                <span className="text-white font-medium">
                    {question.label}
                    {question.required && <span className="text-red-400 ml-1">*</span>}
                </span>
                {question.description && (
                    <span className="block text-sm text-zinc-500 mt-1">{question.description}</span>
                )}
            </label>

            {question.type === "short_text" && (
                <input
                    type="text"
                    value={value || ""}
                    onChange={(e) => onChange(e.target.value)}
                    className={`w-full bg-[#222] border ${error ? "border-red-500" : "border-[#333]"} rounded-lg px-4 py-3 text-white outline-none focus:border-indigo-500`}
                />
            )}

            {question.type === "long_text" && (
                <textarea
                    value={value || ""}
                    onChange={(e) => onChange(e.target.value)}
                    rows={4}
                    className={`w-full bg-[#222] border ${error ? "border-red-500" : "border-[#333]"} rounded-lg px-4 py-3 text-white outline-none focus:border-indigo-500 resize-none`}
                />
            )}

            {question.type === "multiple_choice" && (
                <div className="space-y-2">
                    {(question.config.options || []).map((opt: string, i: number) => (
                        <label key={i} className="flex items-center gap-3 p-3 bg-[#222] rounded-lg cursor-pointer hover:bg-[#2a2a2a]">
                            <input
                                type="radio"
                                name={question.id}
                                checked={value === opt}
                                onChange={() => onChange(opt)}
                                className="text-indigo-600"
                            />
                            <span className="text-white">{opt}</span>
                        </label>
                    ))}
                </div>
            )}

            {question.type === "checkbox" && (
                <div className="space-y-2">
                    {(question.config.options || []).map((opt: string, i: number) => (
                        <label key={i} className="flex items-center gap-3 p-3 bg-[#222] rounded-lg cursor-pointer hover:bg-[#2a2a2a]">
                            <input
                                type="checkbox"
                                checked={(value || []).includes(opt)}
                                onChange={(e) => {
                                    const current = value || []
                                    if (e.target.checked) {
                                        onChange([...current, opt])
                                    } else {
                                        onChange(current.filter((v: string) => v !== opt))
                                    }
                                }}
                                className="rounded text-indigo-600"
                            />
                            <span className="text-white">{opt}</span>
                        </label>
                    ))}
                </div>
            )}

            {question.type === "dropdown" && (
                <div className="relative">
                    <select
                        value={value || ""}
                        onChange={(e) => onChange(e.target.value)}
                        className={`w-full bg-[#222] border ${error ? "border-red-500" : "border-[#333]"} rounded-lg px-4 py-3 text-white outline-none appearance-none cursor-pointer`}
                    >
                        <option value="">Select an option</option>
                        {(question.config.options || []).map((opt: string, i: number) => (
                            <option key={i} value={opt}>{opt}</option>
                        ))}
                    </select>
                    <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 h-5 w-5 text-zinc-500 pointer-events-none" />
                </div>
            )}

            {question.type === "scale" && (
                <div className="flex gap-2">
                    {Array.from(
                        { length: (question.config.max || 10) - (question.config.min || 1) + 1 },
                        (_, i) => (question.config.min || 1) + i
                    ).map((n) => (
                        <button
                            key={n}
                            onClick={() => onChange(n)}
                            className={`flex-1 py-3 rounded-lg font-medium transition-colors ${value === n
                                ? "bg-indigo-600 text-white"
                                : "bg-[#222] text-zinc-400 hover:bg-[#333]"
                                }`}
                        >
                            {n}
                        </button>
                    ))}
                </div>
            )}

            {question.type === "date" && (
                <input
                    type="date"
                    value={value || ""}
                    onChange={(e) => onChange(e.target.value)}
                    className={`w-full bg-[#222] border ${error ? "border-red-500" : "border-[#333]"} rounded-lg px-4 py-3 text-white outline-none`}
                />
            )}

            {question.type === "time" && (
                <input
                    type="time"
                    value={value || ""}
                    onChange={(e) => onChange(e.target.value)}
                    className={`w-full bg-[#222] border ${error ? "border-red-500" : "border-[#333]"} rounded-lg px-4 py-3 text-white outline-none`}
                />
            )}

            {question.type === "file_upload" && (
                <div className={`border-2 border-dashed ${error ? "border-red-500" : "border-[#333]"} rounded-lg p-6`}>
                    {/* List of uploaded files */}
                    {files.length > 0 && (
                        <div className="space-y-2 mb-4">
                            {files.map((file, index) => (
                                <div key={index} className="flex items-center justify-between bg-[#222] rounded-lg px-3 py-2">
                                    <div className="flex items-center gap-3">
                                        <FileText className="h-5 w-5 text-indigo-400" />
                                        <span className="text-white text-sm truncate max-w-[200px]">{file.filename}</span>
                                    </div>
                                    <button onClick={() => removeFile(index)} className="text-zinc-500 hover:text-red-400">
                                        <X className="h-4 w-4" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Upload more or uploading indicator */}
                    {uploading ? (
                        <div className="flex items-center justify-center gap-2 text-zinc-400">
                            <Loader2 className="h-5 w-5 animate-spin" />
                            Uploading...
                        </div>
                    ) : files.length < 20 ? (
                        <label className="flex flex-col items-center cursor-pointer">
                            <Upload className="h-8 w-8 text-zinc-500 mb-2" />
                            <span className="text-zinc-400">{files.length > 0 ? "Add more files" : "Click to upload"}</span>
                            <span className="text-xs text-zinc-600 mt-1">Max 1GB per file · Up to 20 files</span>
                            <input
                                type="file"
                                multiple
                                className="hidden"
                                onChange={(e) => e.target.files && e.target.files.length > 0 && handleFileUpload(e.target.files)}
                            />
                        </label>
                    ) : (
                        <p className="text-center text-zinc-500 text-sm">Maximum 20 files reached</p>
                    )}
                </div>
            )}

            {error && <p className="text-sm text-red-400">{error}</p>}
        </div>
    )
}
