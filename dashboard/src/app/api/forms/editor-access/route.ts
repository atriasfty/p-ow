import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/auth-clerk"
import { prisma } from "@/lib/db"
import { isServerAdmin } from "@/lib/admin"
import { clerkClient } from "@clerk/nextjs/server"

// POST /api/forms/editor-access - Claim editor access via share link
export async function POST(request: NextRequest) {
    try {
        const session = await getSession()
        if (!session) {
            return NextResponse.json({ error: "Login required to claim editor access" }, { status: 401 })
        }

        const body = await request.json()
        const { editorShareId } = body

        if (!editorShareId) {
            return NextResponse.json({ error: "editorShareId is required" }, { status: 400 })
        }

        // Find form by editor share ID
        const form = await prisma.form.findUnique({
            where: { editorShareId },
            select: { id: true, title: true, serverId: true }
        })

        if (!form) {
            return NextResponse.json({ error: "Invalid share link" }, { status: 404 })
        }

        // Check if already has access
        const existing = await prisma.formEditorAccess.findUnique({
            where: { formId_userId: { formId: form.id, userId: session.user.id } }
        })

        if (existing) {
            return NextResponse.json({
                message: "You already have editor access",
                formId: form.id,
                formTitle: form.title,
                serverId: form.serverId
            })
        }

        // Grant editor access
        await prisma.formEditorAccess.create({
            data: {
                formId: form.id,
                userId: session.user.id
            }
        })

        return NextResponse.json({
            message: "Editor access granted",
            formId: form.id,
            formTitle: form.title,
            serverId: form.serverId
        })
    } catch (error) {
        console.error("[EDITOR-ACCESS]", error)
        return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
}

// GET /api/forms/editor-access - List or check editor access
export async function GET(request: NextRequest) {
    try {
        const session = await getSession()
        if (!session) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        const { searchParams } = new URL(request.url)
        const formId = searchParams.get("formId")
        const listAll = searchParams.get("listAll") === "true"

        if (!formId) {
            return NextResponse.json({ error: "formId is required" }, { status: 400 })
        }

        // If listing all editors, verify owner/admin access
        if (listAll) {
            const form = await prisma.form.findUnique({
                where: { id: formId },
                select: { serverId: true, createdBy: true }
            })

            if (!form) return NextResponse.json({ error: "Form not found" }, { status: 404 })

            const isAdmin = await isServerAdmin({ id: session.user.id } as any, form.serverId)
            const isOwner = form.createdBy === session.user.id

            if (!isOwner && !isAdmin) {
                return NextResponse.json({ error: "Access denied" }, { status: 403 })
            }

            const editors = await prisma.formEditorAccess.findMany({
                where: { formId },
                orderBy: { grantedAt: "desc" }
            })

            const userIds = editors.map((e: any) => e.userId)


            // Batch fetch Clerk users for profile pictures
            const client = await clerkClient()
            const userPromises = []

            for (let i = 0; i < userIds.length; i += 100) {
                const chunk = userIds.slice(i, i + 100) as string[]
                userPromises.push(client.users.getUserList({ userId: chunk, limit: 100 }))
            }

            const userResponses = await Promise.all(userPromises)
            const clerkUsers = userResponses.flatMap(res => res.data)


            // Batch fetch Member records for Roblox usernames
            const members = await prisma.member.findMany({
                where: {
                    serverId: form.serverId,
                    userId: { in: userIds }
                },
                select: { userId: true, robloxUsername: true }
            })

            const enrichedEditors = editors.map((editor: any) => {
                const clerkUser = clerkUsers.find(u => u.id === editor.userId)
                const member = members.find((m: any) => m.userId === editor.userId)

                return {
                    ...editor,
                    robloxUsername: member?.robloxUsername || clerkUser?.username || "Unknown",
                    imageUrl: clerkUser?.imageUrl || null
                }
            })

            return NextResponse.json(enrichedEditors)
        }

        // Just checking single user access
        const access = await prisma.formEditorAccess.findUnique({
            where: { formId_userId: { formId, userId: session.user.id } }
        })

        return NextResponse.json({ hasAccess: !!access })
    } catch (error) {
        console.error("[EDITOR-ACCESS GET]", error)
        return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
}

// DELETE /api/forms/editor-access - Remove editor access
export async function DELETE(request: NextRequest) {
    try {
        const session = await getSession()
        if (!session) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        const { searchParams } = new URL(request.url)
        const formId = searchParams.get("formId")
        const userIdToRemove = searchParams.get("userId")

        if (!formId || !userIdToRemove) {
            return NextResponse.json({ error: "formId and userId are required" }, { status: 400 })
        }

        // Verify requester is owner or admin
        const form = await prisma.form.findUnique({
            where: { id: formId },
            select: { serverId: true, createdBy: true }
        })

        if (!form) return NextResponse.json({ error: "Form not found" }, { status: 404 })

        const isAdmin = await isServerAdmin({ id: session.user.id } as any, form.serverId)
        const isOwner = form.createdBy === session.user.id

        if (!isOwner && !isAdmin) {
            return NextResponse.json({ error: "Access denied" }, { status: 403 })
        }

        await prisma.formEditorAccess.delete({
            where: { formId_userId: { formId, userId: userIdToRemove } }
        })

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error("[EDITOR-ACCESS DELETE]", error)
        return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
}
