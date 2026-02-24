import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getOrCreateUser } from '@/lib/events'

async function getSessionForUser(sessionId: string, userId: string) {
  return prisma.chatSession.findFirst({
    where: { id: sessionId, userId },
  })
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { userId: clerkId } = await auth()
    if (!clerkId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const user = await getOrCreateUser(clerkId)
    const session = await getSessionForUser(params.id, user.id)
    if (!session) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    await prisma.chatSession.delete({ where: { id: params.id } })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('DELETE /api/chat/sessions/[id] error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { userId: clerkId } = await auth()
    if (!clerkId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const user = await getOrCreateUser(clerkId)
    const session = await getSessionForUser(params.id, user.id)
    if (!session) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const { title } = await req.json()
    if (!title || typeof title !== 'string') {
      return NextResponse.json({ error: 'title required' }, { status: 400 })
    }

    const updated = await prisma.chatSession.update({
      where: { id: params.id },
      data: { title: title.slice(0, 100) },
    })

    return NextResponse.json({ session: updated })
  } catch (error) {
    console.error('PATCH /api/chat/sessions/[id] error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
