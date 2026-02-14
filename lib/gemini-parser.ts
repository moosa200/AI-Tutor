import { GoogleGenerativeAI } from '@google/generative-ai'
import fs from 'fs'
import { PDFDocument } from 'pdf-lib'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)

// Helper for delay
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

// Helper for retry
async function generateWithRetry(model: any, parts: any[], maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await model.generateContent(parts)
    } catch (error: any) {
      if ((error.status === 429 || error.message?.includes('429')) && i < maxRetries - 1) {
        const delay = Math.pow(2, i) * 5000 + 5000 // 10s, 15s, 25s
        console.log(`   ⚠️  Rate limit hit. Retrying in ${delay / 1000}s...`)
        await wait(delay)
      } else {
        throw error
      }
    }
  }
}

export interface ExtractedQuestion {
  questionNumber: string
  text: string
  marks: number | null
  topic: string
  difficulty: 'easy' | 'medium' | 'hard'
  hasImage: boolean
  figureBoundingBox?: [number, number, number, number]
  pageNumber: number
}

const EXTRACTION_PROMPT = `You are parsing Cambridge A Level Physics (9702) past papers. Extract ALL questions from this PDF.

For each question, return a JSON object in this EXACT format:
{
  "questionNumber": "1(a)",
  "text": "Full question text here including figure descriptions and MCQ options",
  "marks": 4,
  "topic": "Mechanics",
  "difficulty": "medium",
  "hasImage": false,
  "figureBoundingBox": null,
  "pageNumber": 2
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
- figureBoundingBox: REQUIRED if hasImage is true. Return the bounding box as [ymin, xmin, ymax, xmax] on a 0-1000 scale.
- pageNumber: The page number in the PDF where this question appears (integer, 1-based).

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

    // Load PDF to split into chunks
    const pdfBuffer = fs.readFileSync(pdfPath)
    const pdfDoc = await PDFDocument.load(pdfBuffer)
    const totalPages = pdfDoc.getPageCount()
    const CHUNK_SIZE = 10 // Process 10 pages at a time
    
    const allQuestions: ExtractedQuestion[] = []

    console.log(`   Splitting ${totalPages} pages into chunks of ${CHUNK_SIZE}...`)

    for (let i = 0; i < totalPages; i += CHUNK_SIZE) {
      const startPage = i
      const endPage = Math.min(i + CHUNK_SIZE, totalPages)
      console.log(`   Processing chunk: Pages ${startPage + 1}-${endPage}`)

      // Add delay to avoid rate limits (Gemini free tier: 15 RPM)
      if (i > 0) await wait(10000)

      // Create chunk PDF
      const chunkPdf = await PDFDocument.create()
      const pages = await chunkPdf.copyPages(pdfDoc, Array.from({ length: endPage - startPage }, (_, k) => startPage + k))
      pages.forEach(p => chunkPdf.addPage(p))
      const chunkBytes = await chunkPdf.save()
      const chunkBase64 = Buffer.from(chunkBytes).toString('base64')

      // Use Gemini 2.0 Flash
      const model = genAI.getGenerativeModel({
        model: 'gemini-2.0-flash',
        generationConfig: { responseMimeType: 'application/json', maxOutputTokens: 8192 },
      })

      let chunkQuestions: ExtractedQuestion[] = []
      let parseSuccess = false
      let retryCount = 0

      while (!parseSuccess && retryCount < 2) {
        try {
          const result = await generateWithRetry(model, [
            {
              inlineData: {
                mimeType: 'application/pdf',
                data: chunkBase64,
              },
            },
            { text: EXTRACTION_PROMPT },
          ])

          const response = await result.response
          const text = response.text()

          // Clean response
          let cleanedText = text.trim()
          if (cleanedText.startsWith('```json')) {
            cleanedText = cleanedText.replace(/```json\n?/g, '').replace(/```\n?/g, '')
          } else if (cleanedText.startsWith('```')) {
            cleanedText = cleanedText.replace(/```\n?/g, '')
          }

          chunkQuestions = JSON.parse(cleanedText)
          allQuestions.push(...chunkQuestions)
          console.log(`   ✓ Extracted ${chunkQuestions.length} questions from chunk`)
          parseSuccess = true
        } catch (e) {
          console.error(`   ❌ Error parsing JSON for chunk ${startPage + 1}-${endPage} (Attempt ${retryCount + 1}):`, e)
          retryCount++
          if (retryCount < 2) {
            console.log('   🔄 Retrying generation for this chunk...')
            await wait(5000)
          }
        }
      }
    }

    const questions = allQuestions

    console.log(`✅ Successfully extracted ${questions.length} questions`)

    // Validate structure
    questions.forEach((q, idx) => {
      // Handle null marks (common for parent questions or diagrams)
      if (q.marks === null || q.marks === undefined) {
        q.marks = 0
      }

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
