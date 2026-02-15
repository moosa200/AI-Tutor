import { GoogleGenerativeAI } from '@google/generative-ai'
import fs from 'fs'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)

export interface MCQQuestion {
  questionNumber: number
  questionText: string
  optionA: string
  optionB: string
  optionC: string
  optionD: string
  correctOption: string
  explanation?: string
  topic: string
  difficulty: 'easy' | 'medium' | 'hard'
  hasImage: boolean
  pageNumber?: number
  imageBoundingBox?: [number, number, number, number] // [ymin, xmin, ymax, xmax] on 0-1000 scale
}

export async function parseMCQPaper(
  questionPaperPath: string,
  markSchemePath: string
): Promise<MCQQuestion[]> {
  console.log('📄 Processing MCQ question paper with vision...')

  console.log('📋 Extracting text from mark scheme...')
  const msText = await extractTextFromPDF(markSchemePath)

  console.log('🤖 Using Gemini Vision to parse MCQ questions in chunks...')

  // Load PDF and split into chunks
  const { PDFDocument } = await import('pdf-lib')
  const pdfBuffer = fs.readFileSync(questionPaperPath)
  const pdfDoc = await PDFDocument.load(pdfBuffer)
  const totalPages = pdfDoc.getPageCount()
  const CHUNK_SIZE = 5 // Process 5 pages at a time (roughly 10 questions per chunk)

  const allQuestions: MCQQuestion[] = []

  console.log(`   Splitting ${totalPages} pages into chunks of ${CHUNK_SIZE}...`)

  for (let i = 0; i < totalPages; i += CHUNK_SIZE) {
    const startPage = i
    const endPage = Math.min(i + CHUNK_SIZE, totalPages)
    console.log(`   Processing chunk: Pages ${startPage + 1}-${endPage}`)

    // Add delay to avoid rate limits
    if (i > 0) await new Promise((resolve) => setTimeout(resolve, 5000))

    // Create chunk PDF
    const chunkPdf = await PDFDocument.create()
    const pages = await chunkPdf.copyPages(
      pdfDoc,
      Array.from({ length: endPage - startPage }, (_, k) => startPage + k)
    )
    pages.forEach((p) => chunkPdf.addPage(p))
    const chunkBytes = await chunkPdf.save()
    const chunkBase64 = Buffer.from(chunkBytes).toString('base64')

    const model = genAI.getGenerativeModel({
      model: 'gemini-2.0-flash',
      generationConfig: {
        responseMimeType: 'application/json',
        maxOutputTokens: 8192,
      },
    })

    const prompt = `You are parsing an A-Level Physics MCQ paper (Paper 1) PDF using vision.

MARK SCHEME TEXT:
${msText.substring(0, 20000)}

Extract ALL MCQ questions from the PDF and return them as a JSON array.

For EACH question, extract:
1. questionNumber (integer, e.g., 1, 2, 3...)
2. questionText (the full question text, including any equations using LaTeX format)
3. optionA, optionB, optionC, optionD (the four answer choices)
4. correctOption (from mark scheme: 'A', 'B', 'C', or 'D')
5. explanation (REQUIRED - briefly explain WHY the correct answer is right and why common wrong answers are incorrect, using physics concepts. Always provide this even if the mark scheme doesn't have one.)
6. topic (classify as one of: Kinematics, Forces, Energy, Momentum, Circular Motion, Gravitation, Oscillations, Waves, Electricity, Magnetism, Nuclear Physics, Quantum Physics, or General)
7. difficulty ('easy', 'medium', or 'hard' based on concept complexity)
8. hasImage (true if the question references a diagram/figure/graph/table)
9. pageNumber (REQUIRED if hasImage is true - page number where the image appears, 1-based integer)
10. imageBoundingBox (REQUIRED if hasImage is true - bounding box as [ymin, xmin, ymax, xmax] on 0-1000 scale)

CRITICAL - IMAGE MATCHING RULES:
- ONLY set hasImage=true if THIS SPECIFIC QUESTION directly references or requires a diagram/table/graph/figure
- The imageBoundingBox MUST be for the image that belongs to THIS QUESTION ONLY
- If multiple questions appear on the same page, each question should only get its OWN image
- VERIFY the image content matches what the question text describes (e.g., if question says "the table shows", the bounding box must be for that specific table, not another diagram on the page)
- If a question says "the diagram shows a circuit" but the nearby image shows a graph, DO NOT use that graph - set hasImage=false instead
- When in doubt, set hasImage=false rather than providing a wrong bounding box

IMPORTANT FORMATTING:
- Use LaTeX notation for all mathematical expressions: $E = mc^2$, $\\frac{1}{2}mv^2$, etc.
- Use \\text{} for units: $v = 20 \\text{ m s}^{-1}$
- Preserve superscripts/subscripts: $R_1$, $x^2$
- Keep question text concise but complete
- For questions with diagrams/tables/graphs: provide the bounding box in [ymin, xmin, ymax, xmax] format (0-1000 scale)

Return JSON in this exact format:
{
  "questions": [
    {
      "questionNumber": 1,
      "questionText": "A ball is thrown...",
      "optionA": "$10 \\\\text{ m}$",
      "optionB": "$20 \\\\text{ m}$",
      "optionC": "$30 \\\\text{ m}$",
      "optionD": "$40 \\\\text{ m}$",
      "correctOption": "B",
      "explanation": "Using $v^2 = u^2 + 2as$...",
      "topic": "Kinematics",
      "difficulty": "easy",
      "hasImage": false
    },
    {
      "questionNumber": 2,
      "questionText": "The table shows...",
      "optionA": "scalars only",
      "optionB": "vectors only",
      "optionC": "both",
      "optionD": "neither",
      "correctOption": "C",
      "explanation": null,
      "topic": "General",
      "difficulty": "easy",
      "hasImage": true,
      "pageNumber": 1,
      "imageBoundingBox": [100, 200, 400, 800]
    }
  ]
}

Extract ALL questions from this chunk of the paper.`

    let chunkQuestions: MCQQuestion[] = []
    let parseSuccess = false
    let retryCount = 0

    while (!parseSuccess && retryCount < 2) {
      try {
        const result = await model.generateContent([
          {
            inlineData: {
              mimeType: 'application/pdf',
              data: chunkBase64,
            },
          },
          { text: prompt },
        ])

        const responseText = result.response.text()

        if (!responseText || responseText.trim().length === 0) {
          throw new Error('Gemini returned empty response')
        }

        let parsed
        try {
          parsed = JSON.parse(responseText)
        } catch (error) {
          console.error('❌ JSON parse error. Response preview:')
          console.error(responseText.substring(0, 500))
          throw new Error(`Failed to parse JSON: ${error}`)
        }

        if (!parsed.questions || !Array.isArray(parsed.questions)) {
          throw new Error('Invalid response format: missing questions array')
        }

        // Convert chunk-relative page numbers to absolute and validate bounding boxes
        chunkQuestions = parsed.questions.map((q: MCQQuestion) => {
          if (q.pageNumber) q.pageNumber += startPage
          if (q.hasImage && q.imageBoundingBox) {
            const [ymin, xmin, ymax, xmax] = q.imageBoundingBox
            const valid = ymin >= 0 && xmin >= 0 && ymax <= 1000 && xmax <= 1000 &&
              ymax > ymin && xmax > xmin &&
              (ymax - ymin) >= 20 && (xmax - xmin) >= 20
            if (!valid) {
              console.warn(`   ⚠️  Invalid bounding box for Q${q.questionNumber}, skipping image`)
              q.hasImage = false
              q.imageBoundingBox = undefined
              q.pageNumber = undefined
            }
          }
          return q
        })
        allQuestions.push(...chunkQuestions)
        console.log(`   ✓ Extracted ${chunkQuestions.length} questions from chunk`)
        parseSuccess = true
      } catch (e) {
        console.error(
          `   ❌ Error parsing chunk ${startPage + 1}-${endPage} (Attempt ${retryCount + 1}):`,
          e
        )
        retryCount++
        if (retryCount < 2) {
          console.log('   🔄 Retrying chunk...')
          await new Promise((resolve) => setTimeout(resolve, 5000))
        }
      }
    }

    if (!parseSuccess) {
      console.warn(`   ⚠️  Failed to process chunk ${startPage + 1}-${endPage} after retries`)
    }
  }

  console.log(`✅ Parsed ${allQuestions.length} total MCQ questions`)

  // Deduplicate by question number
  const seen = new Set<number>()
  const deduplicated = allQuestions.filter((q) => {
    if (seen.has(q.questionNumber)) {
      console.warn(`⚠️  Duplicate question ${q.questionNumber} (skipping)`)
      return false
    }
    seen.add(q.questionNumber)
    return true
  })

  if (deduplicated.length < allQuestions.length) {
    console.log(`🔧 Deduplicated: ${allQuestions.length} → ${deduplicated.length} questions`)
  }

  return deduplicated
}

// Helper to extract text from PDF (simple version)
async function extractTextFromPDF(pdfPath: string): Promise<string> {
  const fs = await import('fs')
  const mupdf = await import('mupdf')

  const data = fs.readFileSync(pdfPath)
  const doc = mupdf.Document.openDocument(data, 'application/pdf')

  let fullText = ''
  for (let i = 0; i < doc.countPages(); i++) {
    const page = doc.loadPage(i)
    const text = page.toStructuredText('preserve-whitespace').asJSON()
    const textContent = JSON.parse(text)

    // Extract text blocks
    if (textContent.blocks) {
      for (const block of textContent.blocks) {
        if (block.lines) {
          for (const line of block.lines) {
            if (line.text) {
              fullText += line.text + '\n'
            }
          }
        }
      }
    }
  }

  return fullText
}
