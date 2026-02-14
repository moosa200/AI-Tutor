import { GoogleGenerativeAI } from '@google/generative-ai'
import { InputType } from '@prisma/client'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)

export interface StructuredSubPart {
  subPartLabel: string // 'i', 'ii', 'iii'
  subPartText: string
  marks: number
  inputType: 'NUMERICAL' | 'TEXT' | 'LONG_TEXT' | 'MCQ_INLINE'
  markScheme: any
  hasImage: boolean
  pageNumber?: number
  imageBoundingBox?: { x: number; y: number; width: number; height: number }
}

export interface StructuredPart {
  partLabel: string // 'a', 'b', 'c'
  partText: string
  marks: number
  inputType: 'NUMERICAL' | 'TEXT' | 'LONG_TEXT' | 'MCQ_INLINE'
  markScheme: any
  hasImage: boolean
  pageNumber?: number
  imageBoundingBox?: { x: number; y: number; width: number; height: number }
  subParts?: StructuredSubPart[]
}

export interface StructuredQuestion {
  questionNumber: number
  totalMarks: number
  topic: string
  difficulty: 'easy' | 'medium' | 'hard'
  hasImage: boolean
  pageNumber?: number
  imageBoundingBox?: { x: number; y: number; width: number; height: number }
  parts: StructuredPart[]
}

export async function parseStructuredPaper(
  questionPaperPath: string,
  markSchemePath: string
): Promise<StructuredQuestion[]> {
  console.log('📄 Extracting text from structured question paper...')
  const qpText = await extractTextFromPDF(questionPaperPath)

  console.log('📋 Extracting text from mark scheme...')
  const msText = await extractTextFromPDF(markSchemePath)

  console.log('🤖 Using Gemini to parse structured questions...')

  const model = genAI.getGenerativeModel({
    model: 'gemini-2.0-flash',
    generationConfig: {
      responseMimeType: 'application/json',
    },
  })

  const prompt = `You are parsing an A-Level Physics structured question paper and its mark scheme.

QUESTION PAPER TEXT:
${qpText.substring(0, 50000)}

MARK SCHEME TEXT:
${msText.substring(0, 30000)}

Extract ALL questions with their parts and subparts.

For EACH question:
1. questionNumber (integer)
2. totalMarks (total marks for the question)
3. topic (classify as: Kinematics, Forces, Energy, Waves, Electricity, Magnetism, Nuclear Physics, etc.)
4. difficulty ('easy', 'medium', 'hard')
5. hasImage (true if question stem has diagram)
6. parts (array of parts)

For EACH part:
1. partLabel ('a', 'b', 'c', etc.)
2. partText (full text including LaTeX for equations)
3. marks (marks for this part, or 0 if it has subparts)
4. inputType (determine from question):
   - "NUMERICAL" if asking to "Calculate", "Determine", "Find the value"
   - "TEXT" for definitions, short explanations (1-2 sentences)
   - "LONG_TEXT" for "Explain", "Describe", "Discuss" (multiple marks, 3+)
   - "MCQ_INLINE" if multiple choice within structured question
5. hasImage (true if this part has a diagram)
6. markScheme (structured JSON based on inputType):

   For NUMERICAL:
   {
     "type": "numerical",
     "correctValue": <number>,
     "unit": "<unit>",
     "tolerance": <number or percentage string like "2%">,
     "alternativeUnits": ["alt1", "alt2"],
     "maxMarks": <marks>
   }

   For TEXT/LONG_TEXT:
   {
     "type": "text",
     "maxMarks": <marks>,
     "keywords": ["keyword1", "keyword2"],
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
     "explanation": "..."
   }

7. subParts (ONLY if the part has subparts like (i), (ii), (iii))
   Each subpart MUST have:
   - subPartLabel: 'i', 'ii', 'iii', etc.
   - subPartText: full text of the subpart
   - marks: marks for this subpart
   - inputType: same options as parts
   - hasImage: true/false
   - markScheme: same structure as parts

IMPORTANT:
- ALWAYS provide ALL required fields (partLabel, partText, marks, inputType, markScheme)
- If a part has subparts, the parent part marks should be 0 or sum of subpart marks
- NEVER use 'undefined' or 'null' for required string fields
- For subparts, ALWAYS provide subPartLabel ('i', 'ii', 'iii') and subPartText

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

Parse ALL questions from the paper.`

  const result = await model.generateContent(prompt)

  // Better JSON parsing with error handling
  let parsed
  try {
    const responseText = result.response.text()
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
    console.error('JSON parse error:', error)
    throw new Error('Failed to parse Gemini response as JSON. Try running again.')
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

  console.log(`✅ Parsed ${questions.length} structured questions`)

  return questions
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
