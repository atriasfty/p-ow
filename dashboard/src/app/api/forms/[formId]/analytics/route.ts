import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/auth-clerk"
import { prisma } from "@/lib/db"
import { isServerAdmin } from "@/lib/admin"

// Helper to check form access
async function canViewAnalytics(user: { id: string, discordId?: string }, formId: string): Promise<boolean> {
    const form = await prisma.form.findUnique({
        where: { id: formId },
        select: { serverId: true, createdBy: true }
    })
    if (!form) return false

    if (form.createdBy === user.id) return true

    const isAdmin = await isServerAdmin(user as any, form.serverId)
    if (isAdmin) return true

    const editorAccess = await prisma.formEditorAccess.findUnique({
        where: { formId_userId: { formId, userId: user.id } }
    })
    return !!editorAccess
}

// GET /api/forms/[formId]/analytics - Get aggregated analytics
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ formId: string }> }
) {
    try {
        const session = await getSession()
        if (!session) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        const { formId } = await params

        const canView = await canViewAnalytics(session.user, formId)
        if (!canView) {
            return NextResponse.json({ error: "Access denied" }, { status: 403 })
        }

        // Get form with questions
        const form = await prisma.form.findUnique({
            where: { id: formId },
            include: {
                sections: {
                    orderBy: { order: "asc" },
                    include: {
                        questions: { orderBy: { order: "asc" } }
                    }
                },
                _count: { select: { responses: true } }
            }
        })

        if (!form) {
            return NextResponse.json({ error: "Form not found" }, { status: 404 })
        }

        // Get all answers grouped by question
        const allQuestions = form.sections.flatMap((s: any) => s.questions)

        const analytics: Record<string, any> = {}

        for (const question of allQuestions) {
            const config = JSON.parse(question.config || "{}")

            // Get all answers for this question (only from completed responses)
            const answers = await prisma.formAnswer.findMany({
                where: {
                    questionId: question.id,
                    response: { status: "completed" }
                },
                select: { value: true }
            })

            // Aggregate based on question type
            switch (question.type) {
                case "multiple_choice":
                case "dropdown": {
                    // Count occurrences of each option
                    const counts: Record<string, number> = {}
                    for (const opt of config.options || []) {
                        counts[opt] = 0
                    }
                    for (const a of answers) {
                        try {
                            // Extract actual value from JSON-stored string
                            const val = typeof a.value === 'string' && (a.value.startsWith('"') || a.value.startsWith('['))
                                ? JSON.parse(a.value)
                                : a.value

                            if (counts[val] !== undefined) {
                                counts[val]++
                            } else if (val) {
                                counts[val] = 1
                            }
                        } catch {
                            // Fallback to raw value if parsing fails
                            if (counts[a.value] !== undefined) {
                                counts[a.value]++
                            } else {
                                counts[a.value] = 1
                            }
                        }
                    }
                    analytics[question.id] = {
                        type: "distribution",
                        chartTypes: ["bar", "pie"],
                        data: Object.entries(counts).map(([label, value]) => ({ label, value })),
                        total: answers.length
                    }
                    break
                }

                case "checkbox": {
                    // Count each selected option
                    const counts: Record<string, number> = {}
                    for (const opt of config.options || []) {
                        counts[opt] = 0
                    }
                    for (const a of answers) {
                        try {
                            const selected = JSON.parse(a.value)
                            if (Array.isArray(selected)) {
                                for (const s of selected) {
                                    if (counts[s] !== undefined) {
                                        counts[s]++
                                    } else {
                                        counts[s] = 1
                                    }
                                }
                            }
                        } catch { }
                    }
                    analytics[question.id] = {
                        type: "distribution",
                        chartTypes: ["bar"],
                        data: Object.entries(counts).map(([label, value]) => ({ label, value })),
                        total: answers.length
                    }
                    break
                }

                case "scale": {
                    // Calculate average and distribution
                    const values = answers.map((a: any) => parseInt(a.value)).filter((v: any) => !isNaN(v))
                    const avg = values.length > 0 ? values.reduce((a: number, b: number) => a + b, 0) / values.length : 0

                    const distribution: Record<number, number> = {}
                    const min = config.min || 1
                    const max = config.max || 10
                    for (let i = min; i <= max; i++) {
                        distribution[i] = 0
                    }
                    for (const v of values) {
                        if (distribution[v] !== undefined) {
                            distribution[v]++
                        }
                    }

                    analytics[question.id] = {
                        type: "scale",
                        chartTypes: ["bar"],
                        average: Math.round(avg * 100) / 100,
                        data: Object.entries(distribution).map(([label, value]) => ({ label, value })),
                        total: values.length
                    }
                    break
                }

                case "short_text":
                case "long_text": {
                    // Just count responses
                    analytics[question.id] = {
                        type: "text",
                        total: answers.length,
                        // Include sample of recent responses
                        samples: answers.slice(0, 5).map((a: any) => a.value)
                    }
                    break
                }

                case "date": {
                    // Group by month
                    const byMonth: Record<string, number> = {}
                    for (const a of answers) {
                        try {
                            const date = new Date(a.value)
                            const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`
                            byMonth[key] = (byMonth[key] || 0) + 1
                        } catch { }
                    }
                    analytics[question.id] = {
                        type: "date",
                        chartTypes: ["bar"],
                        data: Object.entries(byMonth).sort().map(([label, value]) => ({ label, value })),
                        total: answers.length
                    }
                    break
                }

                case "file_upload": {
                    analytics[question.id] = {
                        type: "file",
                        total: answers.length
                    }
                    break
                }

                default:
                    analytics[question.id] = {
                        type: "unknown",
                        total: answers.length
                    }
            }

            analytics[question.id].questionLabel = question.label
            analytics[question.id].questionType = question.type
        }

        // Get timeline data (only completed responses)
        const responses = await prisma.formResponse.findMany({
            where: { formId, status: "completed" },
            select: { submittedAt: true },
            orderBy: { submittedAt: "asc" }
        })

        const timeline: Record<string, number> = {}
        for (const r of responses) {
            const date = r.submittedAt.toISOString().split("T")[0]
            timeline[date] = (timeline[date] || 0) + 1
        }

        // Count only completed responses
        const totalCompleted = await prisma.formResponse.count({ where: { formId, status: "completed" } })

        return NextResponse.json({
            formId: form.id,
            formTitle: form.title,
            totalResponses: totalCompleted,
            questionAnalytics: analytics,
            responseTimeline: Object.entries(timeline).map(([date, count]) => ({ date, count }))
        })
    } catch (error) {
        console.error("[ANALYTICS GET]", error)
        return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
}
