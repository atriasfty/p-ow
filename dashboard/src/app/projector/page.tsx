import { getSession } from "@/lib/auth-clerk"
import { isSuperAdmin } from "@/lib/admin"
import { redirect } from "next/navigation"
import { ProjectorDisplay } from "./projector-display"

export const metadata = { title: "POW Live Stats" }

export default async function ProjectorPage() {
    const session = await getSession()
    if (!session || !isSuperAdmin(session.user as any)) {
        redirect("/dashboard")
    }

    return <ProjectorDisplay />
}
