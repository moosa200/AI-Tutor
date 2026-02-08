import { GoogleGenerativeAI } from '@google/generative-ai'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)
const MODEL_NAME = 'gemini-2.0-flash'

export interface MarkingResult {
  score: number
  maxScore: number
  feedback: string
  breakdown: {
    point: string
    awarded: boolean
    comment: string
  }[]
  mistakeTags: string[]
  improvements: string[]
}

const MARKING_SYSTEM_PROMPT = `You are an expert A Level Physics examiner for Cambridge 9702. Your task is to mark student answers strictly according to the official mark scheme.

MARKING PRINCIPLES:
1. Award marks ONLY for points that match the mark scheme criteria
2. Be strict but fair - accept equivalent physics terminology
3. Check for correct units and significant figures
4. Identify specific errors and misconceptions
5. Provide constructive feedback for improvement

OUTPUT FORMAT:
You must respond with valid JSON in this exact format:
{
  "score": <number of marks awarded>,
  "maxScore": <maximum marks available>,
  "feedback": "<overall feedback paragraph>",
  "breakdown": [
    {
      "point": "<mark scheme point>",
      "awarded": <true/false>,
      "comment": "<why awarded or not>"
    }
  ],
  "mistakeTags": ["<error categories like: unit_error, sig_fig, concept_error, incomplete, calculation_error, formula_error>"],
  "improvements": ["<specific suggestions for improvement>"]
}

COMMON MISTAKE TAGS:
- unit_error: Missing or incorrect units
- sig_fig: Wrong number of significant figures
- concept_error: Fundamental misunderstanding of physics
- incomplete: Answer lacks required detail
- calculation_error: Mathematical mistake
- formula_error: Wrong equation used
- direction_error: Missing or wrong direction/sign
- definition_error: Imprecise definition`

export async function markAnswer(
  questionText: string,
  markScheme: string,
  studentAnswer: string,
  maxMarks: number,
  examinerRemarks?: string
): Promise<MarkingResult> {
  const prompt = `QUESTION (${maxMarks} marks):
${questionText}

OFFICIAL MARK SCHEME:
${markScheme}

${examinerRemarks ? `EXAMINER REMARKS:\n${examinerRemarks}\n` : ''}
STUDENT ANSWER:
${studentAnswer}

Mark this answer according to the mark scheme. Be strict but fair. Return JSON only, no markdown code blocks.`

  const model = genAI.getGenerativeModel({
    model: MODEL_NAME,
    systemInstruction: MARKING_SYSTEM_PROMPT,
    generationConfig: {
      responseMimeType: 'application/json',
    },
  })

  try {
    const result = await model.generateContent(prompt)
    const response = await result.response
    const text = response.text()

    // Parse JSON
    const markingResult = JSON.parse(text) as MarkingResult

    // Validate and sanitize
    return {
      score: Math.min(Math.max(0, markingResult.score || 0), maxMarks),
      maxScore: maxMarks,
      feedback: markingResult.feedback || 'Unable to generate feedback',
      breakdown: markingResult.breakdown || [],
      mistakeTags: markingResult.mistakeTags || [],
      improvements: markingResult.improvements || [],
    }
  } catch (error) {
    console.error('Failed to parse marking response:', error)
    return {
      score: 0,
      maxScore: maxMarks,
      feedback: 'Error processing your answer. Please try again.',
      breakdown: [],
      mistakeTags: ['parsing_error'],
      improvements: ['Please resubmit your answer'],
    }
  }
}
