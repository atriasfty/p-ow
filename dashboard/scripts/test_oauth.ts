import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

async function run() {
    const member = await prisma.member.findFirst({
        where: { discordId: { not: null } }
    })
    console.log("Member:", member?.userId)
}
run()
