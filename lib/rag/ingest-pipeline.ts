import fs from 'fs'
import path from 'path'
import { extractQuestionsFromPDF } from '../gemini-parser'
import {
  extractMarkSchemeFromPDF,
  mergeQuestionsWithMarkSchemes,
} from '../gemini-parser-markscheme'
import { generateEmbeddings } from './gemini-embeddings'
import { upsertVectors, QuestionMetadata } from './pinecone'
import { PrismaClient } from '@prisma/client'
import { cropAndSaveImage } from './pdf-image'

const prisma = new PrismaClient()

interface PaperFiles {
  year: number
  paper: string
  questionPaperPath: string
  markSchemePath: string
}

// Discover all paper PDFs in data/past-papers/
function discoverPapers(basePath: string): PaperFiles[] {
  const papers: PaperFiles[] = []

  if (!fs.existsSync(basePath)) {
    console.log(`📁 Creating ${basePath} directory...`)
    fs.mkdirSync(basePath, { recursive: true })
    return papers
  }

  const years = fs
    .readdirSync(basePath)
    .filter((f) => fs.statSync(path.join(basePath, f)).isDirectory())

  for (const yearStr of years) {
    const year = parseInt(yearStr)
    if (isNaN(year)) continue

    const yearPath = path.join(basePath, yearStr)
    const files = fs.readdirSync(yearPath)

    // Group files by paper number
    const paperGroups = new Map<
      string,
      { qp?: string; ms?: string; paper: string }
    >()

    for (const file of files) {
      if (!file.endsWith('.pdf')) continue

      // Parse filename: 9702_s24_qp_21.pdf or 9702_s24_ms_21.pdf
      const match = file.match(/9702_[smw]\d{2}_(qp|ms)_(\d{1,2})\.pdf/)
      if (!match) continue

      const [, type, paperNum] = match
      const paperKey = `Paper ${paperNum}`

      if (!paperGroups.has(paperKey)) {
        paperGroups.set(paperKey, { paper: paperKey })
      }

      const group = paperGroups.get(paperKey)!
      if (type === 'qp') {
        group.qp = path.join(yearPath, file)
      } else if (type === 'ms') {
        group.ms = path.join(yearPath, file)
      }
    }

    // Only add papers that have both QP and MS
    for (const [paperKey, group] of Array.from(paperGroups)) {
      if (group.qp && group.ms) {
        papers.push({
          year,
          paper: group.paper,
          questionPaperPath: group.qp,
          markSchemePath: group.ms,
        })
      } else {
        console.warn(
          `⚠️  Incomplete paper set for ${year} ${paperKey} - skipping`
        )
      }
    }
  }

  return papers.sort((a, b) => b.year - a.year || a.paper.localeCompare(b.paper))
}

// Check if question already exists in database
async function questionExists(
  year: number,
  paper: string,
  questionNumber: string
): Promise<boolean> {
  const existing = await prisma.question.findFirst({
    where: { year, paper, questionNumber },
  })
  return !!existing
}

// Ingest a single paper
export async function ingestPaper(paperFiles: PaperFiles) {
  const { year, paper, questionPaperPath, markSchemePath } = paperFiles

  console.log(`\n${'='.repeat(60)}`)
  console.log(`📚 Ingesting ${year} ${paper}`)
  console.log(`${'='.repeat(60)}`)

  try {
    // Step 1: Extract questions from QP
    console.log('\n📄 Step 1: Extracting questions from question paper...')
    const questions = await extractQuestionsFromPDF(questionPaperPath)
    
    console.log('⏳ Waiting 5 seconds...')
    await new Promise((resolve) => setTimeout(resolve, 5000))

    // Step 2: Extract mark schemes
    console.log('\n📋 Step 2: Extracting mark schemes...')
    const markSchemes = await extractMarkSchemeFromPDF(markSchemePath)

    console.log('⏳ Waiting 5 seconds...')
    await new Promise((resolve) => setTimeout(resolve, 5000))

    // Step 3: Merge
    console.log('\n🔗 Step 3: Merging questions with mark schemes...')
    const mergedQuestions = mergeQuestionsWithMarkSchemes(questions, markSchemes)

    console.log(
      `   Merged ${mergedQuestions.length} questions with mark schemes`
    )

    // Step 4: Filter out duplicates
    console.log('\n🔍 Step 4: Checking for duplicates in database...')
    const newQuestions = []
    for (const q of mergedQuestions) {
      const exists = await questionExists(year, paper, q.questionNumber)
      if (!exists) {
        newQuestions.push(q)
      } else {
        console.log(
          `   ⏭️  Skipping ${year} ${paper} Q${q.questionNumber} (already exists)`
        )
      }
    }

    if (newQuestions.length === 0) {
      console.log('\n✅ No new questions to ingest (all already in database)')
      return
    }

    console.log(`   Found ${newQuestions.length} new questions to ingest`)

    // Step 5: Save to database
    console.log('\n💾 Step 5: Saving to database...')
    const savedQuestions = []
    for (const q of newQuestions) {
      let imageUrl: string | null = null

      if (q.hasImage && q.figureBoundingBox && q.pageNumber) {
        console.log(`   🖼️  Cropping image for Q${q.questionNumber}...`)
        imageUrl = await cropAndSaveImage(
          questionPaperPath,
          q.pageNumber,
          q.figureBoundingBox,
          year,
          paper,
          q.questionNumber
        )
      }

      const saved = await prisma.question.create({
        data: {
          year,
          paper,
          questionNumber: q.questionNumber,
          topic: q.topic,
          text: q.text,
          markScheme: q.markScheme,
          examinerRemarks: q.examinerRemarks,
          marks: q.marks ?? 0,
          difficulty: q.difficulty,
          imageUrl,
        },
      })
      savedQuestions.push(saved)
      console.log(
        `   ✓ Saved Q${q.questionNumber} (${q.topic}, ${q.marks} marks)`
      )
    }

    // Step 6: Generate embeddings
    console.log('\n🧠 Step 6: Generating embeddings...')
    const texts = savedQuestions.map((q) => q.text)
    const embeddings = await generateEmbeddings(texts)
    console.log(`   Generated ${embeddings.length} embeddings`)

    // Step 7: Upload to Pinecone
    console.log('\n☁️  Step 7: Uploading to Pinecone...')
    const vectors = savedQuestions.map((q, idx) => ({
      id: q.id,
      values: embeddings[idx],
      metadata: {
        year: q.year,
        paper: q.paper,
        questionNumber: q.questionNumber,
        topic: q.topic,
        text: q.text,
        markScheme: q.markScheme,
        examinerRemarks: q.examinerRemarks || '',
        marks: q.marks,
        difficulty: q.difficulty,
        imageUrl: q.imageUrl || undefined,
      } as QuestionMetadata,
    }))

    await upsertVectors(vectors)

    console.log(
      `\n✅ Successfully ingested ${savedQuestions.length} questions from ${year} ${paper}`
    )
  } catch (error) {
    console.error(`\n❌ Error ingesting ${year} ${paper}:`, error)
    throw error
  }
}

// Main ingestion function
export async function ingestAllPapers(testMode = false) {
  const basePath = path.join(process.cwd(), 'data', 'past-papers')

  console.log('🚀 Starting past paper ingestion pipeline')
  console.log(`📁 Looking for papers in: ${basePath}`)

  const papers = discoverPapers(basePath)

  if (papers.length === 0) {
    console.log('\n⚠️  No papers found!')
    console.log('\nExpected structure:')
    console.log('data/past-papers/')
    console.log('  2024/')
    console.log('    9702_s24_qp_21.pdf')
    console.log('    9702_s24_ms_21.pdf')
    console.log('  2023/')
    console.log('    9702_s23_qp_42.pdf')
    console.log('    9702_s23_ms_42.pdf')
    return
  }

  console.log(`\n📚 Found ${papers.length} paper(s):`)
  papers.forEach((p) => {
    console.log(`   - ${p.year} ${p.paper}`)
  })

  // Test mode: process only first paper
  const papersToProcess = testMode ? papers.slice(0, 1) : papers

  if (testMode) {
    console.log('\n🧪 TEST MODE: Processing only first paper')
  }

  for (const paper of papersToProcess) {
    try {
      await ingestPaper(paper)

      console.log('⏳ Waiting 10 seconds to respect rate limits...')
      await new Promise((resolve) => setTimeout(resolve, 10000))
    } catch (error) {
      console.error(`Failed to ingest ${paper.year} ${paper.paper}`)
      if (testMode) {
        throw error // Stop on error in test mode
      }
      // Continue with next paper in production mode
    }
  }

  await prisma.$disconnect()
  console.log('\n🎉 Ingestion complete!')
}
