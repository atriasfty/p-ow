"use server"

import { prisma } from "@/lib/db"
import { getSession } from "@/lib/auth-clerk"
import { revalidatePath } from "next/cache"

export async function revokeDevice(deviceId: string) {
    const session = await getSession()
    if (!session?.user) return { message: "Unauthorized" }

    // Ownership check — a device row belongs to exactly one Clerk user, and
    // the caller must be that user (no admin override; these are personal
    // Vision app installs, not server-scoped resources).
    const device = await prisma.visionDevice.findUnique({ where: { id: deviceId } })
    if (!device || device.userId !== session.user.id) {
        return { message: "Device not found" }
    }

    await prisma.visionDevice.update({
        where: { id: deviceId },
        data: { revokedAt: new Date() }
    })

    revalidatePath("/dashboard")
    return { message: "Device revoked" }
}
