
"use server"

import { clerkClient } from "@clerk/nextjs/server"
import { getSession } from "@/lib/auth-clerk"
import { revalidatePath } from "next/cache"

export async function createInvitation(prevState: any, formData: FormData) {
    const session = await getSession()
    if (!session) return { message: "Unauthorized" }

    const { isSuperAdmin } = await import("@/lib/admin")
    if (!isSuperAdmin(session.user as any)) {
        return { message: "Only Superadmins can invite users." }
    }

    const email = formData.get("email") as string
    if (!email) return { message: "Email is required" }

    try {
        const client = await clerkClient()
        await client.invitations.createInvitation({
            emailAddress: email,
            redirectUrl: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000/dashboard",
            ignoreExisting: true,
        })

        revalidatePath("/dashboard/settings/invites")
        return { message: "Invitation sent successfully!", success: true }
    } catch (error: any) {
        // Clerk errors often come as an array
        const errorMessage = error.errors ? error.errors[0]?.message : error.message
        return { message: errorMessage || "Failed to create invitation" }
    }
}

export async function revokeInvitation(invitationId: string) {
    const session = await getSession()
    if (!session) return { message: "Unauthorized" }

    const { isSuperAdmin } = await import("@/lib/admin")
    if (!isSuperAdmin(session.user as any)) {
        return { message: "Only Superadmins can revoke invitations." }
    }

    try {
        const client = await clerkClient()
        await client.invitations.revokeInvitation(invitationId)
        revalidatePath("/dashboard/settings/invites")
        return { message: "Invitation revoked" }
    } catch (error) {
        console.error(error)
        return { message: "Failed to revoke" }
    }
}
