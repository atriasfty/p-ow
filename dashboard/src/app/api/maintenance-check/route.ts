import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

// Force dynamic - no caching
export const dynamic = 'force-dynamic'

export async function GET() {
    try {
        // Check the maintenance flag in Prisma config
        const config = await prisma.config.findUnique({
            where: { key: 'MAINTENANCE_MODE' }
        })
        
        const maintenance = config?.value === 'true'

        // Return with cache-control headers to prevent browser caching
        return NextResponse.json(
            { maintenance },
            {
                headers: {
                    'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
                    'Pragma': 'no-cache',
                    'Expires': '0',
                },
            }
        )
    } catch (error) {
        console.error('[Maintenance Check] Error:', error)
        // If there's an error, assume NOT in maintenance (fail open)
        return NextResponse.json(
            { maintenance: false },
            {
                headers: {
                    'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
                },
            }
        )
    }
}
