import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getSession } from '@/lib/auth-clerk'
import { verifyCsrf } from "@/lib/auth-permissions"

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
    const session = await getSession()
    if (!session) {
        return NextResponse.json({ ssd: null })
    }

    const { searchParams } = new URL(req.url)
    const serverId = searchParams.get('serverId')

    if (!serverId) {
        return NextResponse.json({ ssd: null })
    }

    try {
        // Check for SSD event for this server
        const ssdEvent = await prisma.config.findUnique({
            where: { key: `ssd_${serverId}` }
        })

        if (!ssdEvent) {
            return NextResponse.json({ ssd: null })
        }

        const eventData = JSON.parse(ssdEvent.value)
        const eventTime = new Date(eventData.timestamp)
        const now = new Date()

        // Only show if event is within the last 30 minutes (extended from 5)
        const thirtyMinutesAgo = new Date(now.getTime() - 30 * 60 * 1000)
        if (eventTime < thirtyMinutesAgo) {
            // Auto-cleanup old events
            await prisma.config.delete({
                where: { key: `ssd_${serverId}` }
            }).catch(() => { })
            return NextResponse.json({ ssd: null })
        }

        // Check if this user was affected
        // We need to check ALL possible user IDs because shifts can be stored with different ID types
        const possibleUserIds = [
            session.user.robloxId,
            session.user.discordId,
            session.user.id
        ].filter(Boolean) as string[]

        const wasAffected = possibleUserIds.some(id =>
            eventData.affectedUserIds?.includes(id)
        )

        // Also check if user has already dismissed this event
        const dismissKey = `ssd_dismissed_${serverId}_${session.user.id}`
        const hasDismissed = await prisma.config.findUnique({
            where: { key: dismissKey }
        })

        if (hasDismissed) {
            // Check if dismiss was for this specific event
            const dismissData = JSON.parse(hasDismissed.value)
            if (dismissData.eventTimestamp === eventData.timestamp) {
                return NextResponse.json({ ssd: null })
            }
        }

        if (!wasAffected) {
            return NextResponse.json({ ssd: null })
        }

        return NextResponse.json({
            ssd: {
                timestamp: eventData.timestamp,
                initiatedBy: eventData.initiatedBy,
                shiftsEnded: eventData.shiftsEnded
            }
        }, {
            headers: {
                'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
            }
        })
    } catch (error) {
        console.error('[SSD Check] Error:', error)
        return NextResponse.json({ ssd: null })
    }
}

// POST to acknowledge/dismiss the SSD notification (per-user)
export async function POST(req: Request) {
    if (!verifyCsrf(req)) return new NextResponse("Forbidden", { status: 403 })

    const session = await getSession()
    if (!session) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    try {
        const { serverId, eventTimestamp } = await req.json()

        if (!serverId) {
            return NextResponse.json({ error: 'Missing serverId' }, { status: 400 })
        }

        // Store dismiss flag per-user instead of deleting the event
        // This way, other affected users still see the notification
        const dismissKey = `ssd_dismissed_${serverId}_${session.user.id}`
        await prisma.config.upsert({
            where: { key: dismissKey },
            update: { value: JSON.stringify({ eventTimestamp, dismissedAt: new Date().toISOString() }) },
            create: { key: dismissKey, value: JSON.stringify({ eventTimestamp, dismissedAt: new Date().toISOString() }) }
        })

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error('[SSD Dismiss] Error:', error)
        return NextResponse.json({ error: 'Failed to dismiss' }, { status: 500 })
    }
}
