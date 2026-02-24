import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getOrCreateUser } from '@/lib/events'

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { userId: clerkId } = await auth()
    if (!clerkId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const user = await getOrCreateUser(clerkId)

    // Verify session belongs to user
    const session = await prisma.chatSession.findFirst({
      where: { id: params.id, userId: user.id },
    })
    if (!session) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const messages = await prisma.chatMessage.findMany({
      where: { sessionId: params.id },
      orderBy: { createdAt: 'asc' },
    })

    return NextResponse.json({ messages })
  } catch (error) {
    console.error('GET /api/chat/sessions/[id]/messages error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
