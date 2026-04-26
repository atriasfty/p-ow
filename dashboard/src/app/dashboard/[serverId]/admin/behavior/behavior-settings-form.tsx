"use client"

import { useState, useCallback } from "react"
import { Save, Loader2, ChevronDown, ChevronUp, AlertTriangle, Plus, X } from "lucide-react"
import type { ServerSettings } from "@/lib/server-settings"
import type { ServerPlan } from "@/lib/subscription"

interface BehaviorSettingsFormProps {
    serverId: string
    initialSettings: ServerSettings
    plan: ServerPlan
    planRetentionCeiling: number
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function SettingCard({
    title,
    description,
    children,
    defaultOpen = false,
}: {
    title: string
    description?: string
    children: React.ReactNode
    defaultOpen?: boolean
}) {
    const [open, setOpen] = useState(defaultOpen)
    return (
        <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl overflow-hidden">
            <button
                type="button"
                onClick={() => setOpen(o => !o)}
                className="w-full flex items-center justify-between px-6 py-4 text-left hover:bg-white/[0.02] transition-colors"
            >
                <div>
                    <h3 className="text-sm font-semibold text-white">{title}</h3>
                    {description && <p className="text-xs text-zinc-500 mt-0.5">{description}</p>}
                </div>
                {open ? <ChevronUp className="h-4 w-4 text-zinc-500" /> : <ChevronDown className="h-4 w-4 text-zinc-500" />}
            </button>
            {open && <div className="px-6 pb-6 border-t border-[#2a2a2a] pt-5 space-y-4">{children}</div>}
        </div>
    )
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
    return (
        <div className="space-y-1">
            <label className="block text-xs font-medium text-zinc-300">{label}</label>
            {hint && <p className="text-xs text-zinc-500">{hint}</p>}
            {children}
        </div>
    )
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
    return (
        <button
            type="button"
            onClick={() => onChange(!checked)}
            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${checked ? "bg-emerald-500" : "bg-[#333]"}`}
        >
            <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${checked ? "translate-x-5" : "translate-x-1"}`} />
        </button>
    )
}

function NumberInput({
    value,
    onChange,
    min = 0,
    max,
    placeholder,
}: {
    value: number
    onChange: (v: number) => void
    min?: number
    max?: number
    placeholder?: string
}) {
    return (
        <input
            type="number"
            min={min}
            max={max}
            value={value}
            onChange={e => onChange(Number(e.target.value))}
            placeholder={placeholder}
            className="w-full bg-[#111] border border-[#333] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-zinc-500"
        />
    )
}

function TextInput({
    value,
    onChange,
    placeholder,
    maxLength,
}: {
    value: string
    onChange: (v: string) => void
    placeholder?: string
    maxLength?: number
}) {
    return (
        <input
            type="text"
            value={value}
            onChange={e => onChange(e.target.value)}
            placeholder={placeholder}
            maxLength={maxLength}
            className="w-full bg-[#111] border border-[#333] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-zinc-500"
        />
    )
}

function SelectInput<T extends string>({
    value,
    onChange,
    options,
}: {
    value: T
    onChange: (v: T) => void
    options: { value: T; label: string }[]
}) {
    return (
        <select
            value={value}
            onChange={e => onChange(e.target.value as T)}
            className="w-full bg-[#111] border border-[#333] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-zinc-500"
        >
            {options.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
            ))}
        </select>
    )
}

function TagInput({ value, onChange, placeholder }: { value: string[]; onChange: (v: string[]) => void; placeholder?: string }) {
    const [draft, setDraft] = useState("")
    const add = () => {
        const trimmed = draft.trim()
        if (trimmed && !value.includes(trimmed)) {
            onChange([...value, trimmed])
        }
        setDraft("")
    }
    return (
        <div className="space-y-2">
            <div className="flex flex-wrap gap-1.5">
                {value.map(tag => (
                    <span key={tag} className="flex items-center gap-1 px-2 py-0.5 bg-zinc-800 rounded text-xs text-zinc-200">
                        {tag}
                        <button type="button" onClick={() => onChange(value.filter(t => t !== tag))}>
                            <X className="h-3 w-3 text-zinc-500 hover:text-white" />
                        </button>
                    </span>
                ))}
            </div>
            <div className="flex gap-2">
                <input
                    type="text"
                    value={draft}
                    onChange={e => setDraft(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); add() } }}
                    placeholder={placeholder || "Add entry…"}
                    className="flex-1 bg-[#111] border border-[#333] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-zinc-500"
                />
                <button type="button" onClick={add} className="px-3 py-2 bg-[#222] border border-[#333] rounded-lg text-zinc-400 hover:text-white transition-colors">
                    <Plus className="h-4 w-4" />
                </button>
            </div>
        </div>
    )
}

function ColorInput({ value, onChange }: { value: number; onChange: (v: number) => void }) {
    const hex = `#${value.toString(16).padStart(6, "0")}`
    return (
        <div className="flex gap-2 items-center">
            <input
                type="color"
                value={hex}
                onChange={e => onChange(parseInt(e.target.value.slice(1), 16))}
                className="h-9 w-16 rounded cursor-pointer bg-transparent border border-[#333]"
            />
            <TextInput value={hex} onChange={v => { try { onChange(parseInt(v.replace("#", ""), 16)) } catch { } }} placeholder="#ffffff" maxLength={7} />
        </div>
    )
}

function SaveButton({ onClick, saving }: { onClick: () => void; saving: boolean }) {
    return (
        <button
            type="button"
            onClick={onClick}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-white text-black rounded-lg text-sm font-medium hover:bg-zinc-100 disabled:opacity-50 transition-colors"
        >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save
        </button>
    )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function BehaviorSettingsForm({ serverId, initialSettings, plan, planRetentionCeiling }: BehaviorSettingsFormProps) {
    const [s, setS] = useState<ServerSettings>(initialSettings)
    const [saving, setSaving] = useState<string | null>(null)
    const [toast, setToast] = useState<{ type: "success" | "error"; message: string } | null>(null)

    const set = useCallback(<K extends keyof ServerSettings>(key: K, val: ServerSettings[K]) => {
        setS(prev => ({ ...prev, [key]: val }))
    }, [])

    const showToast = (type: "success" | "error", message: string) => {
        setToast({ type, message })
        setTimeout(() => setToast(null), 3000)
    }

    const save = async (group: string, fields: Partial<ServerSettings>) => {
        setSaving(group)
        try {
            const res = await fetch("/api/admin/server/settings", {
                method: "PATCH",
                headers: { "Content-Type": "application/json", "x-csrf-token": "1" },
                body: JSON.stringify({ serverId, settings: fields })
            })
            if (!res.ok) {
                const err = await res.json().catch(() => ({}))
                throw new Error(err.error || "Failed to save")
            }
            showToast("success", `${group} settings saved`)
        } catch (e: any) {
            showToast("error", e.message || "Failed to save")
        } finally {
            setSaving(null)
        }
    }

    return (
        <div className="space-y-4 relative">
            {/* Toast */}
            {toast && (
                <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg text-sm font-medium shadow-lg ${toast.type === "success" ? "bg-emerald-500/20 border border-emerald-500/30 text-emerald-300" : "bg-red-500/20 border border-red-500/30 text-red-300"}`}>
                    {toast.message}
                </div>
            )}

            {/* ── Shift & Duty ── */}
            <SettingCard title="Shift & Duty" description="Rules for going on and off duty" defaultOpen>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Field label="Shift PM Branding" hint="Prefix shown in in-game PMs from POW">
                        <TextInput value={s.shiftPmBranding} onChange={v => set("shiftPmBranding", v)} placeholder="[POW]" maxLength={20} />
                    </Field>
                    <Field label="Status Format" hint="Format used in :log shift status responses">
                        <SelectInput value={s.shiftPmStatusFormat} onChange={v => set("shiftPmStatusFormat", v)} options={[
                            { value: "percent", label: "Percent of quota (75%)" },
                            { value: "time", label: "Clock time (2h 30m / 4h 0m)" },
                            { value: "remaining", label: "Remaining time (1h 30m left)" }
                        ]} />
                    </Field>
                    <Field label="Min Shift Duration (seconds)" hint="0 = no minimum. Informational only — doesn't block end.">
                        <NumberInput value={s.shiftMinDurationSeconds} onChange={v => set("shiftMinDurationSeconds", v)} />
                    </Field>
                    <Field label="Max Shift Duration (hours)" hint="0 = no maximum / no auto-end">
                        <NumberInput value={s.shiftMaxDurationHours} onChange={v => set("shiftMaxDurationHours", v)} />
                    </Field>
                    <Field label="Shift Cooldown (minutes)" hint="0 = no cooldown between shifts">
                        <NumberInput value={s.shiftCooldownMinutes} onChange={v => set("shiftCooldownMinutes", v)} />
                    </Field>
                    <Field label="Max Staff On Duty" hint="0 = unlimited concurrent on-duty staff">
                        <NumberInput value={s.shiftMaxOnDuty} onChange={v => set("shiftMaxOnDuty", v)} />
                    </Field>
                </div>
                <div className="flex flex-col gap-3 mt-2">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-zinc-200">End shifts on :shutdown</p>
                            <p className="text-xs text-zinc-500">Automatically end all active shifts when a shutdown command is detected</p>
                        </div>
                        <Toggle checked={s.shiftEndOnShutdown} onChange={v => set("shiftEndOnShutdown", v)} />
                    </div>
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-zinc-200">Require players in-game</p>
                            <p className="text-xs text-zinc-500">Block shift start if the Roblox server has no players</p>
                        </div>
                        <Toggle checked={s.shiftRequirePlayersInGame} onChange={v => set("shiftRequirePlayersInGame", v)} />
                    </div>
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-zinc-200">LOA blocks shift start</p>
                            <p className="text-xs text-zinc-500">Staff on an approved LOA cannot start a shift</p>
                        </div>
                        <Toggle checked={s.shiftLoaBlocks} onChange={v => set("shiftLoaBlocks", v)} />
                    </div>
                </div>
                <div className="pt-2 flex justify-end">
                    <SaveButton saving={saving === "Shift"} onClick={() => save("Shift", {
                        shiftPmBranding: s.shiftPmBranding,
                        shiftPmStatusFormat: s.shiftPmStatusFormat,
                        shiftMinDurationSeconds: s.shiftMinDurationSeconds,
                        shiftMaxDurationHours: s.shiftMaxDurationHours,
                        shiftCooldownMinutes: s.shiftCooldownMinutes,
                        shiftMaxOnDuty: s.shiftMaxOnDuty,
                        shiftEndOnShutdown: s.shiftEndOnShutdown,
                        shiftRequirePlayersInGame: s.shiftRequirePlayersInGame,
                        shiftLoaBlocks: s.shiftLoaBlocks,
                    })} />
                </div>
            </SettingCard>

            {/* ── Quota ── */}
            <SettingCard title="Quota" description="Period and timezone for duty time calculation">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Field label="Period Type">
                        <SelectInput value={s.quotaPeriodType} onChange={v => set("quotaPeriodType", v)} options={[
                            { value: "weekly", label: "Weekly" },
                            { value: "monthly", label: "Monthly" }
                        ]} />
                    </Field>
                    <Field label="Week Start Day" hint="Which day starts a new quota week">
                        <SelectInput value={String(s.quotaWeekStartDay) as any} onChange={v => set("quotaWeekStartDay", Number(v) as any)} options={[
                            { value: "0", label: "Sunday" },
                            { value: "1", label: "Monday" },
                            { value: "2", label: "Tuesday" },
                            { value: "3", label: "Wednesday" },
                            { value: "4", label: "Thursday" },
                            { value: "5", label: "Friday" },
                            { value: "6", label: "Saturday" },
                        ]} />
                    </Field>
                    <Field label="Timezone" hint="IANA timezone for week boundary calculation">
                        <SelectInput value={s.quotaTimezone as any} onChange={v => set("quotaTimezone", v)} options={[
                            { value: "UTC", label: "UTC" },
                            { value: "America/New_York", label: "US Eastern" },
                            { value: "America/Chicago", label: "US Central" },
                            { value: "America/Denver", label: "US Mountain" },
                            { value: "America/Los_Angeles", label: "US Pacific" },
                            { value: "America/Sao_Paulo", label: "Brazil (São Paulo)" },
                            { value: "Europe/London", label: "UK (London)" },
                            { value: "Europe/Paris", label: "Central Europe (Paris)" },
                            { value: "Europe/Berlin", label: "Central Europe (Berlin)" },
                            { value: "Europe/Moscow", label: "Moscow" },
                            { value: "Asia/Dubai", label: "Gulf (Dubai)" },
                            { value: "Asia/Kolkata", label: "India (IST)" },
                            { value: "Asia/Singapore", label: "Singapore" },
                            { value: "Asia/Tokyo", label: "Japan (JST)" },
                            { value: "Australia/Sydney", label: "Australia (Sydney)" },
                        ]} />
                    </Field>
                    <Field label="Grace Period (minutes)" hint="0 = no grace period after quota week ends">
                        <NumberInput value={s.quotaGracePeriodMinutes} onChange={v => set("quotaGracePeriodMinutes", v)} />
                    </Field>
                    <Field label="Min Shift Duration to Count (seconds)" hint="0 = all shifts count toward quota">
                        <NumberInput value={s.quotaMinCountSeconds} onChange={v => set("quotaMinCountSeconds", v)} />
                    </Field>
                </div>
                <div className="pt-2 flex justify-end">
                    <SaveButton saving={saving === "Quota"} onClick={() => save("Quota", {
                        quotaPeriodType: s.quotaPeriodType,
                        quotaWeekStartDay: s.quotaWeekStartDay,
                        quotaTimezone: s.quotaTimezone,
                        quotaGracePeriodMinutes: s.quotaGracePeriodMinutes,
                        quotaMinCountSeconds: s.quotaMinCountSeconds,
                    })} />
                </div>
            </SettingCard>

            {/* ── In-Game Commands ── */}
            <SettingCard title="In-Game Commands" description="Configure the :log prefix and per-action toggles">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Field label="Command Prefix" hint="The prefix staff use in-game (e.g. :log, :mod)">
                        <TextInput value={s.inGameCommandPrefix} onChange={v => set("inGameCommandPrefix", v)} placeholder=":log" maxLength={20} />
                    </Field>
                    <Field label="Target Lookback (minutes)" hint="How far back to search for players who recently left">
                        <NumberInput value={s.inGameTargetLookbackMinutes} onChange={v => set("inGameTargetLookbackMinutes", v)} />
                    </Field>
                    <Field label="Shutdown Patterns" hint="Commands that trigger shift-end (one per entry)">
                        <TagInput value={s.shutdownCommandPatterns} onChange={v => set("shutdownCommandPatterns", v)} placeholder=":shutdown" />
                    </Field>
                </div>
                <div className="grid grid-cols-2 gap-3 mt-2">
                    {([
                        { key: "inGameShiftEnabled", label: ":log shift" },
                        { key: "inGameWarnEnabled", label: ":log warn" },
                        { key: "inGameKickEnabled", label: ":log kick" },
                        { key: "inGameBanEnabled", label: ":log ban" },
                        { key: "inGameBoloEnabled", label: ":log bolo" },
                        { key: "inGameRobloxFallbackEnabled", label: "Roblox API fallback" },
                    ] as { key: keyof ServerSettings; label: string }[]).map(({ key, label }) => (
                        <div key={key} className="flex items-center justify-between bg-[#111] rounded-lg px-3 py-2">
                            <span className="text-sm text-zinc-300">{label}</span>
                            <Toggle checked={s[key] as boolean} onChange={v => set(key, v as any)} />
                        </div>
                    ))}
                </div>
                <div className="pt-2 flex justify-end">
                    <SaveButton saving={saving === "InGame"} onClick={() => save("InGame", {
                        inGameCommandPrefix: s.inGameCommandPrefix,
                        inGameTargetLookbackMinutes: s.inGameTargetLookbackMinutes,
                        shutdownCommandPatterns: s.shutdownCommandPatterns,
                        inGameShiftEnabled: s.inGameShiftEnabled,
                        inGameWarnEnabled: s.inGameWarnEnabled,
                        inGameKickEnabled: s.inGameKickEnabled,
                        inGameBanEnabled: s.inGameBanEnabled,
                        inGameBoloEnabled: s.inGameBoloEnabled,
                        inGameRobloxFallbackEnabled: s.inGameRobloxFallbackEnabled,
                    })} />
                </div>
            </SettingCard>

            {/* ── Raid Detection ── */}
            <SettingCard title="Raid Detection" description="Thresholds and alert appearance for the raid detector">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Field label="High-Freq Threshold" hint="Commands in window before alert triggers">
                        <NumberInput value={s.raidHighFreqThreshold} onChange={v => set("raidHighFreqThreshold", v)} min={1} />
                    </Field>
                    <Field label="High-Freq Window (seconds)">
                        <NumberInput value={s.raidHighFreqWindowSeconds} onChange={v => set("raidHighFreqWindowSeconds", v)} min={1} />
                    </Field>
                    <Field label="Alert Title">
                        <TextInput value={s.raidAlertEmbedTitle} onChange={v => set("raidAlertEmbedTitle", v)} />
                    </Field>
                    <Field label="Alert Color">
                        <ColorInput value={s.raidAlertEmbedColor} onChange={v => set("raidAlertEmbedColor", v)} />
                    </Field>
                    <Field label="Sensitive Commands" hint="Commands that contribute to detection">
                        <TagInput value={s.raidSensitiveCommands} onChange={v => set("raidSensitiveCommands", v)} placeholder=":ban" />
                    </Field>
                    <Field label="Mass Action Patterns" hint="Substrings that indicate mass targets (e.g. 'all', 'others')">
                        <TagInput value={s.raidMassActionPatterns} onChange={v => set("raidMassActionPatterns", v)} placeholder="all" />
                    </Field>
                </div>
                <div className="pt-2 flex justify-end">
                    <SaveButton saving={saving === "Raid"} onClick={() => save("Raid", {
                        raidHighFreqThreshold: s.raidHighFreqThreshold,
                        raidHighFreqWindowSeconds: s.raidHighFreqWindowSeconds,
                        raidAlertEmbedTitle: s.raidAlertEmbedTitle,
                        raidAlertEmbedColor: s.raidAlertEmbedColor,
                        raidSensitiveCommands: s.raidSensitiveCommands,
                        raidMassActionPatterns: s.raidMassActionPatterns,
                    })} />
                </div>
            </SettingCard>

            {/* ── Milestones ── */}
            <SettingCard title="Milestones" description="Milestone notifications and period settings">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Field label="Period Type">
                        <SelectInput value={s.milestonePeriodType} onChange={v => set("milestonePeriodType", v)} options={[
                            { value: "weekly", label: "Weekly" },
                            { value: "monthly", label: "Monthly" },
                            { value: "lifetime", label: "Lifetime (all time)" }
                        ]} />
                    </Field>
                    <Field label="Notification Debounce (hours)" hint="Minimum hours between duplicate milestone notifications">
                        <NumberInput value={s.milestoneDebounceHours} onChange={v => set("milestoneDebounceHours", v)} min={0} />
                    </Field>
                    <Field label="Embed Title">
                        <TextInput value={s.milestoneEmbedTitle} onChange={v => set("milestoneEmbedTitle", v)} />
                    </Field>
                    <Field label="Embed Color">
                        <ColorInput value={s.milestoneEmbedColor} onChange={v => set("milestoneEmbedColor", v)} />
                    </Field>
                </div>
                <div className="flex items-center justify-between mt-2">
                    <div>
                        <p className="text-sm text-zinc-200">Keep milestone roles permanently</p>
                        <p className="text-xs text-zinc-500">Roles are not removed if a member falls below the milestone threshold</p>
                    </div>
                    <Toggle checked={s.milestoneRolesPermanent} onChange={v => set("milestoneRolesPermanent", v)} />
                </div>
                <div className="pt-2 flex justify-end">
                    <SaveButton saving={saving === "Milestones"} onClick={() => save("Milestones", {
                        milestonePeriodType: s.milestonePeriodType,
                        milestoneDebounceHours: s.milestoneDebounceHours,
                        milestoneRolesPermanent: s.milestoneRolesPermanent,
                        milestoneEmbedTitle: s.milestoneEmbedTitle,
                        milestoneEmbedColor: s.milestoneEmbedColor,
                    })} />
                </div>
            </SettingCard>

            {/* ── Leave of Absence ── */}
            <SettingCard title="Leave of Absence" description="LOA request validation and notification settings">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Field label="Max Duration (days)" hint="0 = unlimited. Rejects requests longer than this.">
                        <NumberInput value={s.loaMaxDurationDays} onChange={v => set("loaMaxDurationDays", v)} />
                    </Field>
                    <Field label="Min Notice (days)" hint="0 = no minimum. How far in advance the start date must be.">
                        <NumberInput value={s.loaMinNoticeDays} onChange={v => set("loaMinNoticeDays", v)} />
                    </Field>
                    <Field label="Max Pending Per Member" hint="0 = unlimited pending requests per member">
                        <NumberInput value={s.loaMaxPendingPerMember} onChange={v => set("loaMaxPendingPerMember", v)} />
                    </Field>
                    <Field label="Embed Color">
                        <ColorInput value={s.loaEmbedColor} onChange={v => set("loaEmbedColor", v)} />
                    </Field>
                </div>
                <div className="flex flex-col gap-3 mt-2">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-zinc-200">Fallback to staff request channel</p>
                            <p className="text-xs text-zinc-500">If no LOA channel is configured, send notifications to the staff request channel</p>
                        </div>
                        <Toggle checked={s.loaFallbackToStaffChannel} onChange={v => set("loaFallbackToStaffChannel", v)} />
                    </div>
                </div>
                <p className="text-xs text-zinc-500 mt-3">
                    To prevent staff on LOA from starting a shift, enable <strong className="text-zinc-400">LOA blocks shift start</strong> in the <strong className="text-zinc-400">Shift &amp; Duty</strong> section above.
                </p>
                <div className="pt-2 flex justify-end">
                    <SaveButton saving={saving === "LOA"} onClick={() => save("LOA", {
                        loaMaxDurationDays: s.loaMaxDurationDays,
                        loaMinNoticeDays: s.loaMinNoticeDays,
                        loaMaxPendingPerMember: s.loaMaxPendingPerMember,
                        loaEmbedColor: s.loaEmbedColor,
                        loaFallbackToStaffChannel: s.loaFallbackToStaffChannel,
                    })} />
                </div>
            </SettingCard>

            {/* ── Punishment ── */}
            <SettingCard title="Punishment" description="Punishment types and notification behavior">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Field label="Punishment Types" hint="Types available in the Perm Log UI">
                        <TagInput value={s.punishmentTypes} onChange={v => set("punishmentTypes", v)} placeholder="Warn" />
                    </Field>
                    <Field label="Warn Auto-Resolve (days)" hint="0 = never auto-resolve warnings">
                        <NumberInput value={s.punishmentWarnAutoResolveDays} onChange={v => set("punishmentWarnAutoResolveDays", v)} />
                    </Field>
                </div>
                <div className="flex flex-col gap-3 mt-2">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-zinc-200">Enforce ban in-game</p>
                            <p className="text-xs text-zinc-500">Execute :ban in Roblox when a Ban is logged in POW</p>
                        </div>
                        <Toggle checked={s.banEnforceInGame} onChange={v => set("banEnforceInGame", v)} />
                    </div>
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-zinc-200">Notify on punishment create</p>
                            <p className="text-xs text-zinc-500">Send a Discord notification to the perm log channel when a punishment is issued</p>
                        </div>
                        <Toggle checked={s.punishmentNotifyOnCreate} onChange={v => set("punishmentNotifyOnCreate", v)} />
                    </div>
                </div>
                <div className="pt-2 flex justify-end">
                    <SaveButton saving={saving === "Punishment"} onClick={() => save("Punishment", {
                        punishmentTypes: s.punishmentTypes,
                        punishmentWarnAutoResolveDays: s.punishmentWarnAutoResolveDays,
                        banEnforceInGame: s.banEnforceInGame,
                        punishmentNotifyOnCreate: s.punishmentNotifyOnCreate,
                    })} />
                </div>
            </SettingCard>

            {/* ── Forms ── */}
            <SettingCard title="Forms" description="Defaults for newly created forms">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Field label="Min Roblox Account Age (days)" hint="0 = no minimum. Reject form submissions from accounts younger than this.">
                        <NumberInput value={s.formMinRobloxAccountAgeDays} onChange={v => set("formMinRobloxAccountAgeDays", v)} />
                    </Field>
                </div>
                <div className="flex flex-col gap-3 mt-2">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-zinc-200">Allow multiple submissions by default</p>
                            <p className="text-xs text-zinc-500">New forms default to allowing the same person to submit more than once</p>
                        </div>
                        <Toggle checked={s.formDefaultAllowMultiple} onChange={v => set("formDefaultAllowMultiple", v)} />
                    </div>
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-zinc-200">Notify on form expiry</p>
                            <p className="text-xs text-zinc-500">Send a notification when a form reaches its expiry date</p>
                        </div>
                        <Toggle checked={s.formExpiryNotification} onChange={v => set("formExpiryNotification", v)} />
                    </div>
                </div>
                <div className="pt-2 flex justify-end">
                    <SaveButton saving={saving === "Forms"} onClick={() => save("Forms", {
                        formMinRobloxAccountAgeDays: s.formMinRobloxAccountAgeDays,
                        formDefaultAllowMultiple: s.formDefaultAllowMultiple,
                        formExpiryNotification: s.formExpiryNotification,
                    })} />
                </div>
            </SettingCard>

            {/* ── Notifications & Branding ── */}
            <SettingCard title="Notifications & Branding" description="Staff request messages, embed colors, and display settings">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Field label="Staff Request PM Branding" hint="Shown at the end of in-game staff request PMs">
                        <TextInput value={s.staffRequestPmBranding} onChange={v => set("staffRequestPmBranding", v)} placeholder="Project Overwatch" maxLength={40} />
                    </Field>
                    <Field label="Staff Request Embed Color">
                        <ColorInput value={s.staffRequestEmbedColor} onChange={v => set("staffRequestEmbedColor", v)} />
                    </Field>
                    <Field label="JIT Verify Interval (minutes)" hint="How often to re-sync Discord roles for a member">
                        <NumberInput value={s.jitVerifyIntervalMinutes} onChange={v => set("jitVerifyIntervalMinutes", v)} min={1} />
                    </Field>
                    <Field label="SSD Display Window (days)" hint="How long ago a server shutdown is still shown in the mod panel">
                        <NumberInput value={s.ssdDisplayDays} onChange={v => set("ssdDisplayDays", v)} min={1} />
                    </Field>
                </div>
                <div className="flex flex-col gap-3 mt-2">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-zinc-200">DM on LOA approval</p>
                            <p className="text-xs text-zinc-500">Send a Discord DM to the staff member when their LOA is approved</p>
                        </div>
                        <Toggle checked={s.loaApprovalDmNotify} onChange={v => set("loaApprovalDmNotify", v)} />
                    </div>
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-zinc-200">Show all teams on player map</p>
                            <p className="text-xs text-zinc-500">If off, only staff teams are visible on the map</p>
                        </div>
                        <Toggle checked={s.mapShowAllTeams} onChange={v => set("mapShowAllTeams", v)} />
                    </div>
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-zinc-200">Vehicle tracking</p>
                            <p className="text-xs text-zinc-500">Save vehicle snapshot data from the PRC API</p>
                        </div>
                        <Toggle checked={s.vehicleTrackingEnabled} onChange={v => set("vehicleTrackingEnabled", v)} />
                    </div>
                </div>
                <div className="pt-2 flex justify-end">
                    <SaveButton saving={saving === "Notifications"} onClick={() => save("Notifications", {
                        staffRequestPmBranding: s.staffRequestPmBranding,
                        staffRequestEmbedColor: s.staffRequestEmbedColor,
                        jitVerifyIntervalMinutes: s.jitVerifyIntervalMinutes,
                        ssdDisplayDays: s.ssdDisplayDays,
                        loaApprovalDmNotify: s.loaApprovalDmNotify,
                        mapShowAllTeams: s.mapShowAllTeams,
                        vehicleTrackingEnabled: s.vehicleTrackingEnabled,
                    })} />
                </div>
            </SettingCard>

            {/* ── Automation ── */}
            <SettingCard title="Automation" description="Announcement prefix and time interval defaults">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Field label="Announcement Command Prefix" hint="PRC command prefix for ANNOUNCEMENT automation actions">
                        <TextInput value={s.announcementCommandPrefix} onChange={v => set("announcementCommandPrefix", v)} placeholder=":m" maxLength={20} />
                    </Field>
                    <Field label="Default Time Interval (minutes)" hint="Default interval for TIME_INTERVAL automations with no explicit value">
                        <NumberInput value={s.timeIntervalDefaultMinutes} onChange={v => set("timeIntervalDefaultMinutes", v)} min={1} />
                    </Field>
                    <Field label="Mod Call Dedupe Window (minutes)" hint="Window used to match incoming mod calls to existing DB records">
                        <NumberInput value={s.modCallDedupeWindowMinutes} onChange={v => set("modCallDedupeWindowMinutes", v)} min={1} />
                    </Field>
                </div>
                <div className="pt-2 flex justify-end">
                    <SaveButton saving={saving === "Automation"} onClick={() => save("Automation", {
                        announcementCommandPrefix: s.announcementCommandPrefix,
                        timeIntervalDefaultMinutes: s.timeIntervalDefaultMinutes,
                        modCallDedupeWindowMinutes: s.modCallDedupeWindowMinutes,
                    })} />
                </div>
            </SettingCard>

            {/* ── SSE Snapshot Windows ── */}
            <SettingCard title="Live Data Snapshots" description="How much historical data is sent on initial SSE connection">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Field label="Player Window (minutes)" hint="How far back to look for player location data on connect">
                        <NumberInput value={s.ssePlayerWindowMinutes} onChange={v => set("ssePlayerWindowMinutes", v)} min={1} />
                    </Field>
                    <Field label="Mod Call Snapshot Limit" hint="Max mod calls included in the initial snapshot">
                        <NumberInput value={s.sseModCallSnapshotLimit} onChange={v => set("sseModCallSnapshotLimit", v)} min={1} max={200} />
                    </Field>
                    <Field label="Emergency Call Snapshot Limit" hint="Max 911 calls included in the initial snapshot">
                        <NumberInput value={s.sseEmergencySnapshotLimit} onChange={v => set("sseEmergencySnapshotLimit", v)} min={1} max={200} />
                    </Field>
                </div>
                <div className="pt-2 flex justify-end">
                    <SaveButton saving={saving === "SSE"} onClick={() => save("SSE", {
                        ssePlayerWindowMinutes: s.ssePlayerWindowMinutes,
                        sseModCallSnapshotLimit: s.sseModCallSnapshotLimit,
                        sseEmergencySnapshotLimit: s.sseEmergencySnapshotLimit,
                    })} />
                </div>
            </SettingCard>

            {/* ── Data Retention ── */}
            <SettingCard title="Data Retention" description="How long historical records are kept before automatic deletion">
                <div className="flex items-start gap-3 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg mb-4">
                    <AlertTriangle className="h-4 w-4 text-amber-400 mt-0.5 flex-shrink-0" />
                    <div className="text-xs text-amber-300">
                        <strong>Warning:</strong> Deleting data is permanent and cannot be undone. Records older than your retention window are purged once per day.
                        Your plan (<strong className="text-amber-200">{plan.toUpperCase()}</strong>) allows a maximum of <strong className="text-amber-200">{planRetentionCeiling} days</strong>.
                    </div>
                </div>
                <Field label="Retention Period (days)" hint={`Logs, shifts, punishments, and calls older than this are deleted. Max for your plan: ${planRetentionCeiling} days.`}>
                    <div className="space-y-2">
                        <input
                            type="range"
                            min={1}
                            max={planRetentionCeiling}
                            value={Math.min(s.dataRetentionDays, planRetentionCeiling)}
                            onChange={e => set("dataRetentionDays", Number(e.target.value))}
                            className="w-full accent-emerald-500"
                        />
                        <div className="flex items-center justify-between">
                            <span className="text-xs text-zinc-500">1 day</span>
                            <span className="text-sm font-medium text-white">{Math.min(s.dataRetentionDays, planRetentionCeiling)} days</span>
                            <span className="text-xs text-zinc-500">{planRetentionCeiling} days</span>
                        </div>
                    </div>
                </Field>
                <div className="pt-2 flex justify-end">
                    <SaveButton saving={saving === "Retention"} onClick={() => save("Retention", {
                        dataRetentionDays: Math.min(s.dataRetentionDays, planRetentionCeiling),
                    })} />
                </div>
            </SettingCard>
        </div>
    )
}
