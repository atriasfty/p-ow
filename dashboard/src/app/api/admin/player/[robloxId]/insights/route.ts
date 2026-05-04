import { getSession } from "@/lib/auth-clerk"
import { prisma } from "@/lib/db"
import { isServerAdmin } from "@/lib/admin"
import { NextResponse } from "next/server"
import { clerkClient } from "@clerk/nextjs/server"

const MISTRAL_API_KEY = process.env.MISTRAL_API_KEY

export async function GET(
    req: Request,
    { params }: { params: Promise<{ robloxId: string }> }
) {
    const session = await getSession()
    if (!session) return new NextResponse("Unauthorized", { status: 401 })

    const { robloxId } = await params
    const { searchParams } = new URL(req.url)
    const serverId = searchParams.get("serverId")

    if (!serverId) return new NextResponse("Missing serverId", { status: 400 })

    // Verify admin perms
    if (!await isServerAdmin(session.user as any, serverId)) {
        return new NextResponse("Forbidden", { status: 403 })
    }

    if (!MISTRAL_API_KEY) {
        return NextResponse.json({ error: "AI Insights not configured (missing Mistral key)" }, { status: 503 })
    }

    try {
        // --- USAGE LIMIT CHECK ---
        const now = new Date()
        const day = now.getDate()
        const month = now.getMonth()
        const year = now.getFullYear()

        // 1. Get user plan from Clerk
        const clerk = await clerkClient()
        const user = await clerk.users.getUser(session.user.id)
        const plan = (user.publicMetadata?.subscriptionPlan as string) || "free"

        const limits: Record<string, number> = {
            "free": 15,
            "pow-pro": 100,
            "pow-max": 1000,
            "pow-pro-user": 100
        }
        const limit = limits[plan] || 15

        // 2. Check current usage
        const usage = await prisma.userAiUsage.findUnique({
            where: { userId_day_month_year: { userId: session.user.id, day, month, year } }
        })

        if (usage && usage.count >= limit) {
            return NextResponse.json({ 
                error: `Daily AI limit reached (${usage.count}/${limit}). Upgrade your plan for more!`,
                limitReached: true 
            }, { status: 403 })
        }

        // 3. Gather all data about this player on this server
        const [punishments, logs, shifts] = await Promise.all([
            prisma.punishment.findMany({ where: { userId: robloxId, serverId }, orderBy: { createdAt: 'desc' } }),
            prisma.log.findMany({ 
                where: { 
                    serverId, 
                    OR: [{ playerId: robloxId }, { killerId: robloxId }, { victimId: robloxId }] 
                }, 
                orderBy: { createdAt: 'desc' },
                take: 100 
            }),
            prisma.shift.findMany({ where: { userId: robloxId, serverId }, take: 10 })
        ])

        // 4. Prepare the prompt for Mistral
        const dataSummary = {
            punishmentCount: punishments.length,
            recentPunishments: punishments.map(p => ({ type: p.type, reason: p.reason, date: p.createdAt })),
            recentActivity: logs.map(l => ({ type: l.type, command: l.command, date: l.createdAt })),
            totalShifts: shifts.length,
        }

        const prompt = `
            Analyze the following player activity data for a Roblox server and provide a moderation risk assessment.
            
            PLAYER DATA:
            ${JSON.stringify(dataSummary, null, 2)}
            
            Return your response in STRICT JSON format with these fields:
            - riskScore: 0-100 (Integer)
            - summary: A brief 2-sentence overview of the player's behavior.
            - concerns: Array of strings identifying suspicious patterns.
            - recommendation: "Watch", "Safe", "Restrict", or "Promote".
            - analysis: A more detailed paragraph explaining your reasoning.
        `

        const response = await fetch("https://api.mistral.ai/v1/chat/completions", {
            method: "POST",
            headers: { "x-csrf-check": "1",
                "Content-Type": "application/json",
                "Authorization": `Bearer ${MISTRAL_API_KEY}`
            },
            body: JSON.stringify({
                model: "mistral-tiny",
                messages: [{ role: "user", content: prompt }],
                response_format: { type: "json_object" }
            })
        })

        if (!response.ok) throw new Error("Mistral API error")

        const aiData = await response.json()
        const insight = JSON.parse(aiData.choices[0].message.content)

        // 5. Increment usage count
        await prisma.userAiUsage.upsert({
            where: { userId_day_month_year: { userId: session.user.id, day, month, year } },
            update: { count: { increment: 1 } },
            create: { userId: session.user.id, day, month, year, count: 1 }
        })

        return NextResponse.json({
            ...insight,
            usage: {
                current: (usage?.count || 0) + 1,
                limit
            }
        })

    } catch (e: any) {
        console.error("[AI INSIGHTS]", e)
        return NextResponse.json({ error: "Failed to generate AI insights" }, { status: 500 })
    }
}
