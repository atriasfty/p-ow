import { getSession } from "@/lib/auth-clerk"
import { prisma } from "@/lib/db"
import { redirect } from "next/navigation"
import Link from "next/link"
import { Plus, FileText, BarChart3, Users, Settings, Eye, EyeOff, Clock, ExternalLink } from "lucide-react"
import { isServerAdmin } from "@/lib/admin"
import { UpsellBanner } from "@/components/subscription/upsell-banner"

export default async function FormsPage({
    params,
}: {
    params: Promise<{ serverId: string }>
}) {
    const session = await getSession()
    if (!session) redirect("/login")

    const { serverId } = await params
    const isAdmin = await isServerAdmin(session.user, serverId)

    // Get forms this user can see
    const editorAccess = await prisma.formEditorAccess.findMany({
        where: { userId: session.user.id },
        select: { formId: true }
    })
    const accessibleFormIds = editorAccess.map((ea: any) => ea.formId)

    const forms = await prisma.form.findMany({
        where: isAdmin ? { serverId } : {
            serverId,
            OR: [
                { id: { in: accessibleFormIds } },
                { status: "published" }
            ]
        },
        include: {
            _count: { select: { responses: true, sections: true } }
        },
        orderBy: { updatedAt: "desc" }
    })

    const server = await prisma.server.findUnique({
        where: { id: serverId },
        select: { name: true, customName: true, subscriptionPlan: true }
    })

    return (
        <div className="min-h-screen bg-[#111] flex flex-col">
            {/* Branding Header - Fixed at top */}
            <div className="w-full px-6 py-4 flex items-center gap-2">
                <img src="/logo.png" alt="POW" className="h-8 w-8 opacity-70" />
                <span className="text-white/70 text-sm font-medium">Project Overwatch</span>
            </div>

            <div className="max-w-6xl mx-auto px-6 pb-6 space-y-6 flex-1 w-full">
                <UpsellBanner
                    serverId={serverId}
                    plan={server?.subscriptionPlan || 'free'}
                    feature="FORMS_PRO"
                    title="Scale your Recruitment"
                    description="Free servers are limited to 5 active forms. POW Pro increases this to 25, and POW Max offers unlimited forms for your entire community."
                    storageKey="forms_pro"
                />

                {/* Header */}
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-white">Forms</h1>
                        <p className="text-zinc-400 mt-1">
                            {server?.customName || server?.name} • {forms.length} form{forms.length !== 1 ? "s" : ""}
                        </p>
                    </div>
                    {isAdmin && (
                        <div className="flex gap-2">
                            <Link
                                href={`/dashboard/${serverId}/forms/settings`}
                                className="flex items-center gap-2 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg transition-colors font-medium border border-zinc-700 whitespace-nowrap"
                            >
                                <Settings className="h-4 w-4" />
                                Automation Settings
                            </Link>
                            <Link
                                href={`/dashboard/${serverId}/forms/create`}
                                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-colors font-medium"
                            >
                                <Plus className="h-4 w-4" />
                                Create Form
                            </Link>
                        </div>
                    )}
                </div>

                {/* Forms Grid */}
                {forms.length === 0 ? (
                    <div className="bg-[#1a1a1a] border border-[#333] rounded-xl p-12 text-center">
                        <FileText className="h-12 w-12 text-zinc-600 mx-auto mb-4" />
                        <h3 className="text-lg font-medium text-white mb-2">No forms yet</h3>
                        <p className="text-zinc-400 mb-6">
                            {isAdmin
                                ? "Create your first form to start collecting responses."
                                : "No forms are available for you to view."}
                        </p>
                        {isAdmin && (
                            <Link
                                href={`/dashboard/${serverId}/forms/create`}
                                className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-colors"
                            >
                                <Plus className="h-4 w-4" />
                                Create Form
                            </Link>
                        )}
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {forms.map((form: any) => {
                            const canEdit = isAdmin || accessibleFormIds.includes(form.id)
                            return (
                                <div
                                    key={form.id}
                                    className="bg-[#1a1a1a] border border-[#333] rounded-xl overflow-hidden hover:border-[#444] transition-colors group"
                                >
                                    {/* Banner */}
                                    <div className="h-24 bg-gradient-to-br from-indigo-600 to-purple-600 relative">
                                        {form.bannerUrl && (
                                            <img
                                                src={form.bannerUrl}
                                                alt=""
                                                className="absolute inset-0 w-full h-full object-cover"
                                            />
                                        )}
                                        {/* Status Badge */}
                                        <div className="absolute top-3 right-3">
                                            <span className={`px-2 py-1 rounded text-xs font-medium ${form.status === "published"
                                                ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                                                : form.status === "closed"
                                                    ? "bg-red-500/20 text-red-400 border border-red-500/30"
                                                    : "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                                                }`}>
                                                {form.status === "published" ? (
                                                    <><Eye className="h-3 w-3 inline mr-1" /> Published</>
                                                ) : form.status === "closed" ? (
                                                    <><EyeOff className="h-3 w-3 inline mr-1" /> Closed</>
                                                ) : (
                                                    <>Draft</>
                                                )}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Content */}
                                    <div className="p-4 space-y-4">
                                        <div>
                                            <h3 className="text-lg font-semibold text-white truncate">{form.title}</h3>
                                            {form.description && (
                                                <p className="text-sm text-zinc-400 mt-1 line-clamp-2">{form.description}</p>
                                            )}
                                        </div>

                                        {/* Stats */}
                                        <div className="flex items-center gap-4 text-sm text-zinc-500">
                                            <span className="flex items-center gap-1">
                                                <Users className="h-4 w-4" />
                                                {form._count.responses} responses
                                            </span>
                                            <span className="flex items-center gap-1">
                                                <FileText className="h-4 w-4" />
                                                {form._count.sections} sections
                                            </span>
                                        </div>

                                        {/* Expiry */}
                                        {form.expiresAt && (
                                            <div className="flex items-center gap-1 text-xs text-zinc-500">
                                                <Clock className="h-3 w-3" />
                                                Expires {new Date(form.expiresAt).toLocaleDateString()}
                                            </div>
                                        )}

                                        {/* Actions */}
                                        <div className="flex gap-2 pt-2 border-t border-[#333]">
                                            {canEdit && (
                                                <>
                                                    <Link
                                                        href={`/dashboard/${serverId}/forms/${form.id}/edit`}
                                                        className="flex-1 flex items-center justify-center gap-1 px-3 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg text-sm transition-colors whitespace-nowrap"
                                                    >
                                                        <Settings className="h-4 w-4" />
                                                        Edit
                                                    </Link>
                                                    <Link
                                                        href={`/dashboard/${serverId}/forms/${form.id}/responses`}
                                                        className="flex-1 flex items-center justify-center gap-1 px-3 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg text-sm transition-colors whitespace-nowrap"
                                                    >
                                                        <BarChart3 className="h-4 w-4" />
                                                        Results
                                                    </Link>
                                                </>
                                            )}
                                            {form.status === "published" && (
                                                <Link
                                                    href={`/forms/${form.publicShareId}`}
                                                    target="_blank"
                                                    className="flex items-center justify-center gap-1 px-3 py-2 bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-400 rounded-lg text-sm transition-colors"
                                                    title="Open form"
                                                >
                                                    <ExternalLink className="h-4 w-4" />
                                                </Link>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                )}

                {/* Back Link */}
                <div className="pt-4">
                    <Link
                        href={`/dashboard/${serverId}/mod-panel`}
                        className="text-zinc-500 hover:text-zinc-300 text-sm transition-colors"
                    >
                        ← Back to Mod Panel
                    </Link>
                </div>
            </div>

            {/* Footer */}
            <footer className="max-w-6xl mx-auto w-full mt-8 pt-4 border-t border-[#222] text-center">
                <p className="text-xs text-zinc-600">© 2026 Project Overwatch - erlc moderation but better™</p>
            </footer>
        </div>
    )
}
