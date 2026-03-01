import { redirect } from "next/navigation"

export default async function ServerRootPage({ params }: { params: Promise<{ serverId: string }> }) {
    const { serverId } = await params
    redirect(`/dashboard/${serverId}/mod-panel`)
}
