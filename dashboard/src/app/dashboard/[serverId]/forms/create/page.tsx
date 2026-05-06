"use client"

import { apiFetch } from "@/lib/api-fetch"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft, Plus, Trash2, GripVertical, Save, Eye, Settings2, ArrowUp, ArrowDown } from "lucide-react"
import Link from "next/link"

interface Question {
    id: string
    type: string
    label: string
    description: string
    required: boolean
    config: Record<string, any>
    conditions: Record<string, any>
}

interface Section {
    id: string
    title: string
    description: string
    questions: Question[]
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

export default function CreateFormPage({
    params,
}: {
    params: Promise<{ serverId: string }>
}) {
    const router = useRouter()
    const [title, setTitle] = useState("")
    const [description, setDescription] = useState("")
    const [sections, setSections] = useState<Section[]>([
        { id: "section-1", title: "Section 1", description: "", questions: [] }
    ])
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState("")

    const addSection = () => {
        setSections([...sections, {
            id: `section-${Date.now()}`,
            title: `Section ${sections.length + 1}`,
            description: "",
            questions: []
        }])
    }

    const updateSection = (sectionId: string, updates: Partial<Section>) => {
        setSections(sections.map(s =>
            s.id === sectionId ? { ...s, ...updates } : s
        ))
    }

    const deleteSection = (sectionId: string) => {
        if (sections.length === 1) return
        setSections(sections.filter(s => s.id !== sectionId))
    }

    const addQuestion = (sectionId: string, type: string) => {
        const typeInfo = QUESTION_TYPES.find(t => t.value === type)
        const defaultConfig: Record<string, any> = {}

        if (type === "multiple_choice" || type === "checkbox" || type === "dropdown") {
            defaultConfig.options = ["Option 1", "Option 2"]
        } else if (type === "scale") {
            defaultConfig.min = 1
            defaultConfig.max = 10
        }

        const newQuestion: Question = {
            id: `q-${Date.now()}`,
            type,
            label: typeInfo?.label || "Question",
            description: "",
            required: false,
            config: defaultConfig,
            conditions: {}
        }

        setSections(sections.map(s =>
            s.id === sectionId
                ? { ...s, questions: [...s.questions, newQuestion] }
                : s
        ))
    }

    const updateQuestion = (sectionId: string, questionId: string, updates: Partial<Question>) => {
        setSections(sections.map(s =>
            s.id === sectionId
                ? {
                    ...s,
                    questions: s.questions.map(q =>
                        q.id === questionId ? { ...q, ...updates } : q
                    )
                }
                : s
        ))
    }

    const deleteQuestion = (sectionId: string, questionId: string) => {
        setSections(sections.map(s =>
            s.id === sectionId
                ? { ...s, questions: s.questions.filter(q => q.id !== questionId) }
                : s
        ))
    }

    const moveQuestion = (sectionId: string, questionIndex: number, direction: "up" | "down") => {
        setSections(sections.map(s => {
            if (s.id !== sectionId) return s

            const newQuestions = [...s.questions]
            const targetIndex = direction === "up" ? questionIndex - 1 : questionIndex + 1

            if (targetIndex < 0 || targetIndex >= newQuestions.length) return s

            // Swap
            const temp = newQuestions[questionIndex]
            newQuestions[questionIndex] = newQuestions[targetIndex]
            newQuestions[targetIndex] = temp

            return { ...s, questions: newQuestions }
        }))
    }

    const handleSave = async () => {
        if (!title.trim()) {
            setError("Title is required")
            return
        }

        setSaving(true)
        setError("")

        try {
            const { serverId } = await params

            // Create everything in one go (Atomic)
            const res = await apiFetch("/api/forms", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    serverId,
                    title,
                    description,
                    sections // Send full nested structure
                })
            })

            if (!res.ok) {
                const data = await res.json()
                throw new Error(data.error || "Failed to create form")
            }

            const form = await res.json()
            router.push(`/dashboard/${serverId}/forms/${form.id}/edit`)
        } catch (e: any) {
            setError(e.message || "Failed to save")
        } finally {
            setSaving(false)
        }
    }

    return (
        <div className="min-h-screen bg-[#111]">
            {/* Header */}
            <div className="sticky top-0 z-10 bg-[#111]/95 backdrop-blur border-b border-[#333] px-6 py-4">
                <div className="max-w-4xl mx-auto flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Link href="../forms" className="text-zinc-400 hover:text-white">
                            <ArrowLeft className="h-5 w-5" />
                        </Link>
                        <h1 className="text-lg font-semibold text-white">Create Form</h1>
                    </div>
                    <div className="flex items-center gap-3">
                        {error && <span className="text-sm text-red-400">{error}</span>}
                        <button
                            onClick={handleSave}
                            disabled={saving}
                            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
                        >
                            <Save className="h-4 w-4" />
                            {saving ? "Saving..." : "Save & Continue"}
                        </button>
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="max-w-4xl mx-auto p-6 space-y-6">
                {/* Form Info */}
                <div className="bg-[#1a1a1a] border border-[#333] rounded-xl p-6 space-y-4">
                    <input
                        type="text"
                        placeholder="Form Title"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        className="w-full bg-transparent text-2xl font-bold text-white placeholder:text-zinc-600 outline-none"
                    />
                    <textarea
                        placeholder="Add a description (optional)"
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        className="w-full bg-transparent text-zinc-400 placeholder:text-zinc-600 outline-none resize-none"
                        rows={2}
                    />
                </div>

                {/* Sections */}
                {sections.map((section, sectionIndex) => (
                    <div key={section.id} className="bg-[#1a1a1a] border border-[#333] rounded-xl overflow-hidden">
                        {/* Section Header */}
                        <div className="flex items-center gap-3 p-4 border-b border-[#333] bg-[#222]">
                            <GripVertical className="h-4 w-4 text-zinc-600 cursor-grab" />
                            <input
                                type="text"
                                value={section.title}
                                onChange={(e) => updateSection(section.id, { title: e.target.value })}
                                className="flex-1 bg-transparent text-lg font-semibold text-white outline-none"
                            />
                            {sections.length > 1 && (
                                <button
                                    onClick={() => deleteSection(section.id)}
                                    className="p-2 text-zinc-500 hover:text-red-400 transition-colors"
                                >
                                    <Trash2 className="h-4 w-4" />
                                </button>
                            )}
                        </div>

                        {/* Section Description */}
                        <div className="px-4 py-2 border-b border-[#333]">
                            <input
                                type="text"
                                placeholder="Section description (optional)"
                                value={section.description}
                                onChange={(e) => updateSection(section.id, { description: e.target.value })}
                                className="w-full bg-transparent text-sm text-zinc-400 placeholder:text-zinc-600 outline-none"
                            />
                        </div>

                        {/* Questions */}
                        <div className="p-4 space-y-4">
                            {section.questions.map((question, qIndex) => (
                                <QuestionEditor
                                    key={question.id}
                                    question={question}
                                    allQuestions={sections.flatMap(s => s.questions.filter(q => q.id !== question.id))}
                                    onUpdate={(updates) => updateQuestion(section.id, question.id, updates)}
                                    onDelete={() => deleteQuestion(section.id, question.id)}
                                    onMove={(dir) => moveQuestion(section.id, qIndex, dir)}
                                    isFirst={qIndex === 0}
                                    isLast={qIndex === section.questions.length - 1}
                                />
                            ))}

                            {/* Add Question */}
                            <div className="flex flex-wrap gap-2 pt-2">
                                {QUESTION_TYPES.map((type) => (
                                    <button
                                        key={type.value}
                                        onClick={() => addQuestion(section.id, type.value)}
                                        className="flex items-center gap-2 px-3 py-2 bg-[#222] hover:bg-[#333] text-zinc-400 hover:text-white rounded-lg text-sm transition-colors"
                                    >
                                        <span>{type.icon}</span>
                                        {type.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                ))}

                {/* Add Section */}
                <button
                    onClick={addSection}
                    className="w-full flex items-center justify-center gap-2 p-4 border-2 border-dashed border-[#333] hover:border-[#555] rounded-xl text-zinc-500 hover:text-white transition-colors"
                >
                    <Plus className="h-5 w-5" />
                    Add Section
                </button>
            </div>
        </div>
    )
}

// Question Editor Component
function QuestionEditor({
    question,
    allQuestions,
    onUpdate,
    onDelete,
    onMove,
    isFirst,
    isLast
}: {
    question: Question
    allQuestions: Question[]
    onUpdate: (updates: Partial<Question>) => void
    onDelete: () => void
    onMove: (direction: "up" | "down") => void
    isFirst: boolean
    isLast: boolean
}) {
    const [showConditions, setShowConditions] = useState(false)

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
            {/* Question Header */}
            <div className="flex items-start gap-3">
                <GripVertical className="h-4 w-4 text-zinc-600 mt-2 cursor-grab" />
                <div className="flex-1 space-y-2">
                    <input
                        type="text"
                        value={question.label}
                        onChange={(e) => onUpdate({ label: e.target.value })}
                        className="w-full bg-transparent text-white font-medium outline-none"
                        placeholder="Question"
                    />
                    <input
                        type="text"
                        value={question.description}
                        onChange={(e) => onUpdate({ description: e.target.value })}
                        className="w-full bg-transparent text-sm text-zinc-500 outline-none"
                        placeholder="Description (optional)"
                    />
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => onMove("up")}
                        disabled={isFirst}
                        className="p-2 text-zinc-500 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                        title="Move Up"
                    >
                        <ArrowUp className="h-4 w-4" />
                    </button>
                    <button
                        onClick={() => onMove("down")}
                        disabled={isLast}
                        className="p-2 text-zinc-500 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                        title="Move Down"
                    >
                        <ArrowDown className="h-4 w-4" />
                    </button>
                    <div className="w-px h-4 bg-[#333] mx-1"></div>
                    <button
                        onClick={() => setShowConditions(!showConditions)}
                        className={`p-2 rounded transition-colors ${showConditions ? "bg-indigo-600 text-white" : "text-zinc-500 hover:text-white"}`}
                        title="Conditional logic"
                    >
                        <Settings2 className="h-4 w-4" />
                    </button>
                    <button
                        onClick={onDelete}
                        className="p-2 text-zinc-500 hover:text-red-400 transition-colors"
                    >
                        <Trash2 className="h-4 w-4" />
                    </button>
                </div>
            </div>

            {/* Type-specific config */}
            {(question.type === "multiple_choice" || question.type === "checkbox" || question.type === "dropdown") && (
                <div className="pl-7 space-y-2">
                    {(question.config.options || []).map((option: string, i: number) => (
                        <div key={i} className="flex items-center gap-2">
                            <span className="text-zinc-500">
                                {question.type === "checkbox" ? "☐" : "○"}
                            </span>
                            <input
                                type="text"
                                value={option}
                                onChange={(e) => updateOption(i, e.target.value)}
                                className="flex-1 bg-[#1a1a1a] px-3 py-1.5 rounded text-sm text-white outline-none"
                            />
                            <button
                                onClick={() => removeOption(i)}
                                className="text-zinc-600 hover:text-red-400"
                            >
                                <Trash2 className="h-3 w-3" />
                            </button>
                        </div>
                    ))}
                    <button
                        onClick={addOption}
                        className="flex items-center gap-1 text-sm text-zinc-500 hover:text-white"
                    >
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

            {/* Conditional Logic */}
            {showConditions && (
                <div className="pl-7 pt-2 border-t border-[#3a3a3a] space-y-2">
                    <p className="text-xs text-zinc-500">Show this question if:</p>
                    <div className="flex items-center gap-2 text-sm">
                        <select
                            value={question.conditions?.showIf?.questionId || ""}
                            onChange={(e) => onUpdate({
                                conditions: e.target.value ? {
                                    showIf: {
                                        questionId: e.target.value,
                                        operator: question.conditions?.showIf?.operator || "equals",
                                        value: question.conditions?.showIf?.value || ""
                                    }
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
                                        conditions: {
                                            showIf: { ...question.conditions.showIf, operator: e.target.value }
                                        }
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
                                        conditions: {
                                            showIf: { ...question.conditions.showIf, value: e.target.value }
                                        }
                                    })}
                                    placeholder="Value"
                                    className="flex-1 bg-[#1a1a1a] px-3 py-1.5 rounded text-white outline-none"
                                />
                            </>
                        )}
                    </div>
                </div>
            )}

            {/* Footer */}
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
