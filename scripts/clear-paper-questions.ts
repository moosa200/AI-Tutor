import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function clearPaperQuestions() {
  console.log('🗑️  Clearing questions for 2024 Paper 12...')

  const result = await prisma.question.deleteMany({
    where: {
      year: 2024,
      paper: 'Paper 12',
    },
  })

  console.log(`✅ Deleted ${result.count} questions`)
}

clearPaperQuestions()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
