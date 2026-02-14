import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { markAnswer } from '@/lib/gemini-marking'
import { rateLimit, RATE_LIMITS } from '@/lib/rate-limit'
import { validateStudentAnswer, validateQuestionId } from '@/lib/validation'
import { sanitizeError, withRetry, withTimeout } from '@/lib/error-handling'

export async function POST(req: NextRequest) {
  try {
    const { userId: clerkId } = await auth()

    if (!clerkId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Rate limiting: 60 submissions per hour per user
    try {
      rateLimit(clerkId, RATE_LIMITS.PRACTICE)
    } catch (error) {
      const sanitized = sanitizeError(error)
      return NextResponse.json(
        { error: sanitized.message },
        { status: 429 }
      )
    }

    const body = await req.json()
    const { questionId: rawQuestionId, studentAnswer: rawAnswer, question } = body

    // Validate student answer
    let studentAnswer: string
    try {
      studentAnswer = validateStudentAnswer(rawAnswer)
    } catch (error) {
      const sanitized = sanitizeError(error)
      return NextResponse.json(
        { error: sanitized.message },
        { status: 400 }
      )
    }

    // Get or create user
    const user = await withRetry(async () => {
      let dbUser = await prisma.user.findUnique({
        where: { clerkId },
      })

      if (!dbUser) {
        dbUser = await prisma.user.create({
          data: {
            clerkId,
            email: `${clerkId}@placeholder.com`,
          },
        })
      }

      return dbUser
    })

    // Get question data
    let questionData = question
    if (rawQuestionId && !question) {
      try {
        const questionId = validateQuestionId(rawQuestionId)
        const dbQuestion = await prisma.question.findUnique({
          where: { id: questionId },
        })
        if (dbQuestion) {
          questionData = {
            text: dbQuestion.text,
            markScheme: dbQuestion.markScheme,
            marks: dbQuestion.marks,
            examinerRemarks: dbQuestion.examinerRemarks,
          }
        }
      } catch (error) {
        const sanitized = sanitizeError(error)
        return NextResponse.json(
          { error: sanitized.message },
          { status: 400 }
        )
      }
    }

    if (!questionData) {
      return NextResponse.json({ error: 'Question not found' }, { status: 404 })
    }

    // Mark the answer with retry and timeout
    const result = await withRetry(async () => {
      return withTimeout(
        markAnswer(
          questionData.text,
          questionData.markScheme,
          studentAnswer,
          questionData.marks,
          questionData.examinerRemarks
        ),
        30000, // 30 second timeout for marking
        'Marking timed out'
      )
    })

    // Save attempt to database
    if (rawQuestionId) {
      try {
        await prisma.attempt.create({
          data: {
            userId: user.id,
            questionId: rawQuestionId,
            studentAnswer,
            score: result.score,
            maxScore: result.maxScore,
            feedback: result.feedback,
            mistakeTags: result.mistakeTags,
          },
        })
      } catch (dbError) {
        // Log but don't fail - marking result is more important
        console.error('Failed to save attempt:', dbError)
      }
    }

    return NextResponse.json({
      success: true,
      result,
    })
  } catch (error) {
    console.error('Practice submit error:', error)
    const sanitized = sanitizeError(error)
    return NextResponse.json(
      { error: sanitized.message },
      { status: 500 }
    )
  }
}
