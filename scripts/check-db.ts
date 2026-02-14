import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const totalCount = await prisma.question.count()
  const mcqCount = await prisma.question.count({ where: { type: 'MCQ' } })
  const structuredCount = await prisma.question.count({ where: { type: 'STRUCTURED' } })

  console.log('📊 Database Summary:')
  console.log(`   Total questions: ${totalCount}`)
  console.log(`   MCQ: ${mcqCount}`)
  console.log(`   Structured: ${structuredCount}`)

  if (structuredCount > 0) {
    const sample = await prisma.question.findFirst({
      where: { type: 'STRUCTURED' },
      include: { parts: true }
    })
    console.log('\n📝 Sample Structured Question:')
    console.log(`   Q${sample?.questionNumber} - Paper ${sample?.paper} (${sample?.year})`)
    console.log(`   Images: ${JSON.stringify(sample?.images)}`)
    console.log(`   Parts: ${sample?.parts.length}`)
    if (sample?.parts[0]) {
      console.log(`   First part text: "${sample.parts[0].partText.substring(0, 100)}..."`)
    }
  }

  await prisma.$disconnect()
}

main().catch(console.error)
