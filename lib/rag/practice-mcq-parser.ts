import { GoogleGenerativeAI } from '@google/generative-ai'

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
  imageBoundingBox?: { x: number; y: number; width: number; height: number }
}

export async function parseMCQPaper(
  questionPaperPath: string,
  markSchemePath: string
): Promise<MCQQuestion[]> {
  console.log('📄 Extracting text from MCQ question paper...')
  const qpText = await extractTextFromPDF(questionPaperPath)

  console.log('📋 Extracting text from mark scheme...')
  const msText = await extractTextFromPDF(markSchemePath)

  console.log('🤖 Using Gemini to parse MCQ questions...')

  const model = genAI.getGenerativeModel({
    model: 'gemini-2.0-flash',
    generationConfig: {
      responseMimeType: 'application/json',
    },
  })

  const prompt = `You are parsing an A-Level Physics MCQ paper (Paper 1) and its mark scheme.

QUESTION PAPER TEXT:
${qpText.substring(0, 50000)}

MARK SCHEME TEXT:
${msText.substring(0, 20000)}

Extract ALL MCQ questions from this paper and return them as a JSON array.

For EACH question, extract:
1. questionNumber (integer, e.g., 1, 2, 3...)
2. questionText (the full question text, including any equations using LaTeX format)
3. optionA, optionB, optionC, optionD (the four answer choices)
4. correctOption (from mark scheme: 'A', 'B', 'C', or 'D')
5. explanation (if provided in mark scheme, otherwise null)
6. topic (classify as one of: Kinematics, Forces, Energy, Momentum, Circular Motion, Gravitation, Oscillations, Waves, Electricity, Magnetism, Nuclear Physics, Quantum Physics, or General)
7. difficulty ('easy', 'medium', or 'hard' based on concept complexity)
8. hasImage (true if the question references a diagram/figure/graph)

IMPORTANT FORMATTING:
- Use LaTeX notation for all mathematical expressions: $E = mc^2$, $\\frac{1}{2}mv^2$, etc.
- Use \\text{} for units: $v = 20 \\text{ m s}^{-1}$
- Preserve superscripts/subscripts: $R_1$, $x^2$
- Keep question text concise but complete

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
    }
  ]
}

Extract ALL questions from the paper (typically 40 questions).`

  const result = await model.generateContent(prompt)
  const parsed = JSON.parse(result.response.text())

  console.log(`✅ Parsed ${parsed.questions.length} MCQ questions`)

  return parsed.questions
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
