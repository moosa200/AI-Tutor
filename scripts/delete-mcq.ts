import 'dotenv/config'
import { PrismaClient, QuestionType } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🗑️  Deleting all MCQ questions...')
  
  const result = await prisma.question.deleteMany({
    where: { type: QuestionType.MCQ }
  })
  
  console.log(`✅ Deleted ${result.count} MCQ questions`)
  await prisma.$disconnect()
}

main().catch(console.error)
