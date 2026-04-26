import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/auth-clerk"
import { prisma } from "@/lib/db"
import { isServerAdmin } from "@/lib/admin"

// Helper to check form edit access
async function canEditForm(userId: string, formId: string): Promise<boolean> {
    const form = await prisma.form.findUnique({
        where: { id: formId },
        select: { serverId: true, createdBy: true }
    })
    if (!form) return false

    // Check if user is creator
    // @ts-ignore - createdBy is selected implicitly or we need to select it
    if (form.createdBy === userId) return true

    const isAdmin = await isServerAdmin({ id: userId } as any, form.serverId)
    if (isAdmin) return true

    const editorAccess = await prisma.formEditorAccess.findUnique({
        where: { formId_userId: { formId, userId } }
    })
    return !!editorAccess
}

// Question types enum for validation
const QUESTION_TYPES = [
    "short_text",
    "long_text",
    "multiple_choice",
    "checkbox",
    "dropdown",
    "scale",
    "date",
    "time",
    "file_upload"
] as const

// POST /api/forms/[formId]/questions - Add question
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ formId: string }> }
) {
    try {
        const session = await getSession()
        if (!session) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        const { formId } = await params

        const canEdit = await canEditForm(session.user.id, formId)
        if (!canEdit) {
            return NextResponse.json({ error: "Access denied" }, { status: 403 })
        }

        const body = await request.json()
        const { sectionId, type, label, description, required, config, conditions } = body

        if (!sectionId || !type || !label) {
            return NextResponse.json({ error: "sectionId, type, and label are required" }, { status: 400 })
        }

        if (!QUESTION_TYPES.includes(type)) {
            return NextResponse.json({ error: `Invalid type. Must be one of: ${QUESTION_TYPES.join(", ")}` }, { status: 400 })
        }

        // Get max order for this section
        const lastQuestion = await prisma.formQuestion.findFirst({
            where: { sectionId },
            orderBy: { order: "desc" }
        })

        const question = await prisma.formQuestion.create({
            data: {
                sectionId,
                type,
                label,
                description: description || null,
                required: required ?? false,
                order: (lastQuestion?.order ?? -1) + 1,
                config: config ? JSON.stringify(config) : "{}",
                conditions: conditions ? JSON.stringify(conditions) : "{}"
            }
        })

        return NextResponse.json({
            ...question,
            config: JSON.parse(question.config),
            conditions: JSON.parse(question.conditions)
        }, { status: 201 })
    } catch (error) {
        console.error("[QUESTIONS POST]", error)
        return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
}

// PUT /api/forms/[formId]/questions - Update question or reorder
export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ formId: string }> }
) {
    try {
        const session = await getSession()
        if (!session) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        const { formId } = await params

        const canEdit = await canEditForm(session.user.id, formId)
        if (!canEdit) {
            return NextResponse.json({ error: "Access denied" }, { status: 403 })
        }

        const body = await request.json()

        // Batch reorder: { questions: [{ id, order, sectionId? }] }
        if (body.questions && Array.isArray(body.questions)) {
            const ids: string[] = body.questions.map((q: { id: string }) => q.id)
            const validCount = await prisma.formQuestion.count({
                where: { id: { in: ids }, section: { formId } }
            })
            if (validCount !== ids.length) {
                return NextResponse.json({ error: "One or more questions do not belong to this form" }, { status: 403 })
            }
            await prisma.$transaction(
                body.questions.map((q: { id: string; order: number; sectionId?: string }) =>
                    prisma.formQuestion.update({
                        where: { id: q.id },
                        data: {
                            order: q.order,
                            ...(q.sectionId && { sectionId: q.sectionId })
                        }
                    })
                )
            )
            return NextResponse.json({ success: true })
        }

        // Update single question
        if (body.questionId) {
            const { questionId, type, label, description, required, config, conditions } = body

            if (type && !QUESTION_TYPES.includes(type)) {
                return NextResponse.json({ error: `Invalid type. Must be one of: ${QUESTION_TYPES.join(", ")}` }, { status: 400 })
            }

            const belongs = await prisma.formQuestion.findFirst({
                where: { id: questionId, section: { formId } }
            })
            if (!belongs) {
                return NextResponse.json({ error: "Question not found" }, { status: 404 })
            }

            const question = await prisma.formQuestion.update({
                where: { id: questionId },
                data: {
                    ...(type !== undefined && { type }),
                    ...(label !== undefined && { label }),
                    ...(description !== undefined && { description }),
                    ...(required !== undefined && { required }),
                    ...(config !== undefined && { config: JSON.stringify(config) }),
                    ...(conditions !== undefined && { conditions: JSON.stringify(conditions) })
                }
            })

            return NextResponse.json({
                ...question,
                config: JSON.parse(question.config),
                conditions: JSON.parse(question.conditions)
            })
        }

        return NextResponse.json({ error: "Invalid request" }, { status: 400 })
    } catch (error) {
        console.error("[QUESTIONS PUT]", error)
        return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
}

// DELETE /api/forms/[formId]/questions?questionId=xxx
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
        const { searchParams } = new URL(request.url)
        const questionId = searchParams.get("questionId")

        if (!questionId) {
            return NextResponse.json({ error: "questionId is required" }, { status: 400 })
        }

        const canEdit = await canEditForm(session.user.id, formId)
        if (!canEdit) {
            return NextResponse.json({ error: "Access denied" }, { status: 403 })
        }

        const belongs = await prisma.formQuestion.findFirst({
            where: { id: questionId, section: { formId } }
        })
        if (!belongs) {
            return NextResponse.json({ error: "Question not found" }, { status: 404 })
        }

        await prisma.formQuestion.delete({ where: { id: questionId } })

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error("[QUESTIONS DELETE]", error)
        return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
}
