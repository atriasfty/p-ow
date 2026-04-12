"use client"

import { useState, useEffect } from "react"
import { X, Save, Plus, Trash2, Check, ExternalLink, Loader2 } from "lucide-react"

interface Automation {
    id: string
    name: string
    enabled: boolean
    trigger: string
    conditions: string // JSON
    actions: string // JSON
    serverId?: string
    createdAt?: string
}

interface Action {
    type: "DISCORD_MESSAGE" | "DISCORD_DM" | "LOG_ENTRY" | "SHIFT_LOG" | "PRC_COMMAND" | "HTTP_REQUEST" | "DELAY" |
    "KICK_PLAYER" | "BAN_PLAYER" | "WARN_PLAYER" | "ANNOUNCEMENT" | "TELEPORT_PLAYER" | "KILL_PLAYER"
    target?: string // Discord channel ID, etc.
    content: string // Message content
}

interface AutomationEditorProps {
    serverId: string
    automation?: Automation
    onClose: () => void
    onSave: (automation: Automation) => void
}

const TRIGGERS = [
    { value: "PLAYER_JOIN", label: "Player Join" },
    { value: "PLAYER_LEAVE", label: "Player Leave" },
    { value: "SHIFT_START", label: "Shift Start" },
    { value: "SHIFT_END", label: "Shift End" },
    { value: "PUNISHMENT_ISSUED", label: "Any Punishment Issued" },
    { value: "WARN_ISSUED", label: "Warn Issued" },
    { value: "KICK_ISSUED", label: "Kick Issued" },
    { value: "BAN_ISSUED", label: "Ban Issued" },
    { value: "MEMBER_ROLE_UPDATED", label: "Member Role Updated" },
    { value: "COMMAND_USED", label: "Command Used" },
    { value: "PLAYER_KILL", label: "Player Kill" },
    { value: "PLAYER_DEATH", label: "Player Death" },
    { value: "SERVER_STARTUP", label: "Server Startup" },
    { value: "BOLO_CREATED", label: "BOLO Created" },
    { value: "BOLO_CLEARED", label: "BOLO Cleared" },
    { value: "DISCORD_MESSAGE_RECEIVED", label: "Discord Message Received" },
    { value: "TIME_INTERVAL", label: "Every X Minutes (Time)" },
]



export function AutomationEditor({ serverId, automation, onClose, onSave }: AutomationEditorProps) {
    const [name, setName] = useState(automation?.name || "")
    const [trigger, setTrigger] = useState(automation?.trigger || "PLAYER_JOIN")
    const [enabled, setEnabled] = useState(automation?.enabled ?? true)
    const [conditions, setConditions] = useState(automation?.conditions || "[]")

    // Actions state
    const [actions, setActions] = useState<Action[]>(
        automation ? JSON.parse(automation.actions || "[]") : []
    )

    const [saving, setSaving] = useState(false)

    const addAction = (type: Action["type"]) => {
        setActions([...actions, { type, content: "", target: "" }])
    }

    const updateAction = (index: number, field: keyof Action, value: string) => {
        const newActions = [...actions]
        newActions[index] = { ...newActions[index], [field]: value }
        setActions(newActions)
    }

    const removeAction = (index: number) => {
        setActions(actions.filter((_, i) => i !== index))
    }

    const handleSubmit = async () => {
        setSaving(true)
        try {
            const res = await fetch("/api/admin/automations", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    serverId,
                    id: automation?.id,
                    name,
                    trigger,
                    conditions,
                    actions,
                    enabled
                })
            })

            if (res.ok) {
                const data = await res.json()
                onSave(data)
            }
        } catch (e) {
            console.error("Error saving automation:", e)
        } finally {
            setSaving(false)
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="w-full max-w-4xl bg-[#1a1a1a] rounded-2xl border border-[#333] overflow-hidden max-h-[90vh] flex flex-col shadow-2xl">
                {/* Header */}
                <div className="p-6 border-b border-[#222] flex items-center justify-between bg-[#1f1f1f]">
                    <div>
                        <h3 className="text-xl font-bold text-white">{automation ? "Edit Automation" : "New Automation"}</h3>
                        <p className="text-xs text-zinc-500">Configure triggers and automated actions</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-white/10 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-500"
                        aria-label="Close automation editor modal"
                    >
                        <X className="h-5 w-5 text-zinc-400" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    {/* Basic Info */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="col-span-2">
                            <label className="block text-sm font-medium text-zinc-400 mb-2">Automation Name</label>
                            <input
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                className="w-full bg-[#222] border border-[#333] rounded-lg px-4 py-3 text-white focus:outline-none focus:border-indigo-500 transition-colors"
                                placeholder="e.g. Welcome Message"
                            />
                        </div>

                        <div className="flex flex-col gap-4">
                            <div>
                                <label className="block text-sm font-medium text-zinc-400 mb-2">Trigger Event</label>
                                <select
                                    value={trigger}
                                    onChange={(e) => {
                                        const newTrigger = e.target.value
                                        setTrigger(newTrigger)
                                        // Auto-reset conditions format when switching between Time and Event triggers
                                        if (newTrigger === "TIME_INTERVAL") {
                                            setConditions(JSON.stringify({ intervalMinutes: "60" }))
                                        } else if (trigger === "TIME_INTERVAL") {
                                            setConditions("[]")
                                        }
                                    }}
                                    className="w-full bg-[#222] border border-[#333] rounded-lg px-4 py-3 text-white focus:outline-none focus:border-indigo-500 appearance-none"
                                >
                                    {TRIGGERS.map(t => (
                                        <option key={t.value} value={t.value}>{t.label}</option>
                                    ))}
                                </select>
                            </div>

                            {trigger === "TIME_INTERVAL" && (
                                <div>
                                    <label className="block text-sm font-medium text-zinc-400 mb-2">Interval (Minutes)</label>
                                    <input
                                        type="number"
                                        min="1"
                                        value={(() => {
                                            try {
                                                const c = JSON.parse(conditions || "{}")
                                                return c.intervalMinutes || "60"
                                            } catch (e) { return "60" }
                                        })()}
                                        onChange={(e) => {
                                            const val = e.target.value
                                            setConditions(JSON.stringify({ intervalMinutes: val }))
                                        }}
                                        className="w-full bg-[#222] border border-[#333] rounded-lg px-4 py-3 text-white focus:outline-none focus:border-indigo-500 transition-colors"
                                        placeholder="60"
                                    />
                                    <p className="text-[10px] text-zinc-500 mt-1 italic">
                                        Automation will run every {(() => {
                                            try {
                                                const c = JSON.parse(conditions || "{}")
                                                return c.intervalMinutes || "60"
                                            } catch (e) { return "60" }
                                        })()} minutes.
                                    </p>
                                </div>
                            )}

                            <label className="flex items-center gap-3 p-4 rounded-lg bg-[#222] border border-[#333] cursor-pointer hover:bg-[#2a2a2a] transition-colors">
                                <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${enabled ? 'bg-indigo-500 border-indigo-500' : 'border-zinc-500'}`}>
                                    {enabled && <Check className="h-3 w-3 text-white" />}
                                </div>
                                <input
                                    type="checkbox"
                                    checked={enabled}
                                    onChange={(e) => setEnabled(e.target.checked)}
                                    className="hidden"
                                />
                                <span className="text-sm font-medium text-zinc-300">Enable Automation</span>
                            </label>
                        </div>

                        {/* Conditions Section */}
                        {trigger !== "TIME_INTERVAL" && (
                            <div>
                                <div className="flex items-center justify-between mb-4">
                                    <label className="text-sm font-medium text-zinc-400">Conditions (Optional)</label>
                                    <button
                                        onClick={() => {
                                            const current = JSON.parse(conditions || "[]")
                                            setConditions(JSON.stringify([...current, { field: "server.playerCount", operator: "GREATER_THAN", value: "0" }]))
                                        }}
                                        className="px-3 py-1.5 text-xs bg-[#222] hover:bg-[#333] border border-[#333] rounded-md text-zinc-300 transition-colors"
                                    >
                                        + Add Condition
                                    </button>
                                </div>

                                <div className="space-y-2 mb-6">
                                    {(() => {
                                        try {
                                            const conds = JSON.parse(conditions || "[]")
                                            if (!Array.isArray(conds) || conds.length === 0) return <p className="text-xs text-zinc-600 italic">No conditions set (trigger always runs)</p>

                                            const FIELDS = [
                                                { val: "server.playerCount", label: "Server Player Count", type: "number" },
                                                { val: "player.name", label: "Player Name", type: "string" },
                                                { val: "player.id", label: "Player ID", type: "string" },
                                                { val: "player.team", label: "Player Team", type: "enum", options: ["Civilian", "Sheriff", "Police", "Fire", "DOT", "Unknown"] },
                                                { val: "player.vehicle", label: "Player Vehicle", type: "string" },
                                                { val: "player.callsign", label: "Player Callsign", type: "string" },
                                                { val: "player.permission", label: "Player Permission Lvl", type: "enum", options: ["0", "1", "2", "3", "255"] },
                                                { val: "player.is_staff", label: "Is Staff?", type: "enum", options: ["true", "false"] },
                                                { val: "server.whitelisted", label: "Server Whitelisted?", type: "enum", options: ["true", "false"] },
                                            ]

                                            return conds.map((c: any, i: number) => {
                                                const fieldDef = FIELDS.find(f => f.val === c.field) || FIELDS[0]
                                                const isString = fieldDef.type === "string"

                                                return (
                                                    <div key={i} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 bg-[#222] p-2 rounded border border-[#333]">
                                                        <div className="flex-1 min-w-[140px]">
                                                            <select
                                                                value={c.field}
                                                                onChange={(e) => {
                                                                    const newConds = [...conds]; newConds[i].field = e.target.value; setConditions(JSON.stringify(newConds))
                                                                }}
                                                                className="w-full bg-[#1a1a1a] text-xs text-white p-2 rounded border border-[#333] outline-none"
                                                            >
                                                                {FIELDS.map(f => <option key={f.val} value={f.val}>{f.label}</option>)}
                                                            </select>
                                                        </div>

                                                        <div className="w-[120px]">
                                                            <select
                                                                value={c.operator}
                                                                onChange={(e) => {
                                                                    const newConds = [...conds]; newConds[i].operator = e.target.value; setConditions(JSON.stringify(newConds))
                                                                }}
                                                                className="w-full bg-[#1a1a1a] text-xs text-white p-2 rounded border border-[#333] outline-none"
                                                            >
                                                                <option value="EQUALS">Equals</option>
                                                                <option value="NOT_EQUALS">Not Equals</option>
                                                                {(!isString && fieldDef.type !== 'enum') && <option value="GREATER_THAN">&gt; Greater Than</option>}
                                                                {(!isString && fieldDef.type !== 'enum') && <option value="LESS_THAN">&lt; Less Than</option>}
                                                                {isString && <option value="CONTAINS">Contains</option>}
                                                            </select>
                                                        </div>

                                                        <div className="flex-1">
                                                            {/* Value Input - Context Aware */}
                                                            {fieldDef.type === "enum" && fieldDef.options ? (
                                                                <select
                                                                    value={c.value}
                                                                    onChange={(e) => {
                                                                        const newConds = [...conds]; newConds[i].value = e.target.value; setConditions(JSON.stringify(newConds))
                                                                    }}
                                                                    className="w-full bg-[#1a1a1a] text-xs text-white p-2 rounded border border-[#333] outline-none"
                                                                >
                                                                    {fieldDef.options.map((opt: string) => <option key={opt} value={opt}>{opt}</option>)}
                                                                </select>
                                                            ) : (
                                                                <input
                                                                    type="text"
                                                                    value={c.value}
                                                                    onChange={(e) => {
                                                                        const newConds = [...conds]; newConds[i].value = e.target.value; setConditions(JSON.stringify(newConds))
                                                                    }}
                                                                    className="w-full bg-[#1a1a1a] text-xs text-white p-2 rounded border border-[#333] outline-none"
                                                                    placeholder="Value..."
                                                                />
                                                            )}
                                                        </div>

                                                        <button
                                                            onClick={() => {
                                                                const newConds = conds.filter((_, idx) => idx !== i); setConditions(JSON.stringify(newConds))
                                                            }}
                                                            className="p-2 text-zinc-500 hover:text-red-400 hover:bg-red-500/10 rounded transition-colors"
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </button>
                                                    </div>
                                                )
                                            })
                                        } catch (e) { return null }
                                    })()}
                                </div>
                            </div>
                        )}

                        {/* Actions Section */}
                        <div>
                            <div className="flex items-center justify-between mb-4">
                                <label className="text-sm font-medium text-zinc-400">Actions</label>
                                <div className="flex gap-2">
                                    <select
                                        id="actionSelect"
                                        className="bg-[#222] text-xs text-white p-1.5 rounded border border-[#333] outline-none max-w-[200px]"
                                    >
                                        <option value="DISCORD_MESSAGE">Discord Message</option>
                                        <option value="DISCORD_DM">Discord DM</option>
                                        <option value="LOG_ENTRY">Log Entry</option>
                                        <option value="SHIFT_LOG">Shift Log</option>
                                        <option value="PRC_COMMAND">Custom Command</option>
                                        <option value="KICK_PLAYER">Kick Player</option>
                                        <option value="BAN_PLAYER">Ban Player</option>
                                        <option value="WARN_PLAYER">Warn Player (DB)</option>
                                        <option value="ANNOUNCEMENT">Server Announcement</option>
                                        <option value="KILL_PLAYER">Kill Player</option>
                                        <option value="HTTP_REQUEST">Webhook / HTTP</option>
                                        <option value="DELAY">Delay / Wait</option>
                                    </select>
                                    <button
                                        onClick={() => {
                                            const select = document.getElementById("actionSelect") as HTMLSelectElement
                                            addAction(select.value as any)
                                        }}
                                        className="px-3 py-1.5 text-xs bg-indigo-500 hover:bg-indigo-600 text-white rounded-md transition-colors font-medium"
                                    >
                                        + Add Action
                                    </button>
                                </div>
                            </div>

                            <div className="space-y-3">
                                {actions.length === 0 ? (
                                    <div className="p-8 border-2 border-dashed border-[#333] rounded-xl text-center">
                                        <p className="text-zinc-500 text-sm">No actions configured yet.</p>
                                        <p className="text-zinc-600 text-xs mt-1">Select an action type above and click Add.</p>
                                    </div>
                                ) : (
                                    actions.map((action, idx) => (
                                        <div key={idx} className="bg-[#222] border border-[#333] rounded-lg p-4 relative group">
                                            <button
                                                onClick={() => removeAction(idx)}
                                                className="absolute top-2 right-2 p-1.5 text-zinc-500 hover:text-red-400 hover:bg-red-500/10 rounded transition-colors opacity-0 group-hover:opacity-100"
                                                aria-label={`Remove ${action.type.replace("_", " ")} action`}
                                                title={`Remove ${action.type.replace("_", " ")} action`}
                                            >
                                                <Trash2 className="h-3.5 w-3.5" />
                                            </button>

                                            <div className="mb-3">
                                                <span className="text-xs font-bold text-indigo-400 uppercase tracking-wider bg-indigo-500/10 px-2 py-1 rounded">
                                                    {action.type.replace("_", " ")}
                                                </span>
                                            </div>

                                            <div className="space-y-3">
                                                {/* Target Input - Shown for specific types */}
                                                {(action.type === "DISCORD_MESSAGE" || action.type === "DISCORD_DM" || action.type === "HTTP_REQUEST" || action.type === "TELEPORT_PLAYER") && (
                                                    <div>
                                                        <label className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider mb-1 block">Target</label>
                                                        <input
                                                            type="text"
                                                            value={action.target}
                                                            onChange={(e) => updateAction(idx, "target", e.target.value)}
                                                            placeholder={
                                                                action.type === "HTTP_REQUEST" ? "https://api.example.com/webhook" :
                                                                    action.type === "DISCORD_MESSAGE" ? "Channel ID (e.g. 123456789)" :
                                                                        action.type === "DISCORD_DM" ? "User ID (e.g. 123456789)" :
                                                                            "Destination (Player Name or Position)"
                                                            }
                                                            className="w-full bg-[#1a1a1a] border border-[#333] rounded px-3 py-2 text-sm text-white focus:border-indigo-500 outline-none"
                                                        />
                                                    </div>
                                                )}

                                                {/* Content Input - Context Aware */}
                                                {action.type !== "KILL_PLAYER" && (
                                                    <div>
                                                        <label className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider mb-1 block">
                                                            {action.type === "DELAY" ? "Duration (ms)" :
                                                                "Content / Payload"}
                                                        </label>

                                                        <textarea
                                                            value={action.content}
                                                            onChange={(e) => updateAction(idx, "content", e.target.value)}
                                                            placeholder={
                                                                action.type === "PRC_COMMAND" ? "Command string (e.g. :kick %player%)" :
                                                                    action.type === "DELAY" ? "5000" :
                                                                        action.type === "HTTP_REQUEST" ? "JSON Body (e.g. {\"username\": \"{player_name}\"})" :
                                                                            action.type === "ANNOUNCEMENT" ? "Message to broadcast..." :
                                                                                "Message content..."
                                                            }
                                                            className="w-full bg-[#1a1a1a] border border-[#333] rounded px-3 py-2 text-sm text-white focus:border-indigo-500 outline-none min-h-[80px]"
                                                        />

                                                        {/* Variable Helper (Only show for text inputs) */}
                                                        {action.type !== "DELAY" && (
                                                            <div className="text-[10px] text-zinc-500 mt-2">
                                                                <p className="font-medium text-zinc-400 mb-1">Available Variables:</p>
                                                                <div className="flex gap-1.5 flex-wrap font-mono">
                                                                    <span className="bg-[#333] px-1.5 py-0.5 rounded text-indigo-300">{`{player_name}`}</span>
                                                                    <span className="bg-[#333] px-1.5 py-0.5 rounded text-indigo-300">{`{player_team}`}</span>
                                                                    <span className="bg-[#333] px-1.5 py-0.5 rounded text-indigo-300">{`{player_count}`}</span>
                                                                    <span className="bg-[#333] px-1.5 py-0.5 rounded text-indigo-300">{`{punishment_type}`}</span>
                                                                    <span className="bg-[#333] px-1.5 py-0.5 rounded text-indigo-300">{`{punishment_reason}`}</span>
                                                                    <span className="bg-[#333] px-1.5 py-0.5 rounded text-indigo-300">{`{punishment_issuer}`}</span>
                                                                    <span className="bg-[#333] px-1.5 py-0.5 rounded text-indigo-300">{`{punishment_target}`}</span>
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-[#222] flex justify-end gap-3 bg-[#1f1f1f]">
                    <button
                        onClick={onClose}
                        className="px-5 py-2.5 rounded-lg text-zinc-400 hover:text-white hover:bg-[#333] transition-colors font-medium text-sm"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={!name.trim() || actions.length === 0 || saving}
                        className="flex items-center gap-2 px-6 py-2.5 rounded-lg bg-indigo-500 hover:bg-indigo-600 text-white font-medium transition-colors disabled:opacity-50 text-sm shadow-lg shadow-indigo-500/20"
                    >
                        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                        Save Automation
                    </button>
                </div>
            </div>
        </div>
    )
}
