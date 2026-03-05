import { getSession } from "@/lib/auth-clerk"
import { redirect } from "next/navigation"
import { UserProfileClient } from "./user-profile-client"
import { checkConnectionRequirements } from "@/lib/auth-server"
import { ConnectionRequirementScreen } from "@/components/auth/connection-requirement-screen"
import { RoleSyncWrapper } from "@/components/auth/role-sync-wrapper"

export default async function UserProfilePage({ params }: { params: Promise<{ serverId: string, username: string }> }) {
    const session = await getSession()
    if (!session) redirect("/login")

    // Enforce Connection Requirements
    const check = checkConnectionRequirements(session.user)
    if (!check.valid) {
        return (
            <ConnectionRequirementScreen
                missing={check.missing}
                discordUsername={session.user.username}
                robloxUsername={check.robloxUsername}
            />
        )
    }

    const { serverId, username } = await params
    const decodedUsername = decodeURIComponent(username)

    // RoleSyncWrapper provides permissions context, UserProfileClient loads data in parallel
    return (
        <RoleSyncWrapper serverId={serverId}>
            <UserProfileClient serverId={serverId} username={decodedUsername} />
        </RoleSyncWrapper>
    )
}
