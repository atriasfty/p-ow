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
                    properties: {
                        id: { type: "string" },
                        name: { type: "string" },
                        customName: { type: "string" },
                        createdAt: { type: "string", format: "date-time" }
                    }
                },
                Player: {
                    type: "object",
                    properties: {
                        id: { type: "string" },
                        name: { type: "string" },
                        team: { type: "string" },
                        callsign: { type: "string" }
                    }
                },
                Punishment: {
                    type: "object",
                    properties: {
                        id: { type: "string" },
                        userId: { type: "string" },
                        moderatorId: { type: "string" },
                        type: { type: "string", enum: ["Warn", "Kick", "Ban", "Ban Bolo"] },
                        reason: { type: "string" },
                        resolved: { type: "boolean" },
                        createdAt: { type: "string", format: "date-time" }
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
                    parameters: [
                        { name: "server", in: "query", required: true, schema: { type: "string" }, description: "Server custom name or ID" }
                    ],
                    responses: {
                        200: {
                            description: "List of online players",
                            content: {
                                "application/json": {
                                    schema: {
                                        type: "object",
                                        properties: {
                                            serverId: { type: "string" },
                                            playerCount: { type: "integer" },
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
                        { name: "server", in: "query", required: true, schema: { type: "string" } },
                        { name: "userId", in: "query", required: false, schema: { type: "string" } },
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
                                    required: ["server", "userId", "moderatorId", "type"],
                                    properties: {
                                        server: { type: "string" },
                                        userId: { type: "string" },
                                        moderatorId: { type: "string" },
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
                        { name: "server", in: "query", required: true, schema: { type: "string" } },
                        { name: "userId", in: "query", required: true, schema: { type: "string" } }
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
                                    required: ["server", "userId"],
                                    properties: {
                                        server: { type: "string" },
                                        userId: { type: "string" }
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
                                    required: ["server", "userId"],
                                    properties: {
                                        server: { type: "string" },
                                        userId: { type: "string" }
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
                                    required: ["server", "command"],
                                    properties: {
                                        server: { type: "string" },
                                        command: { type: "string", description: "e.g. m Hello Server!" }
                                    }
                                }
                            }
                        }
                    },
                    responses: { 200: { description: "Command queued securely" } }
                }
            }
        }
    }

    return NextResponse.json(spec)
}
