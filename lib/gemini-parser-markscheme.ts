import { GoogleGenerativeAI } from '@google/generative-ai'
import fs from 'fs'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)

export interface ExtractedMarkScheme {
  questionNumber: string
  markScheme: string
  examinerRemarks?: string
}

const MARKSCHEME_PROMPT = `You are parsing Cambridge A Level Physics (9702) mark scheme PDFs. Extract ALL mark schemes from this PDF.

For each question's mark scheme, return a JSON object in this EXACT format:
{
  "questionNumber": "1(a)",
  "markScheme": "Complete marking criteria with all acceptable answers, equations, and point allocation",
  "examinerRemarks": "Common mistakes or examiner notes (if mentioned in the mark scheme)"
}

CRITICAL RULES FOR QUESTION NUMBERING:
- Use parentheses format: "1(a)", "2(b)(i)", "3(c)(ii)" NOT "1a", "2bi", "3cii"
- ALWAYS include (i) for first sub-parts: "1(b)(i)" NOT "1(b)"
- Match EXACTLY what you see in the mark scheme PDF, using parentheses consistently
- Examples: "1(a)", "1(b)(i)", "1(b)(ii)", "2(a)", "2(d)(i)", "2(d)(ii)"

OTHER RULES:
- Include ALL mark allocation details and acceptable answer variations
- Extract examinerRemarks ONLY if explicitly stated in the document
- Preserve equations, numerical values, and units
- Include alternative acceptable answers where mentioned

Return ONLY a valid JSON array with NO markdown formatting, no code blocks, just pure JSON:
[{...}, {...}]`

export async function extractMarkSchemeFromPDF(
  pdfPath: string
): Promise<ExtractedMarkScheme[]> {
  try {
    console.log(`📋 Processing mark scheme PDF: ${pdfPath}`)

    // Read PDF file as base64
    const pdfBuffer = fs.readFileSync(pdfPath)
    const pdfBase64 = pdfBuffer.toString('base64')

    // Use Gemini 2.0 Flash
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' })

    const result = await model.generateContent([
      {
        inlineData: {
          mimeType: 'application/pdf',
          data: pdfBase64,
        },
      },
      { text: MARKSCHEME_PROMPT },
    ])

    const response = await result.response
    const text = response.text()

    console.log(`📝 Raw mark scheme response length: ${text.length} chars`)

    // Clean response
    let cleanedText = text.trim()
    if (cleanedText.startsWith('```json')) {
      cleanedText = cleanedText.replace(/```json\n?/g, '').replace(/```\n?/g, '')
    } else if (cleanedText.startsWith('```')) {
      cleanedText = cleanedText.replace(/```\n?/g, '')
    }

    // Parse JSON
    const markSchemes: ExtractedMarkScheme[] = JSON.parse(cleanedText)

    console.log(`✅ Successfully extracted ${markSchemes.length} mark schemes`)

    // Validate structure
    markSchemes.forEach((ms, idx) => {
      if (!ms.questionNumber || !ms.markScheme) {
        throw new Error(
          `Invalid mark scheme at index ${idx}: ${JSON.stringify(ms)}`
        )
      }
    })

    return markSchemes
  } catch (error) {
    if (error instanceof Error) {
      console.error(`❌ Error parsing mark scheme PDF: ${error.message}`)
    }
    throw error
  }
}

// Merge questions with their mark schemes
export function mergeQuestionsWithMarkSchemes<
  T extends { questionNumber: string }
>(
  questions: T[],
  markSchemes: ExtractedMarkScheme[]
): (T & { markScheme: string; examinerRemarks?: string })[] {
  const markSchemeMap = new Map(
    markSchemes.map((ms) => [ms.questionNumber, ms])
  )

  return questions.map((q) => {
    const ms = markSchemeMap.get(q.questionNumber)
    if (!ms) {
      console.warn(
        `⚠️  No mark scheme found for question ${q.questionNumber}`
      )
      return {
        ...q,
        markScheme: 'Mark scheme not found',
        examinerRemarks: undefined,
      }
    }
    return {
      ...q,
      markScheme: ms.markScheme,
      examinerRemarks: ms.examinerRemarks,
    }
  })
}
