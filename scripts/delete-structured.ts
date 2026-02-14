import 'dotenv/config'
import { PrismaClient, QuestionType } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🗑️  Deleting all STRUCTURED questions...')

  const result = await prisma.question.deleteMany({
    where: {
      type: QuestionType.STRUCTURED,
    },
  })

  console.log(`✅ Deleted ${result.count} structured questions`)

  await prisma.$disconnect()
}

main().catch((error) => {
  console.error('Error:', error)
  process.exit(1)
})
