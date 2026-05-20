import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

// Force dynamic - no caching
export const dynamic = 'force-dynamic'

// Module-level cache: survives across requests in the same process. On DB failure
// we return the last known value rather than a 503, which previously caused the
// middleware's fail-closed path to lock all users out during a transient DB error.
let cachedMaintenance: boolean | null = null

const MAINTENANCE_HEADERS = {
    'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
    'Pragma': 'no-cache',
    'Expires': '0',
}

export async function GET() {
    try {
        const config = await prisma.config.findUnique({
            where: { key: 'MAINTENANCE_MODE' }
        })

        const maintenance = config?.value === 'true'
        cachedMaintenance = maintenance

        return NextResponse.json({ maintenance }, { headers: MAINTENANCE_HEADERS })
    } catch (error) {
        console.error('[Maintenance Check] DB error, returning last known value:', error)

        // Fail open: if we have a cached value, use it; if cold start, return false
        // so a transient DB error doesn't trigger a false maintenance lockout.
        const maintenance = cachedMaintenance ?? false
        return NextResponse.json({ maintenance }, { headers: MAINTENANCE_HEADERS })
    }
}
