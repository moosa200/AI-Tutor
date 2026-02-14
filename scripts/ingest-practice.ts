import 'dotenv/config'
import fs from 'fs'
import path from 'path'
import { PrismaClient, QuestionType, InputType } from '@prisma/client'
import { parseMCQPaper, MCQQuestion } from '../lib/rag/practice-mcq-parser'
import {
  parseStructuredPaper,
  StructuredQuestion,
} from '../lib/rag/practice-structured-parser'
import { extractAndUploadImage } from '../lib/rag/image-extraction'

const prisma = new PrismaClient()

interface PaperFiles {
  year: number
  paper: number
  paperType: 'MCQ' | 'STRUCTURED'
  questionPaperPath: string
  markSchemePath: string
}

// Discover papers from data/past-papers/
function discoverPapers(basePath: string): PaperFiles[] {
  const papers: PaperFiles[] = []

  if (!fs.existsSync(basePath)) {
    console.log(`📁 Directory not found: ${basePath}`)
    return papers
  }

  const years = fs
    .readdirSync(basePath)
    .filter((f) => fs.statSync(path.join(basePath, f)).isDirectory())

  for (const yearStr of years) {
    const yearPath = path.join(basePath, yearStr)
    const files = fs.readdirSync(yearPath)

    // Group by year + paper number (extracted from filename)
    const paperGroups = new Map<
      string,
      { qp?: string; ms?: string; year: number; paper: number }
    >()

    for (const file of files) {
      if (!file.endsWith('.pdf')) continue

      // Parse: 9702_s24_qp_21.pdf or 9702_s24_ms_21.pdf
      // Format: 9702_[session][year]_[type]_[paper].pdf
      const match = file.match(/9702_[smw](\d{2})_(qp|ms)_(\d{1,2})\.pdf/)
      if (!match) continue

      const [, yearSuffix, type, paperNumStr] = match
      const paperNum = parseInt(paperNumStr)

      // Convert 2-digit year to 4-digit (24 -> 2024, 23 -> 2023)
      const year = 2000 + parseInt(yearSuffix)

      // Use year + paper as key to group QP and MS together
      const groupKey = `${year}_${paperNumStr}`

      if (!paperGroups.has(groupKey)) {
        paperGroups.set(groupKey, { year, paper: paperNum })
      }

      const group = paperGroups.get(groupKey)!
      if (type === 'qp') {
        group.qp = path.join(yearPath, file)
      } else if (type === 'ms') {
        group.ms = path.join(yearPath, file)
      }
    }

    // Add complete paper sets
    for (const [groupKey, group] of Array.from(paperGroups)) {
      if (group.qp && group.ms) {
        // Paper 1 = MCQ, Paper 2/4 = Structured
        const paperType =
          group.paper === 1 || group.paper === 11 || group.paper === 12 || group.paper === 13
            ? 'MCQ'
            : 'STRUCTURED'

        papers.push({
          year: group.year,
          paper: group.paper,
          paperType,
          questionPaperPath: group.qp,
          markSchemePath: group.ms,
        })
      }
    }
  }

  return papers.sort((a, b) => b.year - a.year || a.paper - b.paper)
}

// Ingest MCQ paper
async function ingestMCQPaper(paperFiles: PaperFiles) {
  const { year, paper, questionPaperPath, markSchemePath } = paperFiles

  console.log(`\n${'='.repeat(60)}`)
  console.log(`📝 Ingesting MCQ: ${year} Paper ${paper}`)
  console.log(`${'='.repeat(60)}`)

  try {
    // Parse questions
    const questions = await parseMCQPaper(questionPaperPath, markSchemePath)

    console.log(`\n💾 Saving ${questions.length} MCQ questions to database...`)

    let savedCount = 0

    for (const q of questions) {
      // Check if exists
      const existing = await prisma.question.findFirst({
        where: {
          year,
          paper,
          questionNumber: q.questionNumber,
          type: QuestionType.MCQ,
        },
      })

      if (existing) {
        console.log(`   ⏭️  Q${q.questionNumber} already exists, skipping`)
        continue
      }

      // Extract and upload image if present
      let images = undefined
      if (q.hasImage && q.imageBoundingBox && q.pageNumber) {
        try {
          console.log(`   📸 Extracting image for Q${q.questionNumber}...`)
          const imageUrl = await extractAndUploadImage(
            questionPaperPath,
            q.pageNumber,
            q.imageBoundingBox,
            year,
            paper,
            `q${q.questionNumber}`
          )

          if (imageUrl) {
            images = [{ url: imageUrl }]
          }
        } catch (error) {
          console.warn(`   ⚠️  Failed to extract image for Q${q.questionNumber}:`, error)
          // Continue without image - don't block question creation
        }
      }

      // Create question
      await prisma.question.create({
        data: {
          year,
          paper,
          questionNumber: q.questionNumber,
          type: QuestionType.MCQ,
          totalMarks: 1, // MCQ is always 1 mark
          questionText: q.questionText,
          optionA: q.optionA,
          optionB: q.optionB,
          optionC: q.optionC,
          optionD: q.optionD,
          correctOption: q.correctOption,
          explanation: q.explanation,
          topic: q.topic,
          difficulty: q.difficulty,
          topics: [q.topic],
          syllabus: '9702',
          images,
          updatedAt: new Date(),
        },
      })

      savedCount++
      console.log(`   ✓ Created Q${q.questionNumber}`)
    }

    console.log(
      `\n✅ Successfully saved ${savedCount}/${questions.length} MCQ questions`
    )
  } catch (error) {
    console.error(`\n❌ Error ingesting MCQ paper:`, error)
    throw error
  }
}

// Ingest structured paper
async function ingestStructuredPaper(paperFiles: PaperFiles) {
  const { year, paper, questionPaperPath, markSchemePath } = paperFiles

  console.log(`\n${'='.repeat(60)}`)
  console.log(`📚 Ingesting Structured: ${year} Paper ${paper}`)
  console.log(`${'='.repeat(60)}`)

  try {
    // Parse questions
    const questions = await parseStructuredPaper(
      questionPaperPath,
      markSchemePath
    )

    console.log(`\n💾 Saving ${questions.length} structured questions...`)

    let savedCount = 0

    for (const q of questions) {
      // Check if exists
      const existing = await prisma.question.findFirst({
        where: {
          year,
          paper,
          questionNumber: q.questionNumber,
          type: QuestionType.STRUCTURED,
        },
      })

      if (existing) {
        console.log(`   ⏭️  Q${q.questionNumber} already exists, skipping`)
        continue
      }

      // Extract question-level image
      let questionImages = undefined
      if (q.hasImage && q.imageBoundingBox && q.pageNumber) {
        try {
          console.log(`   📸 Extracting question image for Q${q.questionNumber}...`)
          const imageUrl = await extractAndUploadImage(
            questionPaperPath,
            q.pageNumber,
            q.imageBoundingBox,
            year,
            paper,
            `q${q.questionNumber}`
          )
          if (imageUrl) {
            questionImages = [{ url: imageUrl }]
          }
        } catch (error) {
          console.warn(`   ⚠️  Failed to extract question image for Q${q.questionNumber}:`, error)
        }
      }

      // Extract part-level and subpart-level images
      const partsWithImages = await Promise.all(
        q.parts.map(async (part, partIdx) => {
          let partImages = undefined
          if (part.hasImage && part.imageBoundingBox && part.pageNumber) {
            try {
              console.log(`   📸 Extracting part image for Q${q.questionNumber}${part.partLabel}...`)
              const imageUrl = await extractAndUploadImage(
                questionPaperPath,
                part.pageNumber,
                part.imageBoundingBox,
                year,
                paper,
                `q${q.questionNumber}${part.partLabel}`
              )
              if (imageUrl) {
                partImages = [{ url: imageUrl }]
              }
            } catch (error) {
              console.warn(
                `   ⚠️  Failed to extract part image for Q${q.questionNumber}${part.partLabel}:`,
                error
              )
            }
          }

          // Extract subpart images
          let subPartsWithImages = undefined
          if (part.subParts) {
            subPartsWithImages = await Promise.all(
              part.subParts.map(async (subPart, subIdx) => {
                let subPartImages = undefined
                if (subPart.hasImage && subPart.imageBoundingBox && subPart.pageNumber) {
                  try {
                    console.log(
                      `   📸 Extracting subpart image for Q${q.questionNumber}${part.partLabel}${subPart.subPartLabel}...`
                    )
                    const imageUrl = await extractAndUploadImage(
                      questionPaperPath,
                      subPart.pageNumber,
                      subPart.imageBoundingBox,
                      year,
                      paper,
                      `q${q.questionNumber}${part.partLabel}${subPart.subPartLabel}`
                    )
                    if (imageUrl) {
                      subPartImages = [{ url: imageUrl }]
                    }
                  } catch (error) {
                    console.warn(
                      `   ⚠️  Failed to extract subpart image for Q${q.questionNumber}${part.partLabel}${subPart.subPartLabel}:`,
                      error
                    )
                  }
                }

                return {
                  subPartLabel: subPart.subPartLabel,
                  subPartText: subPart.subPartText,
                  marks: subPart.marks,
                  inputType: subPart.inputType as InputType,
                  markScheme: subPart.markScheme,
                  images: subPartImages,
                  order: subIdx + 1,
                  createdAt: new Date(),
                  updatedAt: new Date(),
                }
              })
            )
          }

          return {
            partLabel: part.partLabel,
            partText: part.partText,
            marks: part.subParts ? part.subParts.reduce((sum, sp) => sum + sp.marks, 0) : part.marks,
            inputType: part.inputType as InputType,
            markScheme: part.markScheme,
            images: partImages,
            order: partIdx + 1,
            createdAt: new Date(),
            updatedAt: new Date(),
            subParts: subPartsWithImages ? { create: subPartsWithImages } : undefined,
          }
        })
      )

      // Create question with parts
      await prisma.question.create({
        data: {
          year,
          paper,
          questionNumber: q.questionNumber,
          type: QuestionType.STRUCTURED,
          totalMarks: q.totalMarks,
          topic: q.topic,
          difficulty: q.difficulty,
          topics: [q.topic],
          syllabus: '9702',
          images: questionImages,
          updatedAt: new Date(),
          parts: {
            create: partsWithImages,
          },
        },
      })

      savedCount++
      console.log(`   ✓ Created Q${q.questionNumber} with ${q.parts.length} parts`)
    }

    console.log(
      `\n✅ Successfully saved ${savedCount}/${questions.length} structured questions`
    )
  } catch (error) {
    console.error(`\n❌ Error ingesting structured paper:`, error)
    throw error
  }
}

// Main function
async function main() {
  const basePath = path.join(process.cwd(), 'data', 'past-papers')
  const testMode = process.argv.includes('--test')
  const mcqOnly = process.argv.includes('--mcq-only')
  const structuredOnly = process.argv.includes('--structured-only')

  console.log('🚀 Phase 1 Practice Question Ingestion')
  console.log(`📁 Scanning: ${basePath}\n`)

  const papers = discoverPapers(basePath)

  if (papers.length === 0) {
    console.log('⚠️  No papers found!')
    return
  }

  // Filter by type if specified
  let papersToProcess = papers
  if (mcqOnly) {
    papersToProcess = papers.filter((p) => p.paperType === 'MCQ')
    console.log(`📝 MCQ-only mode: Processing ${papersToProcess.length} MCQ papers`)
  } else if (structuredOnly) {
    papersToProcess = papers.filter((p) => p.paperType === 'STRUCTURED')
    console.log(
      `📚 Structured-only mode: Processing ${papersToProcess.length} structured papers`
    )
  }

  // Test mode: only first paper
  if (testMode) {
    papersToProcess = papersToProcess.slice(0, 1)
    console.log(`🧪 TEST MODE: Processing only first paper\n`)
  }

  console.log(`📚 Found ${papersToProcess.length} paper(s) to process:`)
  papersToProcess.forEach((p) => {
    console.log(`   - ${p.year} Paper ${p.paper} (${p.paperType})`)
  })

  for (const paper of papersToProcess) {
    try {
      if (paper.paperType === 'MCQ') {
        await ingestMCQPaper(paper)
      } else {
        await ingestStructuredPaper(paper)
      }

      // Rate limiting
      console.log('\n⏳ Waiting 10 seconds...')
      await new Promise((resolve) => setTimeout(resolve, 10000))
    } catch (error) {
      console.error(`Failed to ingest ${paper.year} Paper ${paper.paper}`)
      if (testMode) throw error
    }
  }

  await prisma.$disconnect()
  console.log('\n🎉 Ingestion complete!')
}

main().catch((error) => {
  console.error('Fatal error:', error)
  process.exit(1)
})
