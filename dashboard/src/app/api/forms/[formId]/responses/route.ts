import { NextRequest, NextResponse } from "next/server"
import { clerkClient } from "@clerk/nextjs/server"
import { getSession } from "@/lib/auth-clerk"
import { prisma } from "@/lib/db"
import { isServerAdmin } from "@/lib/admin"

// Helper to check form access
async function canViewResponses(user: { id: string, discordId?: string }, formId: string): Promise<boolean> {
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

// GET /api/forms/[formId]/responses - Get all responses
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

        const canView = await canViewResponses(session.user, formId)
        if (!canView) {
            return NextResponse.json({ error: "Access denied" }, { status: 403 })
        }

        const { searchParams } = new URL(request.url)
        const page = parseInt(searchParams.get("page") || "1")
        const limit = parseInt(searchParams.get("limit") || "50")
        const format = searchParams.get("format") // "json" or "csv"

        // Get form to check anonymity settings
        const form = await prisma.form.findUnique({
            where: { id: formId },
            include: {
                sections: {
                    orderBy: { order: "asc" },
                    include: {
                        questions: { orderBy: { order: "asc" } }
                    }
                }
            }
        })

        if (!form) {
            return NextResponse.json({ error: "Form not found" }, { status: 404 })
        }

        const responses = await prisma.formResponse.findMany({
            where: { formId, status: "completed" }, // Only show completed submissions, not drafts
            include: {
                answers: {
                    include: { question: true }
                }
            },
            orderBy: { submittedAt: "desc" },
            skip: (page - 1) * limit,
            take: limit
        })

        const total = await prisma.formResponse.count({ where: { formId, status: "completed" } })

        // Collect respondent IDs
        const respondentIds = responses
            .map((r: any) => r.respondentId)
            .filter((id: string | null): id is string => id !== null)

        // Fetch user details from Clerk
        const users = respondentIds.length > 0
            ? await (await clerkClient()).users.getUserList({ userId: respondentIds, limit: 100 })
            : { data: [] }

        // Map users to Roblox username
        const userMap = new Map(users.data.map(u => {
            const roblox = u.externalAccounts.find(a =>
                a.provider === "oauth_custom_roblox" || a.provider === "roblox"
            )
            return [u.id, {
                username: roblox?.username || u.username || "Unknown",
                robloxUsername: roblox?.username,
                email: u.emailAddresses[0]?.emailAddress
            }]
        }))

        // Format responses
        const formattedResponses = responses.map((r: any) => {
            const user = r.respondentId ? userMap.get(r.respondentId) : null

            return {
                id: r.id,
                submittedAt: r.submittedAt,
                respondent: form.isAnonymous ? { name: "Anonymous" } : (user ? {
                    id: r.respondentId,
                    email: user.email,
                    name: user.robloxUsername || user.username
                } : { name: "Anonymous" }),
                answers: r.answers.reduce((acc: Record<string, any>, a: any) => {
                    let value
                    try {
                        value = JSON.parse(a.value)
                    } catch {
                        value = a.value
                    }
                    acc[a.questionId] = {
                        questionLabel: a.question.label,
                        value
                    }
                    return acc
                }, {} as Record<string, any>)
            }
        })

        // Export as CSV
        if (format === "csv") {
            // Check feature flags and plan limits
            const { isServerFeatureEnabled } = await import("@/lib/feature-flags")
            const { getServerPlan } = await import("@/lib/subscription")

            const exportsEnabled = await isServerFeatureEnabled('EXPORTS', form.serverId)
            const { hasExports } = await getServerPlan(form.serverId)

            if (!exportsEnabled || !hasExports) {
                return NextResponse.json({
                    error: "CSV export is available on paid plans only.",
                    upgradeRequired: true
                }, { status: 403 })
            }
            const allQuestions = form.sections.flatMap((s: any) => s.questions)
            const headers = [
                "Response ID",
                "Submitted At",
                ...(form.isAnonymous ? [] : ["Respondent ID", "Email", "Name"]),
                ...allQuestions.map((q: any) => q.label)
            ]

            const rows = formattedResponses.map((r: any) => {
                const row = [
                    r.id,
                    r.submittedAt.toISOString(),
                    ...(form.isAnonymous ? [] : [r.respondent?.id || "", r.respondent?.email || "", r.respondent?.name || ""])
                ]
                for (const q of allQuestions) {
                    const answer = r.answers[q.id]
                    const value = answer?.value
                    row.push(typeof value === "object" ? JSON.stringify(value) : String(value ?? ""))
                }
                return row
            })

            const csv = [
                headers.join(","),
                ...rows.map((r: any[]) => r.map((cell: any) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
            ].join("\n")

            return new NextResponse(csv, {
                headers: {
                    "Content-Type": "text/csv",
                    "Content-Disposition": `attachment; filename="${form.title.replace(/[^a-z0-9]/gi, "_")}_responses.csv"`
                }
            })
        }

        return NextResponse.json({
            responses: formattedResponses,
            pagination: {
                page,
                limit,
                total,
                pages: Math.ceil(total / limit)
            },
            form: {
                id: form.id,
                title: form.title,
                isAnonymous: form.isAnonymous
            }
        })
    } catch (error) {
        console.error("[RESPONSES GET]", error)
        return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
}

// DELETE /api/forms/[formId]/responses - Delete response(s)
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ formId: string }> }
) {
    try {
        const session = await getSession()
        if (!session) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        const { formId } = await params

        const canView = await canViewResponses(session.user, formId)
        if (!canView) {
            return NextResponse.json({ error: "Access denied" }, { status: 403 })
        }

        const { searchParams } = new URL(request.url)
        const responseId = searchParams.get("responseId")
        const deleteAll = searchParams.get("deleteAll") === "true"

        if (deleteAll) {
            // Delete all responses for this form
            const deleted = await prisma.formResponse.deleteMany({
                where: { formId }
            })
            return NextResponse.json({
                success: true,
                deleted: deleted.count,
                message: `Deleted ${deleted.count} responses`
            })
        }

        if (responseId) {
            // Delete single response
            const response = await prisma.formResponse.findUnique({
                where: { id: responseId },
                select: { formId: true }
            })

            if (!response || response.formId !== formId) {
                return NextResponse.json({ error: "Response not found" }, { status: 404 })
            }

            await prisma.formResponse.delete({
                where: { id: responseId }
            })

            return NextResponse.json({
                success: true,
                message: "Response deleted"
            })
        }

        return NextResponse.json({ error: "Specify responseId or deleteAll=true" }, { status: 400 })
    } catch (error) {
        console.error("[RESPONSES DELETE]", error)
        return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
}
