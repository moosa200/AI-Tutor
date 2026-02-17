import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { rateLimit, RATE_LIMITS } from '@/lib/rate-limit'
import { sanitizeError, withRetry, withTimeout } from '@/lib/error-handling'
import { getOrCreateUser, logEvent } from '@/lib/events'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)

function extractFeedbackExtras(result: Record<string, unknown>) {
  return {
    pointsAwarded: Array.isArray(result.pointsAwarded) ? result.pointsAwarded as string[] : [],
    pointsMissed: Array.isArray(result.pointsMissed) ? result.pointsMissed as string[] : [],
    suggestions: typeof result.suggestions === 'string' ? result.suggestions : '',
  }
}

interface MarkScheme {
  type: 'numerical' | 'keywords' | 'rubric'

  // For numerical
  correctValue?: number
  tolerance?: number | string
  unit?: string
  alternativeUnits?: string[]

  // For text
  keywords?: string[]
  requiredPoints?: Array<{
    point: string
    marks: number
    alternatives?: string[]
  }>

  maxMarks: number
}

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

    const { questionId, answers } = await req.json()

    if (!questionId || !answers) {
      return NextResponse.json(
        { error: 'Question ID and answers required' },
        { status: 400 }
      )
    }

    // Get question with all parts and subparts
    const question = await prisma.question.findUnique({
      where: { id: questionId },
      include: {
        parts: {
          include: {
            subParts: true,
          },
          orderBy: { order: 'asc' },
        },
      },
    })

    if (!question) {
      return NextResponse.json({ error: 'Question not found' }, { status: 404 })
    }

    // Mark each part/subpart
    const results: any[] = []
    let totalScore = 0
    let totalMaxScore = 0

    for (const part of question.parts) {
      // Mark the part itself if it has no subparts
      if (!part.subParts || part.subParts.length === 0) {
        const answer = answers[part.id]
        const markScheme = part.markScheme as any

        const result = await markAnswer(
          answer,
          markScheme,
          part.partText,
          part.inputType
        )

        results.push({
          partId: part.id,
          partLabel: part.partLabel,
          score: result.marks,
          maxScore: part.marks,
          feedback: result.feedback,
          mistakeTags: result.mistakeTags,
          ...extractFeedbackExtras(result),
        })

        totalScore += result.marks
        totalMaxScore += part.marks
      } else {
        // Mark each subpart
        for (const subPart of part.subParts) {
          const answer = answers[subPart.id]
          const markScheme = subPart.markScheme as any

          const result = await markAnswer(
            answer,
            markScheme,
            subPart.subPartText,
            subPart.inputType
          )

          results.push({
            subPartId: subPart.id,
            partLabel: `${part.partLabel}(${subPart.subPartLabel})`,
            score: result.marks,
            maxScore: subPart.marks,
            feedback: result.feedback,
            mistakeTags: result.mistakeTags,
            ...extractFeedbackExtras(result),
          })

          totalScore += result.marks
          totalMaxScore += subPart.marks
        }
      }
    }

    // Get or create user
    const user = await getOrCreateUser(clerkId)

    // Save attempt
    await prisma.attempt.create({
      data: {
        userId: user.id,
        questionId,
        answers,
        score: totalScore,
        maxScore: totalMaxScore,
        feedback: results,
        isCorrect: totalScore === totalMaxScore,
        mistakeTags: results.flatMap((r) => r.mistakeTags || []),
      },
    })

    // Log practice event
    await logEvent(user.id, 'practice_submit', {
      questionId,
      type: 'STRUCTURED',
      score: totalScore,
      maxScore: totalMaxScore,
    })

    return NextResponse.json({
      success: true,
      totalScore,
      totalMarks: totalMaxScore, // Frontend expects totalMarks
      percentage: Math.round((totalScore / totalMaxScore) * 100),
      partResults: results, // Frontend expects partResults
    })
  } catch (error) {
    console.error('Marking error:', error)
    const sanitized = sanitizeError(error)
    return NextResponse.json({ error: sanitized.message }, { status: 500 })
  }
}

async function markAnswer(
  answer: any,
  scheme: MarkScheme,
  questionText: string,
  inputType: string
) {
  // Handle diagram/drawing parts that were skipped
  if (answer === '__DIAGRAM_SKIPPED__' || (!answer && /(draw|sketch|label|shade|plot|graph|annotat|on\s+fig|on\s+diagram|in\s+fig)/i.test(questionText))) {
    return {
      marks: 0,
      maxMarks: scheme.maxMarks,
      feedback: 'Drawing/diagram required; not supported in online practice.',
      mistakeTags: [],
      pointsAwarded: [],
      pointsMissed: [],
      suggestions: '',
    }
  }

  if (inputType === 'NUMERICAL') {
    return markNumericalAnswer(answer, scheme)
  } else {
    return await markTextAnswer(answer, scheme, questionText)
  }
}

function markNumericalAnswer(
  answer: { number: string; unit: string },
  scheme: MarkScheme
) {
  if (!answer || !answer.number) {
    return {
      marks: 0,
      maxMarks: scheme.maxMarks,
      feedback: 'No answer provided',
      mistakeTags: ['incomplete'],
      pointsAwarded: [],
      pointsMissed: [],
      suggestions: '',
    }
  }

  const studentValue = parseFloat(answer.number)
  const correctValue = scheme.correctValue!

  if (isNaN(studentValue)) {
    return {
      marks: 0,
      maxMarks: scheme.maxMarks,
      feedback: 'Invalid number format',
      mistakeTags: ['format_error'],
      pointsAwarded: [],
      pointsMissed: [],
      suggestions: '',
    }
  }

  // Calculate tolerance
  let tolerance = 0
  if (typeof scheme.tolerance === 'string' && scheme.tolerance.includes('%')) {
    const pct = parseFloat(scheme.tolerance)
    tolerance = (Math.abs(correctValue) * pct) / 100
  } else {
    tolerance = Number(scheme.tolerance || 0)
  }

  const isValueCorrect = Math.abs(studentValue - correctValue) <= tolerance

  // Check unit
  const unitCorrect = scheme.unit
    ? answer.unit === scheme.unit ||
      scheme.alternativeUnits?.includes(answer.unit)
    : true

  let marks = 0
  const feedback: string[] = []
  const mistakeTags: string[] = []

  if (isValueCorrect) {
    // Award all marks except 1 for unit (if unit is required)
    marks += scheme.unit ? scheme.maxMarks - 1 : scheme.maxMarks
    feedback.push(`✓ Correct value: ${studentValue}`)
  } else {
    feedback.push(
      `✗ Incorrect value. Expected ${correctValue} ± ${tolerance}, got ${studentValue}`
    )
    mistakeTags.push('calculation_error')
  }

  if (scheme.unit) {
    if (unitCorrect) {
      marks += 1
      feedback.push(`✓ Correct unit: ${answer.unit}`)
    } else {
      feedback.push(
        `✗ Incorrect unit. Expected ${scheme.unit}${
          scheme.alternativeUnits
            ? ' or ' + scheme.alternativeUnits.join(', ')
            : ''
        }, got ${answer.unit || 'no unit'}`
      )
      mistakeTags.push('unit_error')
    }
  }

  return {
    marks,
    maxMarks: scheme.maxMarks,
    feedback: feedback.join('\n'),
    isCorrect: marks === scheme.maxMarks,
    mistakeTags,
    pointsAwarded: isValueCorrect ? [`Correct value: ${studentValue}`] : [],
    pointsMissed: !isValueCorrect ? [`Expected value: ${correctValue}`] : [],
    suggestions: !isValueCorrect ? `Check your working: the expected answer is ${correctValue} ${scheme.unit || ''}`.trim() : '',
  }
}

async function markTextAnswer(
  answer: string,
  scheme: MarkScheme,
  questionText: string
) {
  if (!answer || answer.trim() === '') {
    return {
      marks: 0,
      maxMarks: scheme.maxMarks,
      feedback: 'No answer provided',
      mistakeTags: ['incomplete'],
      pointsAwarded: [],
      pointsMissed: [],
      suggestions: '',
    }
  }

  // Use Gemini for intelligent marking
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.0-flash',
    generationConfig: {
      responseMimeType: 'application/json',
    },
  })

  // Detect if this is a drawing question
  const isDrawingQuestion = /\b(draw|sketch|plot)\b/i.test(questionText)
  const drawingNote = isDrawingQuestion
    ? '\n\nIMPORTANT: This question asks students to DRAW a diagram, but the student provided a TEXT DESCRIPTION. Award marks if the description includes the key elements that should be in the diagram (labels, components, values, connections, etc.).'
    : ''

  const prompt = `You are marking an A-Level Physics answer strictly according to the mark scheme.

Question: ${questionText}

Mark Scheme:
${JSON.stringify(scheme, null, 2)}

Student Answer: ${answer}${drawingNote}

Mark this answer and return JSON in this EXACT format:
{
  "marks": <number between 0 and ${scheme.maxMarks}>,
  "feedback": "<detailed feedback explaining marks awarded/deducted>",
  "pointsAwarded": ["<specific point from mark scheme>"],
  "pointsMissed": ["<specific point student missed>"],
  "mistakeTags": ["<error types: concept_error, incomplete, definition_error, etc>"],
  "suggestions": "<brief advice for improvement>"
}

MARKING RULES:
1. Award marks ONLY for points that clearly match the mark scheme
2. Be strict but fair - accept equivalent physics terminology
3. Check for required keywords if specified
4. Partial credit is allowed for partially correct points
5. Maximum marks: ${scheme.maxMarks}`

  try {
    const result = await withTimeout(
      model.generateContent(prompt),
      20000,
      'Marking timed out'
    )

    const marking = JSON.parse(result.response.text())

    return {
      marks: Math.min(Math.max(0, marking.marks || 0), scheme.maxMarks),
      maxMarks: scheme.maxMarks,
      feedback: marking.feedback || 'Unable to generate feedback',
      pointsAwarded: marking.pointsAwarded || [],
      pointsMissed: marking.pointsMissed || [],
      mistakeTags: marking.mistakeTags || [],
      suggestions: marking.suggestions || '',
      isCorrect: marking.marks === scheme.maxMarks,
    }
  } catch (error) {
    console.error('Gemini marking error:', error)
    return {
      marks: 0,
      maxMarks: scheme.maxMarks,
      feedback: 'Unable to mark answer automatically.',
      mistakeTags: [],
      pointsAwarded: [],
      pointsMissed: [],
      suggestions: '',
    }
  }
}
