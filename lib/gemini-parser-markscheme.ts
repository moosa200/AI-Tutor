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

    // Load PDF to split into chunks
    const pdfBuffer = fs.readFileSync(pdfPath)
    const pdfDoc = await PDFDocument.load(pdfBuffer)
    const totalPages = pdfDoc.getPageCount()
    const CHUNK_SIZE = 10
    
    const allMarkSchemes: ExtractedMarkScheme[] = []

    console.log(`   Splitting ${totalPages} pages into chunks of ${CHUNK_SIZE}...`)

    for (let i = 0; i < totalPages; i += CHUNK_SIZE) {
      const startPage = i
      const endPage = Math.min(i + CHUNK_SIZE, totalPages)
      console.log(`   Processing chunk: Pages ${startPage + 1}-${endPage}`)

      // Add delay to avoid rate limits
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

      let chunkSchemes: ExtractedMarkScheme[] = []
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
            { text: MARKSCHEME_PROMPT },
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

          chunkSchemes = JSON.parse(cleanedText)
          allMarkSchemes.push(...chunkSchemes)
          console.log(`   ✓ Extracted ${chunkSchemes.length} mark schemes from chunk`)
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

    const markSchemes = allMarkSchemes

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
