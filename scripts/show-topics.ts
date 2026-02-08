import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function showTopics() {
  const questions = await prisma.question.findMany({
    select: {
      year: true,
      paper: true,
      questionNumber: true,
      topic: true,
      marks: true,
      difficulty: true,
    },
    orderBy: [{ paper: 'asc' }, { questionNumber: 'asc' }],
  })

  console.log(`\n📊 Total questions in database: ${questions.length}\n`)

  // Group by topic
  const byTopic: Record<string, number> = {}
  questions.forEach((q) => {
    byTopic[q.topic] = (byTopic[q.topic] || 0) + 1
  })

  console.log('📋 Questions by topic:')
  Object.entries(byTopic)
    .sort((a, b) => b[1] - a[1])
    .forEach(([topic, count]) => {
      console.log(`   ${topic}: ${count} questions`)
    })

  // Group by paper
  const byPaper: Record<string, number> = {}
  questions.forEach((q) => {
    byPaper[q.paper] = (byPaper[q.paper] || 0) + 1
  })

  console.log('\n📄 Questions by paper:')
  Object.entries(byPaper)
    .sort()
    .forEach(([paper, count]) => {
      console.log(`   ${paper}: ${count} questions`)
    })

  // Group by difficulty
  const byDifficulty: Record<string, number> = {}
  questions.forEach((q) => {
    byDifficulty[q.difficulty] = (byDifficulty[q.difficulty] || 0) + 1
  })

  console.log('\n🎯 Questions by difficulty:')
  Object.entries(byDifficulty).forEach(([diff, count]) => {
    console.log(`   ${diff}: ${count} questions`)
  })

  // Show a few examples per topic
  console.log('\n📝 Sample questions per topic:')
  const topics = [...new Set(questions.map((q) => q.topic))]
  for (const topic of topics.sort()) {
    const sample = questions.find((q) => q.topic === topic && q.marks > 0)
    if (sample) {
      console.log(
        `   ${topic}: ${sample.paper} Q${sample.questionNumber} (${sample.marks} marks)`
      )
    }
  }
}

showTopics()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
