import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function clearProblematicPapers() {
  console.log('🗑️  Clearing problematic papers from database...\n')

  const papers = ['Paper 22', 'Paper 31', 'Paper 53']

  for (const paper of papers) {
    const result = await prisma.question.deleteMany({
      where: {
        year: 2024,
        paper: paper,
      },
    })
    console.log(`   ✓ Deleted ${result.count} questions from ${paper}`)
  }

  console.log('\n✅ Done! Ready to re-ingest.')
}

clearProblematicPapers()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
