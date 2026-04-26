import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/auth-clerk"
import { prisma } from "@/lib/db"
import { isServerAdmin } from "@/lib/admin"

// Helper to check form edit access
async function canEditForm(userId: string, formId: string): Promise<boolean> {
    const form = await prisma.form.findUnique({
        where: { id: formId },
        select: { serverId: true }
    })
    if (!form) return false

    const isAdmin = await isServerAdmin({ id: userId } as any, form.serverId)
    if (isAdmin) return true

    const editorAccess = await prisma.formEditorAccess.findUnique({
        where: { formId_userId: { formId, userId } }
    })
    return !!editorAccess
}

// POST /api/forms/[formId]/sections - Add section
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
        const { title, description } = body

        // Get max order
        const lastSection = await prisma.formSection.findFirst({
            where: { formId },
            orderBy: { order: "desc" }
        })

        const section = await prisma.formSection.create({
            data: {
                formId,
                title: title || "New Section",
                description: description || null,
                order: (lastSection?.order ?? -1) + 1
            },
            include: { questions: true }
        })

        return NextResponse.json(section, { status: 201 })
    } catch (error) {
        console.error("[SECTIONS POST]", error)
        return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
}

// PUT /api/forms/[formId]/sections - Reorder sections or update a section
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

        // Batch reorder: { sections: [{ id, order }] }
        if (body.sections && Array.isArray(body.sections)) {
            const ids: string[] = body.sections.map((s: { id: string }) => s.id)
            const validCount = await prisma.formSection.count({
                where: { id: { in: ids }, formId }
            })
            if (validCount !== ids.length) {
                return NextResponse.json({ error: "One or more sections do not belong to this form" }, { status: 403 })
            }
            await prisma.$transaction(
                body.sections.map((s: { id: string; order: number }) =>
                    prisma.formSection.update({
                        where: { id: s.id },
                        data: { order: s.order }
                    })
                )
            )
            return NextResponse.json({ success: true })
        }

        // Update single section: { sectionId, title, description }
        if (body.sectionId) {
            const belongs = await prisma.formSection.findFirst({
                where: { id: body.sectionId, formId }
            })
            if (!belongs) {
                return NextResponse.json({ error: "Section not found" }, { status: 404 })
            }
            const section = await prisma.formSection.update({
                where: { id: body.sectionId },
                data: {
                    ...(body.title !== undefined && { title: body.title }),
                    ...(body.description !== undefined && { description: body.description })
                }
            })
            return NextResponse.json(section)
        }

        return NextResponse.json({ error: "Invalid request" }, { status: 400 })
    } catch (error) {
        console.error("[SECTIONS PUT]", error)
        return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
}

// DELETE /api/forms/[formId]/sections?sectionId=xxx
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
        const sectionId = searchParams.get("sectionId")

        if (!sectionId) {
            return NextResponse.json({ error: "sectionId is required" }, { status: 400 })
        }

        const canEdit = await canEditForm(session.user.id, formId)
        if (!canEdit) {
            return NextResponse.json({ error: "Access denied" }, { status: 403 })
        }

        const belongs = await prisma.formSection.findFirst({ where: { id: sectionId, formId } })
        if (!belongs) {
            return NextResponse.json({ error: "Section not found" }, { status: 404 })
        }

        await prisma.formSection.delete({ where: { id: sectionId } })

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error("[SECTIONS DELETE]", error)
        return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
}
