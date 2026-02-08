import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const topic = searchParams.get('topic')
    const difficulty = searchParams.get('difficulty')

    const where: any = {}
    if (topic && topic !== 'all') where.topic = topic
    if (difficulty && difficulty !== 'all') where.difficulty = difficulty

    const questions = await prisma.question.findMany({
      where,
      select: {
        id: true,
        year: true,
        paper: true,
        questionNumber: true,
        topic: true,
        text: true,
        markScheme: true,
        examinerRemarks: true,
        marks: true,
        difficulty: true,
      },
      orderBy: [{ year: 'desc' }, { paper: 'asc' }, { questionNumber: 'asc' }],
    })

    // Also get available topics with counts
    const topicCounts = await prisma.question.groupBy({
      by: ['topic'],
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
    })

    return NextResponse.json({
      questions,
      topics: topicCounts.map((t) => ({
        name: t.topic,
        count: t._count.id,
      })),
      total: questions.length,
    })
  } catch (error) {
    console.error('Error fetching questions:', error)
    return NextResponse.json(
      { error: 'Failed to fetch questions' },
      { status: 500 }
    )
  }
}
