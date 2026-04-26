import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/auth-clerk"
import { prisma } from "@/lib/db"
import { getServerOverride } from "@/lib/config"
import { writeFile, mkdir } from "fs/promises"
import path from "path"
import { randomBytes } from "crypto"

// POST /api/forms/upload - Handle file uploads
export async function POST(request: NextRequest) {
    try {
        const session = await getSession()
        
        const formData = await request.formData()
        const file = formData.get("file") as File | null
        const formId = formData.get("formId") as string | null

        if (!file || !formId) {
            return NextResponse.json({ error: "Missing file or formId" }, { status: 400 })
        }

        // Verify form exists and is accepting uploads
        const form = await prisma.form.findUnique({
            where: { id: formId },
            select: { status: true, requiresAuth: true, serverId: true }
        })

        if (!form || form.status !== "published") {
            return NextResponse.json({ error: "Invalid form or form is not accepting uploads" }, { status: 403 })
        }

        if (!session) {
            return NextResponse.json({ error: "Authentication required to upload files" }, { status: 401 })
        }

        // Validate file size using server override
        const maxSize = await getServerOverride(form.serverId, "maxUploadSize")
        if (file.size > maxSize) {
            return NextResponse.json({ error: `File too large (max ${Math.floor(maxSize / 1024 / 1024)}MB)` }, { status: 400 })
        }

        // Strict extension → MIME allowlist; reject anything not on the list
        const ALLOWED: Record<string, string[]> = {
            ".jpg":  ["image/jpeg"],
            ".jpeg": ["image/jpeg"],
            ".png":  ["image/png"],
            ".gif":  ["image/gif"],
            ".webp": ["image/webp"],
            ".pdf":  ["application/pdf"],
            ".txt":  ["text/plain"],
            ".mp4":  ["video/mp4"],
            ".mov":  ["video/quicktime"],
            ".mp3":  ["audio/mpeg"],
            ".wav":  ["audio/wav"],
        }
        const ext = path.extname(file.name).toLowerCase()
        const allowedMimes = ALLOWED[ext]
        if (!allowedMimes || !allowedMimes.includes(file.type)) {
            return NextResponse.json({ error: "File type not allowed" }, { status: 400 })
        }
        const uniqueId = randomBytes(16).toString("hex")
        const filename = `${uniqueId}${ext}`

        // Create uploads directory in data folder (persists across deploys)
        // Use DATA_DIR env var on VPS, or fallback to local data folder for dev
        const dataDir = process.env.DATA_DIR || path.join(process.cwd(), "data")
        const uploadsDir = path.join(dataDir, "uploads", "forms", formId)
        await mkdir(uploadsDir, { recursive: true })

        // Save file
        const buffer = Buffer.from(await file.arrayBuffer())
        const filePath = path.join(uploadsDir, filename)
        await writeFile(filePath, buffer)

        // Return API URL for download (not public folder)
        const fileUrl = `/api/forms/download?formId=${formId}&file=${filename}`

        return NextResponse.json({
            url: fileUrl,
            filename: file.name,
            size: file.size,
            type: file.type
        })
    } catch (error) {
        console.error("[UPLOAD]", error)
        return NextResponse.json({ error: "Upload failed" }, { status: 500 })
    }
}
