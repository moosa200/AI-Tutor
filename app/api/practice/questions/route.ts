import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { sanitizeError } from '@/lib/error-handling'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const { userId: clerkId } = await auth()

    if (!clerkId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const topic = searchParams.get('topic')
    const difficulty = searchParams.get('difficulty')
    const paperType = searchParams.get('paperType')
    const type = searchParams.get('type') // 'MCQ' or 'STRUCTURED'

    // Build filter object
    const where: any = {}

    if (topic && topic !== 'all') {
      where.topic = topic
    }

    if (difficulty && difficulty !== 'all') {
      where.difficulty = difficulty
    }

    if (type && type !== 'all') {
      where.type = type.toUpperCase()
    } else if (paperType && paperType !== 'all') {
      // Map paperType to type for backwards compatibility
      where.type = paperType === 'mcq' ? 'MCQ' : 'STRUCTURED'
    }

    // Fetch questions
    const questions = await prisma.question.findMany({
      where,
      include: {
        parts: {
          include: {
            subParts: true,
          },
          orderBy: { partLabel: 'asc' },
        },
      },
      orderBy: [{ year: 'desc' }, { paper: 'desc' }, { questionNumber: 'asc' }],
      take: 50, // Limit to 50 questions
    })

    // Get topics with counts
    const topicCounts = await prisma.question.groupBy({
      by: ['topic'],
      _count: true,
      orderBy: {
        _count: {
          topic: 'desc',
        },
      },
    })

    const topics = topicCounts.map((t) => ({
      name: t.topic,
      count: t._count,
    }))

    return NextResponse.json({
      success: true,
      questions,
      topics,
      total: questions.length,
    })
  } catch (error) {
    console.error('Question fetch error:', error)
    const sanitized = sanitizeError(error)
    return NextResponse.json({ error: sanitized.message }, { status: 500 })
  }
}
