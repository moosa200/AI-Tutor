import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const year = parseInt(process.argv[2])
  const paper = parseInt(process.argv[3])

  if (!year || !paper) {
    console.error('Usage: npx tsx scripts/delete-paper.ts <year> <paper>')
    console.error('Example: npx tsx scripts/delete-paper.ts 2025 22')
    process.exit(1)
  }

  console.log(`🗑️  Deleting questions from ${year} Paper ${paper}...`)

  const result = await prisma.question.deleteMany({
    where: {
      year,
      paper,
    },
  })

  console.log(`✅ Deleted ${result.count} questions`)

  await prisma.$disconnect()
}

main().catch((error) => {
  console.error('Error:', error)
  process.exit(1)
})
