import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { rateLimit, RATE_LIMITS } from '@/lib/rate-limit'
import { sanitizeError } from '@/lib/error-handling'

export async function POST(req: NextRequest) {
  try {
    const { userId: clerkId } = await auth()

    if (!clerkId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Rate limiting
    try {
      rateLimit(clerkId, RATE_LIMITS.PRACTICE)
    } catch (error) {
      const sanitized = sanitizeError(error)
      return NextResponse.json({ error: sanitized.message }, { status: 429 })
    }

    const { questionId, selectedOption } = await req.json()

    if (!questionId || !selectedOption) {
      return NextResponse.json(
        { error: 'Question ID and selected option required' },
        { status: 400 })
    }

    // Get question
    const question = await prisma.question.findUnique({
      where: { id: questionId },
    })

    if (!question) {
      return NextResponse.json({ error: 'Question not found' }, { status: 404 })
    }

    if (question.type !== 'MCQ') {
      return NextResponse.json(
        { error: 'Not an MCQ question' },
        { status: 400 }
      )
    }

    const isCorrect = selectedOption === question.correctOption
    const score = isCorrect ? 1 : 0

    // Get or create user
    let user = await prisma.user.findUnique({
      where: { clerkId },
    })

    if (!user) {
      user = await prisma.user.create({
        data: {
          clerkId,
          email: `${clerkId}@placeholder.com`,
        },
      })
    }

    // Save attempt
    await prisma.attempt.create({
      data: {
        userId: user.id,
        questionId,
        selectedOption,
        answers: { selected: selectedOption },
        score,
        maxScore: 1,
        feedback: {
          correct: isCorrect,
          correctOption: question.correctOption,
          explanation: question.explanation,
        },
        isCorrect,
        mistakeTags: isCorrect ? [] : ['wrong_option'],
      },
    })

    return NextResponse.json({
      success: true,
      isCorrect,
      correctOption: question.correctOption,
      explanation: question.explanation,
      selectedOption,
    })
  } catch (error) {
    console.error('MCQ marking error:', error)
    const sanitized = sanitizeError(error)
    return NextResponse.json({ error: sanitized.message }, { status: 500 })
  }
}
