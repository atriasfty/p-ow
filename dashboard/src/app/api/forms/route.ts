import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/auth-clerk"
import { prisma } from "@/lib/db"
import { isServerAdmin, isServerMember } from "@/lib/admin"
import { verifyCsrf } from "@/lib/auth-permissions"

// GET /api/forms?serverId=xxx - List forms for a server
export async function GET(request: NextRequest) {
    try {
        const session = await getSession()
        if (!session) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        const { searchParams } = new URL(request.url)
        const serverId = searchParams.get("serverId")

        if (!serverId) {
            return NextResponse.json({ error: "serverId is required" }, { status: 400 })
        }

        // Verify user is a member of this server
        if (!await isServerMember(session.user as any, serverId)) {
            return new NextResponse("Forbidden: Access denied to this server", { status: 403 })
        }

        // Check if user has access to this server (any member or admin)
        const isAdmin = await isServerAdmin(session.user, serverId)

        // Get forms this user can see:
        // - All forms if admin
        // - Forms they have editor access to
        // - Published forms (for filling)
        let forms
        if (isAdmin) {
            forms = await prisma.form.findMany({
                where: { serverId },
                include: {
                    _count: {
                        select: { responses: true, sections: true }
                    }
                },
                orderBy: { updatedAt: "desc" }
            })
        } else {
            // Get forms user has editor access to
            const editorAccess = await prisma.formEditorAccess.findMany({
                where: { userId: session.user.id },
                select: { formId: true }
            })
            const accessibleFormIds = editorAccess.map((ea: any) => ea.formId)

            forms = await prisma.form.findMany({
                where: {
                    serverId,
                    OR: [
                        { id: { in: accessibleFormIds } },
                        { status: "published" }
                    ]
                },
                include: {
                    _count: {
                        select: { responses: true, sections: true }
                    }
                },
                orderBy: { updatedAt: "desc" }
            })
        }

        return NextResponse.json(forms)
    } catch (error) {
        console.error("[FORMS GET]", error)
        return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
}

// POST /api/forms - Create new form
export async function POST(request: NextRequest) {
    if (!verifyCsrf(request)) {
        return new NextResponse("Forbidden: CSRF verification failed", { status: 403 })
    }
    try {
        const session = await getSession()
        if (!session) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        const body = await request.json()
        const { serverId, title, description, sections } = body

        if (!serverId || !title) {
            return NextResponse.json({ error: "serverId and title are required" }, { status: 400 })
        }

        // Check admin access
        const isAdmin = await isServerAdmin(session.user, serverId)
        if (!isAdmin) {
            return NextResponse.json({ error: "Admin access required" }, { status: 403 })
        }

        // Check subscription form limit
        const { checkLimit } = await import("@/lib/subscription")
        const { isServerFeatureEnabled } = await import("@/lib/feature-flags")

        const limitsEnabled = await isServerFeatureEnabled('FORMS_LIMIT_CHECK', serverId)
        if (limitsEnabled) {
            const { allowed, current, max } = await checkLimit(serverId, 'forms')
            if (!allowed) {
                return NextResponse.json({
                    error: `Form limit reached (${current}/${max}). Upgrade your plan to create more forms.`,
                    upgradeRequired: true
                }, { status: 403 })
            }
        }

        // If sections are provided, validate/structure them for nested create
        let sectionsCreate = {}
        if (sections && Array.isArray(sections)) {
            sectionsCreate = {
                create: sections.map((section: any, index: number) => ({
                    title: section.title || `Section ${index + 1}`,
                    description: section.description,
                    order: index,
                    questions: {
                        create: (section.questions || []).map((q: any, qIndex: number) => ({
                            type: q.type,
                            label: q.label,
                            description: q.description,
                            required: q.required,
                            order: qIndex,
                            config: JSON.stringify(q.config ?? {}),
                            conditions: JSON.stringify(q.conditions ?? {})
                        }))
                    }
                }))
            }
        } else {
            // Default single section if none provided
            sectionsCreate = {
                create: {
                    title: "Section 1",
                    order: 0
                }
            }
        }

        // Atomic create using Prisma transaction (implicit in .create with nested writes)
        const form = await prisma.form.create({
            data: {
                serverId,
                title,
                description: description || null,
                createdBy: session.user.id,
                publicShareId: crypto.randomUUID(),
                editorShareId: crypto.randomUUID(), // Better than CUID for security 
                // @ts-ignore - Prisma nested create types can be tricky
                sections: sectionsCreate
            },
            include: {
                sections: {
                    include: {
                        questions: true
                    }
                }
            }
        })

        return NextResponse.json(form, { status: 201 })
    } catch (error: any) {
        console.error("[FORMS POST]", error)
        return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
}
