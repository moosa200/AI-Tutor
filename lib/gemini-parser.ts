import { GoogleGenerativeAI } from '@google/generative-ai'
import fs from 'fs'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)

export interface ExtractedQuestion {
  questionNumber: string
  text: string
  marks: number
  topic: string
  difficulty: 'easy' | 'medium' | 'hard'
  hasImage: boolean
}

const EXTRACTION_PROMPT = `You are parsing Cambridge A Level Physics (9702) past papers. Extract ALL questions from this PDF.

For each question, return a JSON object in this EXACT format:
{
  "questionNumber": "1(a)",
  "text": "Full question text here including figure descriptions and MCQ options",
  "marks": 4,
  "topic": "Mechanics",
  "difficulty": "medium",
  "hasImage": false
}

CRITICAL RULES FOR QUESTION NUMBERING:
- Use parentheses format: "1(a)", "2(b)(i)", "3(c)(ii)" NOT "1a", "2bi", "3cii"
- ALWAYS include (i) for first sub-parts: "1(b)(i)" NOT "1(b)"
- For questions with only one part like "1a", write it as "1(a)"
- For sub-parts, ALWAYS be explicit: If you see "1b i", write "1(b)(i)"
- Match the structure you see, just add parentheses consistently
- Examples: "1(a)", "1(b)(i)", "1(b)(ii)", "2(a)", "2(b)(i)", "2(d)(ii)"

FIGURES AND DIAGRAMS:
- You can SEE the figures/diagrams in this PDF. DESCRIBE them in detail within the question text.
- For circuit diagrams: describe all components, their values, and how they are connected (series/parallel).
- For graphs: describe the axes (labels and units), shape of the curve, and any key data points or values shown.
- For force/vector diagrams: describe the directions, magnitudes, angles, and labels.
- For experimental setups: describe the apparatus, arrangement, and any measurements shown.
- Format: Include the description in square brackets, e.g. "[Figure: A circuit shows a 1.5V battery connected in series with a 0.5 Ohm internal resistance and a 2.5 Ohm external resistor.]"
- Include ALL numerical values, labels, and annotations visible in the figure.
- hasImage: set to true if the question contains or references any figure/diagram.

MCQ QUESTIONS (Papers 11, 12, 13):
- These are multiple choice questions. You MUST include ALL four options (A, B, C, D) in the question text.
- Format the options on separate lines within the text:
  "What is the SI unit of pressure?\\nA  Pa\\nB  N\\nC  kg m^-1 s^-2\\nD  N m^-2"
- For MCQ, each question is worth 1 mark.
- Include any stem text, data, or tables that precede the options.

OTHER RULES:
- Topic MUST be one of: Mechanics, Waves, Electricity, Magnetism, Modern Physics, Nuclear Physics, General Physics
- Difficulty: easy (1-3 marks, straightforward), medium (4-6 marks, multi-step), hard (7+ marks, complex)
- Include ALL sub-questions, even if the question text seems to continue from a previous part
- Extract complete question text, preserving equations and values

Return ONLY a valid JSON array with NO markdown formatting, no code blocks, just pure JSON:
[{...}, {...}]`

export async function extractQuestionsFromPDF(
  pdfPath: string
): Promise<ExtractedQuestion[]> {
  try {
    console.log(`📄 Processing PDF: ${pdfPath}`)

    // Read PDF file as base64
    const pdfBuffer = fs.readFileSync(pdfPath)
    const pdfBase64 = pdfBuffer.toString('base64')

    // Use Gemini 2.0 Flash (free tier, multimodal)
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' })

    const result = await model.generateContent([
      {
        inlineData: {
          mimeType: 'application/pdf',
          data: pdfBase64,
        },
      },
      { text: EXTRACTION_PROMPT },
    ])

    const response = await result.response
    const text = response.text()

    console.log(`📝 Raw Gemini response length: ${text.length} chars`)

    // Clean response - remove markdown code blocks if present
    let cleanedText = text.trim()
    if (cleanedText.startsWith('```json')) {
      cleanedText = cleanedText.replace(/```json\n?/g, '').replace(/```\n?/g, '')
    } else if (cleanedText.startsWith('```')) {
      cleanedText = cleanedText.replace(/```\n?/g, '')
    }

    // Parse JSON
    const questions: ExtractedQuestion[] = JSON.parse(cleanedText)

    console.log(`✅ Successfully extracted ${questions.length} questions`)

    // Validate structure
    questions.forEach((q, idx) => {
      if (
        !q.questionNumber ||
        !q.text ||
        typeof q.marks !== 'number' ||
        !q.topic
      ) {
        throw new Error(
          `Invalid question at index ${idx}: ${JSON.stringify(q)}`
        )
      }
    })

    // Deduplicate questions by questionNumber (keep first occurrence)
    const seen = new Set<string>()
    const deduplicated = questions.filter((q) => {
      if (seen.has(q.questionNumber)) {
        console.warn(
          `⚠️  Duplicate question number found: ${q.questionNumber} (skipping duplicate)`
        )
        return false
      }
      seen.add(q.questionNumber)
      return true
    })

    if (deduplicated.length < questions.length) {
      console.log(
        `🔧 Deduplicated: ${questions.length} → ${deduplicated.length} questions`
      )
    }

    // Filter out 0-mark parent questions (e.g., "3(a)" when "3(a)(i)" exists)
    // These are just introductory text for sub-questions
    const filtered = deduplicated.filter((q) => {
      if (q.marks === 0) {
        // Check if there's a sub-question like "X(a)(i)" when this is "X(a)"
        const hasSubQuestion = deduplicated.some(
          (other) =>
            other.questionNumber !== q.questionNumber &&
            other.questionNumber.startsWith(q.questionNumber + '(')
        )
        if (hasSubQuestion) {
          console.log(
            `🔧 Filtering out 0-mark parent question: ${q.questionNumber} (has sub-questions)`
          )
          return false
        }
      }
      return true
    })

    if (filtered.length < deduplicated.length) {
      console.log(
        `🔧 Filtered: ${deduplicated.length} → ${filtered.length} questions`
      )
    }

    return filtered
  } catch (error) {
    if (error instanceof Error) {
      console.error(`❌ Error parsing PDF: ${error.message}`)
      // Log first 500 chars of response for debugging
      if ('response' in error) {
        console.error(
          'Response preview:',
          JSON.stringify(error).substring(0, 500)
        )
      }
    }
    throw error
  }
}
