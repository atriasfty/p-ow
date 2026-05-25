// @ts-ignore
import { NextResponse } from "next/server"
import { getFromCache, setToCache } from "@/lib/roblox-cache"
import { checkSecurity } from "@/lib/security"
import { getSession } from "@/lib/auth-clerk"
import { verifyCsrf } from "@/lib/auth-permissions"

// Batch fetch user data from Roblox
export async function POST(req: Request) {
    if (!verifyCsrf(req)) return new NextResponse("Forbidden", { status: 403 })

    const session = await getSession()
    if (!session) return new NextResponse("Unauthorized", { status: 401 })

    const body = await req.json()
    const userIds: string[] = body.userIds || []

    const securityBlock = await checkSecurity(req)
    if (securityBlock) return securityBlock

    if (userIds.length === 0) {
        return NextResponse.json({})
    }

    const result: Record<string, { name: string, displayName: string, avatar: string | null }> = {}
    const uncachedIds: string[] = []

    // 1. Check Cache first
    for (const id of userIds) {
        const cached = getFromCache<any>(`roblox:user:id:${id}`)
        if (cached) {
            result[id] = cached
        } else {
            uncachedIds.push(id)
        }
    }

    if (uncachedIds.length === 0) return NextResponse.json(result)

    // 2. Batch users request for uncached
    try {
        const usersRes = await fetch("https://users.roblox.com/v1/users", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ userIds: uncachedIds.map(id => parseInt(id)).filter(id => !isNaN(id)) })
        })

        if (usersRes.ok) {
            const usersData = await usersRes.json()
            for (const user of usersData.data || []) {
                const userData = {
                    name: user.name,
                    displayName: user.displayName,
                    avatar: null as string | null
                }
                result[String(user.id)] = userData
            }
        }
    } catch (e) {
        console.warn("Batch users fetch failed:", e)
    }

    // 3. Batch avatars request for uncached
    try {
        const avatarRes = await fetch(
            `https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${uncachedIds.join(",")}&size=48x48&format=Png&isCircular=true`
        )
        if (avatarRes.ok) {
            const avatarData = await avatarRes.json()
            for (const item of avatarData.data || []) {
                const id = String(item.targetId)
                if (result[id]) {
                    result[id].avatar = item.imageUrl || null
                }
            }
        }
    } catch (e) {
        console.warn("Avatar fetch failed:", e)
    }

    // 4. Update Cache for new data
    for (const id of uncachedIds) {
        if (result[id]) {
            setToCache(`roblox:user:id:${id}`, result[id])
        }
    }

    return NextResponse.json(result)
}
