import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { markAnswer } from '@/lib/gemini-marking'

export async function POST(req: NextRequest) {
  try {
    const { userId: clerkId } = await auth()

    if (!clerkId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { questionId, studentAnswer, question } = await req.json()

    if (!studentAnswer || typeof studentAnswer !== 'string') {
      return NextResponse.json({ error: 'Answer is required' }, { status: 400 })
    }

    // Get user from database
    let user = await prisma.user.findUnique({
      where: { clerkId },
    })

    // Create user if doesn't exist
    if (!user) {
      user = await prisma.user.create({
        data: {
          clerkId,
          email: `${clerkId}@placeholder.com`, // Will be updated on first sign-in
        },
      })
    }

    // If questionId provided, get question from database
    let questionData = question
    if (questionId && !question) {
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
    }

    if (!questionData) {
      return NextResponse.json({ error: 'Question not found' }, { status: 404 })
    }

    // Mark the answer using Gemini
    const result = await markAnswer(
      questionData.text,
      questionData.markScheme,
      studentAnswer,
      questionData.marks,
      questionData.examinerRemarks
    )

    // Save attempt to database if we have a valid questionId
    if (questionId) {
      try {
        await prisma.attempt.create({
          data: {
            userId: user.id,
            questionId,
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
    return NextResponse.json(
      { error: 'Failed to mark answer' },
      { status: 500 }
    )
  }
}
