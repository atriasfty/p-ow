import { prisma } from './db'

/**
 * Handshake codes are one-time use strings that the Vision app polls for (or uses to generate a link)
 * to facilitate secure authentication from the desktop application to the web dashboard.
 * 
 * This has been moved from an in-memory Map to Prisma to support serverless and multi-instance deployments.
 */

export const handshakeStore = {
    /**
     * Set a one-time code with an expiration.
     */
    async set(code: string, data: { expiresAt: number }) {
        await prisma.visionHandshake.upsert({
            where: { code },
            create: {
                code,
                expiresAt: new Date(data.expiresAt),
            },
            update: {
                expiresAt: new Date(data.expiresAt),
            },
        })
    },

    /**
     * Get and optionally validate a code.
     */
    async get(code: string) {
        const handshake = await prisma.visionHandshake.findUnique({
            where: { code },
        })

        if (!handshake) return null

        return {
            expiresAt: handshake.expiresAt.getTime(),
        }
    },

    /**
     * Delete a code (consume it).
     */
    async delete(code: string) {
        try {
            await prisma.visionHandshake.delete({
                where: { code },
            })
        } catch (e) {
            // Ignore if already deleted
        }
    },

    /**
     * Cleanup expired codes.
     */
    async cleanup() {
        await prisma.visionHandshake.deleteMany({
            where: {
                expiresAt: {
                    lt: new Date(),
                },
            },
        })
    }
}

// Deprecated: Exporting Map for legacy compatibility while transitioning
// We should rename this to handshakeStore and update all call sites.
export const handshakeCodes = handshakeStore
