import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/auth-clerk"
import { prisma } from "@/lib/db"
import { verifyCsrf } from "@/lib/auth-permissions"
import { getServerSettings } from "@/lib/server-settings"

// POST /api/forms/[formId]/submit - Submit form response
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ formId: string }> }
) {
    if (!verifyCsrf(request)) {
        return new NextResponse("Forbidden: CSRF verification failed", { status: 403 })
    }

    try {
        const { formId } = await params

        // Get form with settings and questions
        const form = await prisma.form.findUnique({
            where: { id: formId },
            include: {
                sections: {
                    include: {
                        questions: true
                    }
                },
                _count: { select: { responses: true } }
            }
        })

        if (!form) {
            return NextResponse.json({ error: "Form not found" }, { status: 404 })
        }

        // Check form is published
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

        // Check auth requirement
        const session = await getSession()
        if (form.requiresAuth && !session) {
            return NextResponse.json({ error: "Authentication required" }, { status: 401 })
        }

        // Check Roblox account age if configured
        const formSubmitSettings = await getServerSettings(form.serverId)
        if (formSubmitSettings.formMinRobloxAccountAgeDays > 0 && session?.user.robloxId) {
            try {
                const { getRobloxUserById } = await import("@/lib/roblox")
                const robloxUser = await getRobloxUserById(Number(session.user.robloxId))
                if (robloxUser?.created) {
                    const accountAgeDays = Math.floor((Date.now() - new Date(robloxUser.created).getTime()) / (24 * 60 * 60 * 1000))
                    if (accountAgeDays < formSubmitSettings.formMinRobloxAccountAgeDays) {
                        return NextResponse.json({
                            error: `Your Roblox account must be at least ${formSubmitSettings.formMinRobloxAccountAgeDays} days old to submit this form (your account is ${accountAgeDays} days old)`
                        }, { status: 403 })
                    }
                }
            } catch { /* Non-critical: allow submission if Roblox lookup fails */ }
        }

        // Check multiple submissions (only for completed ones)
        if (!form.allowMultiple && session) {
            const existing = await prisma.formResponse.findFirst({
                where: {
                    formId,
                    respondentId: session.user.id,
                    status: "completed"
                }
            })
            if (existing) {
                return NextResponse.json({ error: "You have already submitted this form" }, { status: 403 })
            }
        }

        // Check role-based access
        const requiredRoles: string[] = form.requiredRoleIds ? JSON.parse(form.requiredRoleIds) : []
        const ignoredRoles: string[] = form.ignoredRoleIds ? JSON.parse(form.ignoredRoleIds) : []
        const hasRoleGating = requiredRoles.length > 0 || ignoredRoles.length > 0

        if (hasRoleGating) {
            if (!session) {
                return NextResponse.json({ error: "Login required to submit this form" }, { status: 401 })
            }

            const discordId = session.user.discordId
            if (!discordId) {
                return NextResponse.json({ error: "You must link your Discord account to submit this form" }, { status: 403 })
            }

            const server = await prisma.server.findUnique({
                where: { id: form.serverId },
                select: { discordGuildId: true }
            })

            const guildId = server?.discordGuildId || process.env.GUILD_ID
            const botToken = process.env.DISCORD_BOT_TOKEN

            if (!guildId || !botToken) {
                return NextResponse.json({ error: "Discord not configured" }, { status: 500 })
            }

            const memberRes = await fetch(
                `https://discord.com/api/v10/guilds/${guildId}/members/${discordId}`,
                { headers: { Authorization: `Bot ${botToken}` } }
            )

            if (!memberRes.ok) {
                return NextResponse.json({ error: "You must be in the Discord server" }, { status: 403 })
            }

            const memberData = await memberRes.json()
            const userDiscordRoles: string[] = memberData.roles || []

            if (ignoredRoles.some(r => userDiscordRoles.includes(r))) {
                return NextResponse.json({ error: "You do not have permission to submit this form" }, { status: 403 })
            }

            if (requiredRoles.length > 0 && !requiredRoles.some(r => userDiscordRoles.includes(r))) {
                return NextResponse.json({ error: "You do not have the required role" }, { status: 403 })
            }
        }

        const body = await request.json()
        const { answers, email, saveAsDraft, responseId: bodyResponseId } = body

        if (!answers || typeof answers !== "object") {
            return NextResponse.json({ error: "answers object is required" }, { status: 400 })
        }

        // Helper to check if a question should be shown based on conditions
        const shouldShowQuestion = (question: any, currentAnswers: Record<string, any>): boolean => {
            let conditions: any = {}
            try {
                conditions = typeof question.conditions === 'string' ? JSON.parse(question.conditions) : question.conditions
            } catch { }

            if (!conditions?.showIf) return true

            const { questionId, operator, value } = conditions.showIf
            const answer = currentAnswers[questionId]

            if (answer === undefined || answer === null) return false

            const stringAnswer = Array.isArray(answer) ? answer.join(",") : String(answer)

            switch (operator) {
                case "equals":
                    if (Array.isArray(answer)) return answer.includes(value)
                    return String(answer) === value
                case "not_equals":
                    if (Array.isArray(answer)) return !answer.includes(value)
                    return String(answer) !== value
                case "contains":
                    return stringAnswer.includes(value)
                default:
                    return true
            }
        }

        // Validate that all question IDs belong to this form
        const allQuestions = form.sections.flatMap((s: any) => s.questions)
        const validQuestionIds = new Set(allQuestions.map((q: any) => q.id))

        for (const qId of Object.keys(answers)) {
            if (!validQuestionIds.has(qId)) {
                return NextResponse.json({ error: `Invalid question ID: ${qId}` }, { status: 400 })
            }
        }

        // Validate required questions (SKIP if saving as draft)
        if (!saveAsDraft) {
            const requiredQuestions = allQuestions.filter((q: any) => q.required)
            for (const question of requiredQuestions) {
                // Only validate if the question should be shown based on conditional logic
                if (shouldShowQuestion(question, answers)) {
                    const answer = answers[question.id]
                    if (answer === undefined || answer === null || answer === "" || (Array.isArray(answer) && answer.length === 0)) {
                        return NextResponse.json({
                            error: `Question "${question.label}" is required`,
                            questionId: question.id
                        }, { status: 400 })
                    }
                }
            }
        }

        // Find existing draft (or response if updating)
        let responseId: string | undefined = bodyResponseId
        if (!responseId && session) {
            const existing = await prisma.formResponse.findFirst({
                where: { formId, respondentId: session.user.id, status: "draft" }
            })
            responseId = existing?.id
        }

        // Validate client-provided responseId to prevent IDOR
        if (responseId && responseId !== "new") {
            const existingResponse = await prisma.formResponse.findUnique({
                where: { id: responseId }
            })

            if (!existingResponse) {
                return NextResponse.json({ error: "Invalid response ID" }, { status: 400 })
            }
            if (existingResponse.formId !== formId) {
                return NextResponse.json({ error: "Response does not belong to this form" }, { status: 400 })
            }
            if (session && existingResponse.respondentId && existingResponse.respondentId !== session.user.id) {
                return NextResponse.json({ error: "Unauthorized to modify this response" }, { status: 403 })
            }
        }

        // Upsert response
        const status = saveAsDraft ? "draft" : "completed"

        const response = await prisma.formResponse.upsert({
            where: { id: responseId || "new" }, // "new" checks nothing, triggers create
            create: {
                formId,
                respondentId: session?.user.id || null,
                respondentEmail: email || null,
                status,
                answers: {
                    create: Object.entries(answers).map(([questionId, value]) => ({
                        questionId,
                        value: JSON.stringify(value)
                    }))
                }
            },
            update: {
                status,
                // For update, we delete all answers and recreate them to handle removed answers
                answers: {
                    deleteMany: {},
                    create: Object.entries(answers).map(([questionId, value]) => ({
                        questionId,
                        value: JSON.stringify(value)
                    }))
                }
            },
            include: { answers: true }
        })

        // Send Discord notification only on FINAL submission
        if (!saveAsDraft) {
            // Feature 3: Automated Recruitment Workflow (Manual Review)
            if (form.isApplication && form.recruitmentChannelId) {
                try {
                    const appSummary = allQuestions.map((q: any) => ({
                        question: q.label,
                        answer: answers[q.id]
                    }))

                    const embed = {
                        embeds: [
                            {
                                title: "📝 New Staff Application",
                                color: 0x5865F2, // Blurple
                                description: `**Respondent:** ${session?.user?.name || email || "Anonymous"}\n**User ID:** \`${session?.user?.id || "N/A"}\``,
                                fields: appSummary.slice(0, 10).map((a: any) => ({
                                    name: a.question.substring(0, 256),
                                    value: String(a.answer).substring(0, 1024) || "_No answer_",
                                    inline: false
                                })),
                                footer: { text: `Form: ${form.title} • Review on Dashboard` },
                                timestamp: new Date().toISOString()
                            }
                        ]
                    }

                    await prisma.botQueue.create({
                        data: {
                            serverId: form.serverId,
                            type: "MESSAGE",
                            targetId: form.recruitmentChannelId,
                            content: JSON.stringify(embed)
                        }
                    })
                } catch (e) {
                    console.error("[RECRUITMENT NOTIFY ERROR]", e)
                }
            }

            if (form.notifyChannelId) {
                await prisma.botQueue.create({
                    data: {
                        serverId: form.serverId,
                        type: "MESSAGE",
                        targetId: form.notifyChannelId,
                        content: JSON.stringify({
                            embeds: [{
                                title: `📝 New Form Submission`,
                                description: `Someone submitted **${form.title}**`,
                                color: 0x5865F2,
                                fields: [
                                    {
                                        name: "Respondent",
                                        value: form.isAnonymous ? "Anonymous" : (session?.user.username || email || "Anonymous"),
                                        inline: true
                                    },
                                    {
                                        name: "Response #",
                                        value: `${form._count.responses + 1}`,
                                        inline: true
                                    }
                                ],
                                timestamp: new Date().toISOString()
                            }]
                        })
                    }
                })
            }
        }

        return NextResponse.json({
            success: true,
            responseId: response.id
        }, { status: 201 })
    } catch (error) {
        console.error("[FORM SUBMIT]", error)
        return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
}
