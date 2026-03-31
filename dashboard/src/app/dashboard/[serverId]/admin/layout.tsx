import { getSession } from "@/lib/auth-clerk"
import { isServerAdmin, isSuperAdmin } from "@/lib/admin"
import { prisma } from "@/lib/db"
import { redirect } from "next/navigation"
import Link from "next/link"
import { Settings, Users, Shield, Calendar, Clock, ChevronLeft, Zap, ShieldAlert, Trophy, Key, CreditCard, ActivitySquare } from "lucide-react"
import { checkConnectionRequirements } from "@/lib/auth-server"
import { ConnectionRequirementScreen } from "@/components/auth/connection-requirement-screen"

export default async function AdminLayout({
    children,
    params,
}: {
    children: React.ReactNode
    params: Promise<{ serverId: string }>
}) {
    const session = await getSession()
    if (!session) redirect("/login")

    // Enforce Connection Requirements
    const check = checkConnectionRequirements(session.user)
    if (!check.valid) {
        return (
            <ConnectionRequirementScreen
                missing={check.missing}
                // Admin layout typically implies some level of trust, but we still enforce links
                discordUsername={session.user.username}
                robloxUsername={check.robloxUsername}
            />
        )
    }

    const { serverId } = await params

    // Check admin access
    const hasAccess = await isServerAdmin(session.user, serverId)
    if (!hasAccess) {
        redirect(`/dashboard/${serverId}/mod-panel`)
    }

    const server = await prisma.server.findUnique({
        where: { id: serverId },
        select: { featureLoa: true }
    })

    const superAdmin = isSuperAdmin(session.user)

    const tabs = [
        { name: "General", href: `/dashboard/${serverId}/admin`, icon: Settings },
        { name: "Audit Log", href: `/dashboard/${serverId}/admin/audit`, icon: ActivitySquare },
        { name: "Members", href: `/dashboard/${serverId}/admin/members`, icon: Users },
        { name: "Roles", href: `/dashboard/${serverId}/admin/roles`, icon: Shield },
        { name: "Milestones", href: `/dashboard/${serverId}/admin/milestones`, icon: Trophy },
        { name: "API Keys", href: `/dashboard/${serverId}/admin/api-keys`, icon: Key },
        { name: "Subscription", href: `/dashboard/${serverId}/admin/subscription`, icon: CreditCard },
        { name: "Automations", href: `/dashboard/${serverId}/admin/automations`, icon: Zap },
        { name: "Raid Mitigation", href: `/dashboard/${serverId}/admin/raid-mitigation`, icon: ShieldAlert },
    ]

    if (server?.featureLoa !== false) {
        tabs.splice(7, 0, { name: "Leave of Absences", href: `/dashboard/${serverId}/admin/loa`, icon: Calendar })
    }

    return (
        <div className="min-h-screen bg-[#111] text-zinc-100 font-sans">
            {/* Header */}
            <div className="border-b border-[#222] bg-[#1a1a1a]">
                <div className="max-w-7xl mx-auto px-6 py-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <Link
                                href={`/dashboard/${serverId}/mod-panel`}
                                className="p-2 rounded-lg hover:bg-white/5 text-zinc-400 hover:text-white transition-colors"
                            >
                                <ChevronLeft className="h-5 w-5" />
                            </Link>
                            <div>
                                <h1 className="text-xl font-bold text-white">Admin Panel</h1>
                                <p className="text-xs text-zinc-500">Server Configuration & Management</p>
                            </div>
                        </div>
                        {superAdmin && (
                            <span className="px-3 py-1 rounded-full bg-gradient-to-r from-amber-500/20 to-orange-500/20 border border-amber-500/30 text-amber-400 text-xs font-medium">
                                Super Admin
                            </span>
                        )}
                    </div>

                    {/* Tabs */}
                    <div className="flex gap-1 mt-4 overflow-x-auto">
                        {tabs.map(tab => (
                            <Link
                                key={tab.name}
                                href={tab.href}
                                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-zinc-400 hover:text-white hover:bg-white/5 transition-colors whitespace-nowrap"
                            >
                                <tab.icon className="h-4 w-4" />
                                {tab.name}
                            </Link>
                        ))}
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="max-w-7xl mx-auto px-6 py-8">
                {children}
            </div>

            {/* Footer */}
            <footer className="py-4 text-center border-t border-[#222]">
                <p className="text-xs text-zinc-600">© 2026 Project Overwatch - erlc moderation but better™</p>
            </footer>
        </div>
    )
}
