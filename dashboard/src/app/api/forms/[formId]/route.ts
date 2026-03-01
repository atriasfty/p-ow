import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/auth-clerk"
import { prisma } from "@/lib/db"
import { isServerAdmin } from "@/lib/admin"
import { verifyCsrf } from "@/lib/auth-permissions"

// Helper to check form access
async function canEditForm(userId: string, formId: string): Promise<boolean> {
    const form = await prisma.form.findUnique({
        where: { id: formId },
        select: { serverId: true, createdBy: true }
    })
    if (!form) return false

    // Check if user is creator
    if (form.createdBy === userId) return true

    // Check if user is server admin
    const isAdmin = await isServerAdmin({ id: userId } as any, form.serverId)
    if (isAdmin) return true

    // Check if user has editor access
    const editorAccess = await prisma.formEditorAccess.findUnique({
        where: { formId_userId: { formId, userId } }
    })
    return !!editorAccess
}

// GET /api/forms/[formId] - Get form details with sections and questions
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ formId: string }> }
) {
    try {
        const { formId } = await params

        const form = await prisma.form.findUnique({
            where: { id: formId },
            include: {
                sections: {
                    orderBy: { order: "asc" },
                    include: {
                        questions: {
                            orderBy: { order: "asc" }
                        }
                    }
                },
                _count: { select: { responses: true } }
            }
        })

        if (!form) {
            return NextResponse.json({ error: "Form not found" }, { status: 404 })
        }

        // For public forms, anyone can view (for filling)
        // For draft/closed forms, need edit access
        if (form.status !== "published") {
            const session = await getSession()
            if (!session) {
                return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
            }

            const canEdit = await canEditForm(session.user.id, formId)
            if (!canEdit) {
                return NextResponse.json({ error: "Access denied" }, { status: 403 })
            }
        }

        return NextResponse.json(form)
    } catch (error) {
        console.error("[FORM GET]", error)
        return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
}

// PUT /api/forms/[formId] - Update form settings
export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ formId: string }> }
) {
    if (!verifyCsrf(request)) {
        return new NextResponse("Forbidden: CSRF verification failed", { status: 403 })
    }
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
        const {
            title,
            description,
            bannerUrl,
            status,
            requiresAuth,
            isAnonymous,
            allowMultiple,
            maxResponses,
            expiresAt,
            isApplication,
            acceptedRoleId,
            notifyChannelId,
            thankYouMessage,
            requiredRoleIds,
            ignoredRoleIds
        } = body

        const form = await prisma.form.update({
            where: { id: formId },
            data: {
                ...(title !== undefined && { title }),
                ...(description !== undefined && { description }),
                ...(bannerUrl !== undefined && { bannerUrl }),
                ...(status !== undefined && { status }),
                ...(requiresAuth !== undefined && { requiresAuth }),
                ...(isAnonymous !== undefined && { isAnonymous }),
                ...(allowMultiple !== undefined && { allowMultiple }),
                ...(maxResponses !== undefined && { maxResponses }),
                ...(expiresAt !== undefined && { expiresAt: expiresAt ? new Date(expiresAt) : null }),
                ...(isApplication !== undefined && { isApplication }),
                ...(acceptedRoleId !== undefined && { acceptedRoleId }),
                ...(notifyChannelId !== undefined && { notifyChannelId }),
                ...(thankYouMessage !== undefined && { thankYouMessage }),
                ...(requiredRoleIds !== undefined && { requiredRoleIds: JSON.stringify(requiredRoleIds) }),
                ...(ignoredRoleIds !== undefined && { ignoredRoleIds: JSON.stringify(ignoredRoleIds) })
            },
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

        return NextResponse.json(form)
    } catch (error) {
        console.error("[FORM PUT]", error)
        return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
}

// DELETE /api/forms/[formId] - Delete form
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ formId: string }> }
) {
    if (!verifyCsrf(request)) {
        return new NextResponse("Forbidden: CSRF verification failed", { status: 403 })
    }
    try {
        const session = await getSession()
        if (!session) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        const { formId } = await params

        // Only server admins can delete forms
        const form = await prisma.form.findUnique({
            where: { id: formId },
            select: { serverId: true }
        })

        if (!form) {
            return NextResponse.json({ error: "Form not found" }, { status: 404 })
        }

        const isAdmin = await isServerAdmin(session.user, form.serverId)
        if (!isAdmin) {
            return NextResponse.json({ error: "Admin access required" }, { status: 403 })
        }

        await prisma.form.delete({ where: { id: formId } })

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error("[FORM DELETE]", error)
        return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
}
