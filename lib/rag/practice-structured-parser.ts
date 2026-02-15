import { GoogleGenerativeAI } from '@google/generative-ai'
import { InputType } from '@prisma/client'
import fs from 'fs'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)

export interface StructuredSubPart {
  subPartLabel: string // 'i', 'ii', 'iii'
  subPartText: string
  marks: number
  inputType: 'NUMERICAL' | 'TEXT' | 'LONG_TEXT' | 'MCQ_INLINE'
  markScheme: any
  hasImage: boolean
  pageNumber?: number
  imageBoundingBox?: [number, number, number, number] // [ymin, xmin, ymax, xmax] on 0-1000 scale
}

export interface StructuredPart {
  partLabel: string // 'a', 'b', 'c'
  partText: string
  marks: number
  inputType: 'NUMERICAL' | 'TEXT' | 'LONG_TEXT' | 'MCQ_INLINE'
  markScheme: any
  hasImage: boolean
  pageNumber?: number
  imageBoundingBox?: [number, number, number, number] // [ymin, xmin, ymax, xmax] on 0-1000 scale
  subParts?: StructuredSubPart[]
}

export interface StructuredQuestion {
  questionNumber: number
  totalMarks: number
  topic: string
  difficulty: 'easy' | 'medium' | 'hard'
  hasImage: boolean
  pageNumber?: number
  imageBoundingBox?: [number, number, number, number] // [ymin, xmin, ymax, xmax] on 0-1000 scale
  parts: StructuredPart[]
}

export async function parseStructuredPaper(
  questionPaperPath: string,
  markSchemePath: string
): Promise<StructuredQuestion[]> {
  console.log('📄 Processing structured question paper with vision...')

  console.log('📋 Extracting text from mark scheme...')
  const msText = await extractTextFromPDF(markSchemePath)

  console.log('🤖 Using Gemini Vision to parse structured questions in chunks...')

  // Load PDF and split into chunks
  const { PDFDocument } = await import('pdf-lib')
  const pdfBuffer = fs.readFileSync(questionPaperPath)
  const pdfDoc = await PDFDocument.load(pdfBuffer)
  const totalPages = pdfDoc.getPageCount()
  const CHUNK_SIZE = 5 // Process 5 pages at a time

  const allQuestions: StructuredQuestion[] = []

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

    const prompt = `You are parsing an A-Level Physics structured question paper PDF using vision and its mark scheme.

MARK SCHEME TEXT:
${msText.substring(0, 20000)}

Extract ALL questions with their parts and subparts from this chunk of the paper.

For EACH question:
1. questionNumber (integer)
2. totalMarks (total marks for the question)
3. topic (classify as: Kinematics, Forces, Energy, Waves, Electricity, Magnetism, Nuclear Physics, etc.)
4. difficulty ('easy', 'medium', 'hard')
5. hasImage (true if question stem has diagram/table/graph)
6. pageNumber (REQUIRED if hasImage is true - page number where the image appears, 1-based integer)
7. imageBoundingBox (REQUIRED if hasImage is true - bounding box as [ymin, xmin, ymax, xmax] on 0-1000 scale)
8. parts (array of parts)

For EACH part:
1. partLabel ('a', 'b', 'c', etc.)
2. partText (full text including LaTeX for equations)
3. marks (marks for this part, or 0 if it has subparts)
4. inputType (determine from question):
   - "NUMERICAL" if asking to "Calculate", "Determine", "Find the value"
   - "TEXT" for definitions, short explanations (1-2 sentences)
   - "LONG_TEXT" for "Explain", "Describe", "Discuss" (multiple marks, 3+)
   - "MCQ_INLINE" if multiple choice within structured question
5. hasImage (true if this part has a diagram/table/graph)
6. pageNumber (REQUIRED if hasImage is true - page number where the image appears, 1-based integer)
7. imageBoundingBox (REQUIRED if hasImage is true - bounding box as [ymin, xmin, ymax, xmax] on 0-1000 scale)
8. markScheme (structured JSON based on inputType):

   For NUMERICAL:
   {
     "type": "numerical",
     "correctValue": <number>,
     "unit": "<unit>",
     "tolerance": <number or percentage string like "2%">,
     "alternativeUnits": ["alt1", "alt2"],
     "maxMarks": <marks>,
     "explanation": "<REQUIRED: brief step-by-step working showing how to arrive at the answer>"
   }

   For TEXT/LONG_TEXT:
   {
     "type": "text",
     "maxMarks": <marks>,
     "keywords": ["keyword1", "keyword2"],
     "explanation": "<REQUIRED: brief model answer or explanation of the key physics concepts expected>",
     "requiredPoints": [
       {
         "point": "description of point",
         "marks": <marks for this point>,
         "keywords": ["keyword1", "keyword2"]
       }
     ]
   }

   For MCQ_INLINE:
   {
     "type": "mcq",
     "options": ["option1", "option2", "option3", "option4"],
     "correctOption": "A",
     "explanation": "<REQUIRED: brief explanation of why the correct option is right>"
   }

9. subParts (ONLY if the part has subparts like (i), (ii), (iii))
   Each subpart MUST have:
   - subPartLabel: 'i', 'ii', 'iii', etc.
   - subPartText: full text of the subpart
   - marks: marks for this subpart
   - inputType: same options as parts
   - hasImage: true/false
   - pageNumber: REQUIRED if hasImage is true (page number, 1-based integer)
   - imageBoundingBox: REQUIRED if hasImage is true ([ymin, xmin, ymax, xmax] on 0-1000 scale)
   - markScheme: same structure as parts

IMPORTANT:
- ALWAYS provide ALL required fields (partLabel, partText, marks, inputType, markScheme)
- If a part has subparts, the parent part marks should be 0 or sum of subpart marks
- NEVER use 'undefined' or 'null' for required string fields
- For subparts, ALWAYS provide subPartLabel ('i', 'ii', 'iii') and subPartText

CRITICAL - IMAGE MATCHING RULES:
- ONLY set hasImage=true if the question/part/subpart contains or directly references a PHYSICS diagram, graph, table, circuit, or figure
- NEVER treat barcodes, page headers, footers, candidate numbers, or exam paper metadata as images
- The imageBoundingBox MUST tightly wrap ONLY the relevant diagram/graph/table for THAT SPECIFIC question/part
- If multiple questions appear on the same page, each should only get its OWN image, not another question's image
- VERIFY the image content matches what the question text describes
- When in doubt, set hasImage=false rather than providing a wrong or irrelevant bounding box
- Common false positives to IGNORE: barcodes, dotted answer lines, blank spaces, page numbers, exam headers

FORMATTING RULES:
- Use LaTeX: $F = ma$, $\\frac{1}{2}mv^2$, $E = mc^2$
- Units: $v = 20 \\text{ m s}^{-1}$
- Extract actual numerical answers from mark scheme
- Extract marking criteria keywords from mark scheme

Return JSON:
{
  "questions": [
    {
      "questionNumber": 1,
      "totalMarks": 8,
      "topic": "Forces",
      "difficulty": "medium",
      "hasImage": false,
      "parts": [
        {
          "partLabel": "a",
          "partText": "Calculate the acceleration...",
          "marks": 3,
          "inputType": "NUMERICAL",
          "hasImage": false,
          "markScheme": {
            "type": "numerical",
            "correctValue": 2.5,
            "unit": "m s^{-2}",
            "tolerance": 0.1,
            "alternativeUnits": ["m/s^2", "ms^-2"],
            "maxMarks": 3
          }
        },
        {
          "partLabel": "b",
          "partText": "This part has subparts:",
          "marks": 5,
          "inputType": "TEXT",
          "hasImage": false,
          "markScheme": { "type": "text", "maxMarks": 0 },
          "subParts": [
            {
              "subPartLabel": "i",
              "subPartText": "Define velocity.",
              "marks": 2,
              "inputType": "TEXT",
              "hasImage": false,
              "markScheme": {
                "type": "text",
                "maxMarks": 2,
                "keywords": ["displacement", "time"],
                "requiredPoints": []
              }
            },
            {
              "subPartLabel": "ii",
              "subPartText": "Calculate the velocity.",
              "marks": 3,
              "inputType": "NUMERICAL",
              "hasImage": false,
              "markScheme": {
                "type": "numerical",
                "correctValue": 15.5,
                "unit": "m/s",
                "tolerance": 0.1,
                "alternativeUnits": [],
                "maxMarks": 3
              }
            }
          ]
        }
      ]
    }
  ]
}

Parse ALL questions from this chunk of the paper.`

    let chunkQuestions: StructuredQuestion[] = []
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
          // Try to clean up common JSON issues
          const cleanedText = responseText
            .replace(/\n/g, '\\n') // Escape newlines in strings
            .replace(/\t/g, '\\t') // Escape tabs

          try {
            parsed = JSON.parse(cleanedText)
          } catch {
            // If cleaning didn't work, try original
            parsed = JSON.parse(responseText)
          }
        } catch (error) {
          console.error('❌ JSON parse error. Response preview:')
          console.error(responseText.substring(0, 500))
          throw new Error(`Failed to parse JSON: ${error}`)
        }

        if (!parsed.questions || !Array.isArray(parsed.questions)) {
          throw new Error('Invalid response format: missing questions array')
        }

        // Sanitize and fill in missing fields
        const questions = parsed.questions.map((q: any) => ({
    ...q,
    parts: q.parts.map((part: any, partIdx: number) => {
      const sanitizedPart = {
        ...part,
        partLabel: part.partLabel || String.fromCharCode(97 + partIdx), // a, b, c...
        partText: part.partText || '',
        marks: part.marks || 0,
        inputType: part.inputType || 'TEXT',
        hasImage: part.hasImage || false,
        markScheme: part.markScheme || { type: 'text', maxMarks: part.marks || 0 },
      }

      // Handle subparts
      if (part.subParts && Array.isArray(part.subParts)) {
        const romanNumerals = ['i', 'ii', 'iii', 'iv', 'v', 'vi', 'vii', 'viii']
        sanitizedPart.subParts = part.subParts.map((subPart: any, subIdx: number) => ({
          ...subPart,
          subPartLabel: subPart.subPartLabel || romanNumerals[subIdx] || `${subIdx + 1}`,
          subPartText: subPart.subPartText || subPart.partText || '',
          marks: subPart.marks || 0,
          inputType: subPart.inputType || 'TEXT',
          hasImage: subPart.hasImage || false,
          markScheme: subPart.markScheme || { type: 'text', maxMarks: subPart.marks || 0 },
        }))
      }

      return sanitizedPart
    }),
  }))

        chunkQuestions = questions

        // Convert chunk-relative page numbers to absolute and validate bounding boxes
        for (const q of chunkQuestions) {
          if (q.pageNumber) q.pageNumber += startPage
          if (q.hasImage && q.imageBoundingBox) {
            const [ymin, xmin, ymax, xmax] = q.imageBoundingBox
            if (!(ymin >= 0 && xmin >= 0 && ymax <= 1000 && xmax <= 1000 &&
                  ymax > ymin && xmax > xmin &&
                  (ymax - ymin) >= 20 && (xmax - xmin) >= 20)) {
              q.hasImage = false; q.imageBoundingBox = undefined; q.pageNumber = undefined
            }
          }
          for (const part of q.parts) {
            if (part.pageNumber) part.pageNumber += startPage
            if (part.hasImage && part.imageBoundingBox) {
              const [ymin, xmin, ymax, xmax] = part.imageBoundingBox
              if (!(ymin >= 0 && xmin >= 0 && ymax <= 1000 && xmax <= 1000 &&
                    ymax > ymin && xmax > xmin &&
                    (ymax - ymin) >= 20 && (xmax - xmin) >= 20)) {
                part.hasImage = false; part.imageBoundingBox = undefined; part.pageNumber = undefined
              }
            }
            if (part.subParts) {
              for (const sp of part.subParts) {
                if (sp.pageNumber) sp.pageNumber += startPage
                if (sp.hasImage && sp.imageBoundingBox) {
                  const [ymin, xmin, ymax, xmax] = sp.imageBoundingBox
                  if (!(ymin >= 0 && xmin >= 0 && ymax <= 1000 && xmax <= 1000 &&
                        ymax > ymin && xmax > xmin &&
                        (ymax - ymin) >= 20 && (xmax - xmin) >= 20)) {
                    sp.hasImage = false; sp.imageBoundingBox = undefined; sp.pageNumber = undefined
                  }
                }
              }
            }
          }
        }

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

  console.log(`✅ Parsed ${allQuestions.length} total structured questions`)

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
    console.log(
      `🔧 Deduplicated: ${allQuestions.length} → ${deduplicated.length} questions`
    )
  }

  return deduplicated
}

// Helper to extract text from PDF
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
