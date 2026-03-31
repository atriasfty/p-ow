import { NextResponse } from "next/server"

export async function GET() {
    const spec = {
        openapi: "3.0.0",
        info: {
            title: "Project Overwatch Public API",
            version: "1.0.0",
            description: "The official REST API for integrating your external tools, bots, and services securely with your POW Server.",
            contact: {
                name: "Developer Support",
                url: "https://pow.ciankelly.xyz/support"
            }
        },
        servers: [
            {
                url: "https://pow.ciankelly.xyz/api/public/v1",
                description: "Production Environment"
            }
        ],
        components: {
            securitySchemes: {
                BearerAuth: {
                    type: "http",
                    scheme: "bearer",
                    bearerFormat: "API Key",
                    description: "Provide your public API key as a Bearer token: `Authorization: Bearer pow_...`"
                }
            },
            schemas: {
                ErrorResponse: {
                    type: "object",
                    properties: {
                        error: { type: "string" }
                    }
                },
                ServerInfo: {
                    type: "object",
                    description: "Metadata about the POW workspace server linked to your API key.",
                    properties: {
                        id: { type: "string", description: "The unique internal POW server ID (CUID format, e.g. 'clx...'). Used internally by POW — you generally won't need this." },
                        name: { type: "string", description: "The PRC private server name." },
                        customName: { type: "string", description: "The display name override set by the server admin, if any." },
                        createdAt: { type: "string", format: "date-time", description: "ISO 8601 timestamp of when the server was registered on POW." }
                    }
                },
                Player: {
                    type: "object",
                    description: "A player currently online in the PRC game server.",
                    properties: {
                        id: { type: "string", description: "The player's Roblox User ID (numeric string, e.g. '123456789')." },
                        name: { type: "string", description: "The player's current Roblox display name." },
                        team: { type: "string", description: "The in-game team the player belongs to (e.g. 'Civilian', 'Police')." },
                        callsign: { type: "string", description: "The player's in-game callsign, if set." }
                    }
                },
                Punishment: {
                    type: "object",
                    description: "A moderation action logged against a Roblox player.",
                    properties: {
                        id: { type: "string", description: "Unique punishment record ID (CUID format)." },
                        userId: { type: "string", description: "The Roblox User ID of the punished player (numeric string, e.g. '123456789')." },
                        moderatorId: { type: "string", description: "The Roblox User ID of the staff member who issued the punishment." },
                        type: { type: "string", enum: ["Warn", "Kick", "Ban", "Ban Bolo"], description: "The type of moderation action taken." },
                        reason: { type: "string", description: "The reason provided for the punishment (optional on creation)." },
                        resolved: { type: "boolean", description: "Whether this punishment has been resolved/appealed." },
                        createdAt: { type: "string", format: "date-time", description: "ISO 8601 timestamp of when the punishment was logged." }
                    }
                }
            }
        },
        security: [
            { BearerAuth: [] }
        ],
        paths: {
            "/servers": {
                get: {
                    summary: "Get Server Info",
                    description: "Returns the workspace server associated with your API key.",
                    tags: ["Servers"],
                    responses: {
                        200: {
                            description: "Server metadata array",
                            content: {
                                "application/json": {
                                    schema: { type: "array", items: { $ref: "#/components/schemas/ServerInfo" } }
                                }
                            }
                        }
                    }
                }
            },
            "/players": {
                get: {
                    summary: "List Online Players",
                    description: "Fetches live player data from the game server.",
                    tags: ["Live Data"],
                    parameters: [],
                    responses: {
                        200: {
                            description: "List of online players",
                            content: {
                                "application/json": {
                                    schema: {
                                        type: "object",
                                        properties: {
                                            serverId: { type: "string", description: "The internal POW server ID." },
                                            playerCount: { type: "integer", description: "Number of players currently online." },
                                            players: { type: "array", items: { $ref: "#/components/schemas/Player" } }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            },
            "/punishments": {
                get: {
                    summary: "List Punishments",
                    description: "Retrieves a history of past punishments.",
                    tags: ["Moderation"],
                    parameters: [
                        { name: "userId", in: "query", required: false, schema: { type: "string" }, description: "Filter by Roblox User ID of the punished player (numeric string, e.g. '123456789')." },
                        { name: "limit", in: "query", required: false, schema: { type: "integer", default: 50, maximum: 100 } },
                        { name: "page", in: "query", required: false, schema: { type: "integer", default: 1 } }
                    ],
                    responses: {
                        200: {
                            description: "List of punishments",
                            content: { "application/json": { schema: { type: "array", items: { $ref: "#/components/schemas/Punishment" } } } }
                        }
                    }
                },
                post: {
                    summary: "Log a New Punishment",
                    description: "Records a new moderation action into the system.",
                    tags: ["Moderation"],
                    requestBody: {
                        required: true,
                        content: {
                            "application/json": {
                                schema: {
                                    type: "object",
                                    required: ["userId", "moderatorId", "type"],
                                    properties: {
                                        userId: { type: "string", description: "Roblox User ID of the player being punished (numeric string, e.g. '123456789')." },
                                        moderatorId: { type: "string", description: "Roblox User ID of the staff member issuing the punishment." },
                                        type: { type: "string", enum: ["Warn", "Kick", "Ban", "Ban Bolo"] },
                                        reason: { type: "string" }
                                    }
                                }
                            }
                        }
                    },
                    responses: {
                        200: { description: "Punishment created", content: { "application/json": { schema: { $ref: "#/components/schemas/Punishment" } } } }
                    }
                }
            },
            "/shifts/status": {
                get: {
                    summary: "Check Shift Status",
                    description: "Checks if a specific staff member is currently on duty.",
                    tags: ["Shifts"],
                    parameters: [
                        { name: "userId", in: "query", required: true, schema: { type: "string" }, description: "The Clerk user ID of the staff member (e.g. 'user_2x...'). This is the POW account ID, not a Roblox ID." }
                    ],
                    responses: {
                        200: {
                            description: "User shift status",
                            content: {
                                "application/json": {
                                    schema: {
                                        type: "object",
                                        properties: {
                                            active: { type: "boolean" },
                                            shift: { type: "object" }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            },
            "/shifts/start": {
                post: {
                    summary: "Start a Shift",
                    tags: ["Shifts"],
                    requestBody: {
                        required: true,
                        content: {
                            "application/json": {
                                schema: {
                                    type: "object",
                                    required: ["userId"],
                                    properties: {
                                        userId: { type: "string", description: "The Clerk user ID of the staff member starting their shift (e.g. 'user_2x...'). This is the POW account ID, not a Roblox ID." }
                                    }
                                }
                            }
                        }
                    },
                    responses: { 200: { description: "Shift started successfully" } }
                }
            },
            "/shifts/end": {
                post: {
                    summary: "End an active Shift",
                    tags: ["Shifts"],
                    requestBody: {
                        required: true,
                        content: {
                            "application/json": {
                                schema: {
                                    type: "object",
                                    required: ["userId"],
                                    properties: {
                                        userId: { type: "string", description: "The Clerk user ID of the staff member ending their shift (e.g. 'user_2x...'). This is the POW account ID, not a Roblox ID." }
                                    }
                                }
                            }
                        }
                    },
                    responses: { 200: { description: "Shift ended successfully" } }
                }
            },
            "/commands": {
                post: {
                    summary: "Execute Server Command",
                    description: "Injects an administrative command directly into the live PRC server.",
                    tags: ["Live Data"],
                    requestBody: {
                        required: true,
                        content: {
                            "application/json": {
                                schema: {
                                    type: "object",
                                    required: ["command"],
                                    properties: {
                                        command: { type: "string", description: "e.g. m Hello Server!" }
                                    }
                                }
                            }
                        }
                    },
                    responses: { 200: { description: "Command queued securely" } }
                }
            },
            "/members/lookup": {
                get: {
                    summary: "Lookup Staff by Roblox ID",
                    description: "Resolves a staff member's Clerk (POW) user ID from their Roblox user ID. Useful for mapping Roblox players to POW shift/account operations.",
                    tags: ["Members"],
                    parameters: [
                        { name: "robloxId", in: "query", required: true, schema: { type: "string" }, description: "The Roblox User ID of the staff member to look up (numeric string, e.g. '123456789')." }
                    ],
                    responses: {
                        200: {
                            description: "Staff member found",
                            content: {
                                "application/json": {
                                    schema: {
                                        type: "object",
                                        properties: {
                                            clerkUserId: { type: "string", description: "The Clerk (POW) user ID for this staff member (e.g. 'user_2x...'). Use this for Shift endpoints." },
                                            robloxId: { type: "string", description: "The Roblox User ID (echoed back)." },
                                            robloxUsername: { type: "string", description: "The cached Roblox username." },
                                            discordId: { type: "string", description: "The linked Discord user ID, if available." },
                                            isAdmin: { type: "boolean", description: "Whether this member has admin access to the server." },
                                            role: {
                                                type: "object",
                                                properties: {
                                                    name: { type: "string" },
                                                    color: { type: "string" }
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        },
                        404: { description: "No staff member found with that Roblox ID in this server" }
                    }
                }
            },
            "/shifts/history": {
                get: {
                    summary: "Shift History",
                    description: "Retrieves completed shift records for a staff member or all staff over a configurable time period. Returns individual shift entries with durations and a total minutes summary.",
                    tags: ["Shifts"],
                    parameters: [
                        { name: "userId", in: "query", required: false, schema: { type: "string" }, description: "Clerk user ID to filter by (e.g. 'user_2x...'). Omit to get all staff." },
                        { name: "days", in: "query", required: false, schema: { type: "integer", default: 7, maximum: 90 }, description: "Number of days to look back (max 90)." },
                        { name: "limit", in: "query", required: false, schema: { type: "integer", default: 50, maximum: 100 } },
                        { name: "page", in: "query", required: false, schema: { type: "integer", default: 1 } }
                    ],
                    responses: {
                        200: {
                            description: "Paginated shift history",
                            content: {
                                "application/json": {
                                    schema: {
                                        type: "object",
                                        properties: {
                                            shifts: {
                                                type: "array",
                                                items: {
                                                    type: "object",
                                                    properties: {
                                                        id: { type: "string" },
                                                        userId: { type: "string", description: "Clerk user ID of the staff member." },
                                                        startTime: { type: "string", format: "date-time" },
                                                        endTime: { type: "string", format: "date-time" },
                                                        duration: { type: "integer", description: "Shift duration in seconds." }
                                                    }
                                                }
                                            },
                                            totalShifts: { type: "integer" },
                                            totalMinutes: { type: "integer", description: "Sum of all matched shift durations in minutes." },
                                            period: { type: "object", properties: { days: { type: "integer" }, since: { type: "string", format: "date-time" } } },
                                            pagination: { type: "object", properties: { page: { type: "integer" }, limit: { type: "integer" }, totalPages: { type: "integer" } } }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            },
            "/shifts/leaderboard": {
                get: {
                    summary: "Shift Leaderboard",
                    description: "Returns a ranked leaderboard of staff members sorted by total shift hours worked over a configurable period. Includes Roblox usernames where available.",
                    tags: ["Shifts"],
                    parameters: [
                        { name: "days", in: "query", required: false, schema: { type: "integer", default: 7, maximum: 90 }, description: "Number of days to look back (max 90)." },
                        { name: "limit", in: "query", required: false, schema: { type: "integer", default: 10, maximum: 50 }, description: "Number of top staff to return." }
                    ],
                    responses: {
                        200: {
                            description: "Ranked leaderboard",
                            content: {
                                "application/json": {
                                    schema: {
                                        type: "object",
                                        properties: {
                                            leaderboard: {
                                                type: "array",
                                                items: {
                                                    type: "object",
                                                    properties: {
                                                        rank: { type: "integer" },
                                                        userId: { type: "string", description: "Clerk user ID." },
                                                        robloxUsername: { type: "string", description: "Roblox username if linked." },
                                                        robloxId: { type: "string", description: "Roblox User ID if linked." },
                                                        totalMinutes: { type: "integer", description: "Total shift time in minutes." },
                                                        totalShifts: { type: "integer", description: "Number of completed shifts." }
                                                    }
                                                }
                                            },
                                            period: { type: "object", properties: { days: { type: "integer" }, since: { type: "string", format: "date-time" } } }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            },
            "/punishments/active": {
                get: {
                    summary: "Active BOLOs",
                    description: "Returns all currently active (unresolved) Ban BOLOs for your server. Use this to check if joining players have outstanding BOLOs.",
                    tags: ["Moderation"],
                    parameters: [
                        { name: "limit", in: "query", required: false, schema: { type: "integer", default: 50, maximum: 100 } },
                        { name: "page", in: "query", required: false, schema: { type: "integer", default: 1 } }
                    ],
                    responses: {
                        200: {
                            description: "Active BOLO list",
                            content: {
                                "application/json": {
                                    schema: {
                                        type: "object",
                                        properties: {
                                            bolos: {
                                                type: "array",
                                                items: {
                                                    type: "object",
                                                    properties: {
                                                        id: { type: "string", description: "Punishment record ID." },
                                                        userId: { type: "string", description: "Roblox User ID of the BOLO'd player." },
                                                        moderatorId: { type: "string", description: "Roblox User ID of the issuing moderator." },
                                                        reason: { type: "string" },
                                                        createdAt: { type: "string", format: "date-time" }
                                                    }
                                                }
                                            },
                                            total: { type: "integer" },
                                            pagination: { type: "object", properties: { page: { type: "integer" }, limit: { type: "integer" }, totalPages: { type: "integer" } } }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    return NextResponse.json(spec)
}
