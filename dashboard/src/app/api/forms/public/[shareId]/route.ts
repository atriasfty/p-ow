import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { getSession } from "@/lib/auth-clerk"

// GET /api/forms/public/[shareId] - Get form by public share ID
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ shareId: string }> }
) {
    try {
        const { shareId } = await params

        const form = await prisma.form.findUnique({
            where: { publicShareId: shareId },
            include: {
                sections: {
                    orderBy: { order: "asc" },
                    include: {
                        questions: {
                            orderBy: { order: "asc" }
                        }
                    }
                },
                _count: { select: { responses: true } },
                server: { select: { name: true, customName: true, bannerUrl: true } }
            }
        })

        if (!form) {
            return NextResponse.json({ error: "Form not found" }, { status: 404 })
        }

        // Check if form is accepting responses
        if (form.status !== "published") {
            return NextResponse.json({ error: "Form is not accepting responses" }, { status: 403 })
        }

        // Check expiration
        if (form.expiresAt && new Date(form.expiresAt) < new Date()) {
            return NextResponse.json({ error: "Form has expired" }, { status: 403 })
        }

        // Check max responses
        if (form.maxResponses && form._count.responses >= form.maxResponses) {
            return NextResponse.json({ error: "Form has reached maximum responses" }, { status: 403 })
        }

        // Check role-based access
        const session = await getSession()

        // Parse role arrays
        const requiredRoles: string[] = form.requiredRoleIds ? JSON.parse(form.requiredRoleIds) : []
        const ignoredRoles: string[] = form.ignoredRoleIds ? JSON.parse(form.ignoredRoleIds) : []

        // If no role gating configured (both arrays empty), skip role checks
        const hasRoleGating = requiredRoles.length > 0 || ignoredRoles.length > 0

        // Enforcement logic
        if (form.requiresAuth && !session) {
            return NextResponse.json({
                error: "Login required to access this form",
                requiresAuth: true
            }, { status: 401 })
        }

        if (hasRoleGating) {
            // Role gating ALWAYS requires login
            if (!session) {
                return NextResponse.json({
                    error: "Login required to access this form",
                    requiresAuth: true
                }, { status: 401 })
            }

            // Get user's Discord ID
            const discordId = session.user.discordId
            if (!discordId) {
                return NextResponse.json({
                    error: "You must link your Discord account to access this form"
                }, { status: 403 })
            }

            // Get the server's Discord Guild ID
            const server = await prisma.server.findUnique({
                where: { id: form.serverId },
                select: { discordGuildId: true }
            })

            const guildId = server?.discordGuildId || process.env.GUILD_ID
            if (!guildId) {
                return NextResponse.json({
                    error: "Discord Guild not configured for this server"
                }, { status: 500 })
            }

            // Fetch user's actual Discord roles via Discord API
            const botToken = process.env.DISCORD_BOT_TOKEN
            if (!botToken) {
                return NextResponse.json({
                    error: "Discord bot not configured"
                }, { status: 500 })
            }

            const memberRes = await fetch(
                `https://discord.com/api/v10/guilds/${guildId}/members/${discordId}`,
                { headers: { Authorization: `Bot ${botToken}` } }
            )

            if (!memberRes.ok) {
                if (memberRes.status === 404) {
                    return NextResponse.json({
                        error: "You must be in the Discord server to access this form"
                    }, { status: 403 })
                }
                return NextResponse.json({
                    error: "Failed to verify Discord roles"
                }, { status: 500 })
            }

            const memberData = await memberRes.json()
            const userDiscordRoles: string[] = memberData.roles || []

            // Check ignored roles (block if user has ANY of them)
            const hasIgnoredRole = ignoredRoles.some(roleId => userDiscordRoles.includes(roleId))
            if (hasIgnoredRole) {
                return NextResponse.json({
                    error: "You do not have permission to access this form"
                }, { status: 403 })
            }

            // Check required roles (must have at least ONE)
            if (requiredRoles.length > 0) {
                const hasRequiredRole = requiredRoles.some(roleId => userDiscordRoles.includes(roleId))
                if (!hasRequiredRole) {
                    return NextResponse.json({
                        error: "You do not have the required role to access this form"
                    }, { status: 403 })
                }
            }
        }

        let hasSubmitted = false
        let draftAnswers: Record<string, any> | null = null
        let draftResponseId: string | null = null

        if (session) {
            // Check for completed submissions
            if (!form.allowMultiple) {
                const existing = await prisma.formResponse.findFirst({
                    where: {
                        formId: form.id,
                        respondentId: session.user.id,
                        status: "completed"
                    }
                })
                hasSubmitted = !!existing
            }

            // Check for draft
            const draft = await prisma.formResponse.findFirst({
                where: {
                    formId: form.id,
                    respondentId: session.user.id,
                    status: "draft"
                },
                include: { answers: true }
            })

            if (draft) {
                draftResponseId = draft.id
                draftAnswers = {}
                draft.answers.forEach((a: any) => {
                    try {
                        // Parse JSON value
                        const val = JSON.parse(a.value)
                        draftAnswers![a.questionId] = val
                    } catch {
                        draftAnswers![a.questionId] = a.value
                    }
                })
            }
        }

        // Parse question configs and conditions
        const formWithParsedData = {
            ...form,
            status: undefined, // Don't expose internal status
            editorShareId: undefined, // Don't expose editor link
            sections: form.sections.map((s: any) => ({
                ...s,
                questions: s.questions.map((q: any) => ({
                    ...q,
                    config: JSON.parse(q.config || "{}"),
                    conditions: JSON.parse(q.conditions || "{}")
                }))
            })),
            responseCount: form._count.responses,
            maxResponses: form.maxResponses,
            hasSubmitted,
            draftAnswers,
            draftResponseId
        }

        return NextResponse.json(formWithParsedData)
    } catch (error) {
        console.error("[PUBLIC FORM GET]", error)
        return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
}
