import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// Cambridge 9702 Physics topics with AS/A2 levels
const TOPICS = [
  {
    name: 'General Physics',
    level: 'AS',
    description:
      'Physical quantities and units, measurement techniques, scalars and vectors',
  },
  {
    name: 'Mechanics',
    level: 'AS',
    description:
      'Kinematics, dynamics, forces, work/energy/power, momentum, density and pressure',
  },
  {
    name: 'Waves',
    level: 'AS',
    description:
      'Progressive waves, transverse and longitudinal, diffraction, interference, stationary waves, superposition',
  },
  {
    name: 'Electricity',
    level: 'AS',
    description:
      'Electric current, potential difference, resistance, DC circuits, Kirchhoff\'s laws',
  },
  {
    name: 'Modern Physics',
    level: 'AS',
    description: 'Quantum physics, photoelectric effect, wave-particle duality',
  },
  {
    name: 'Nuclear Physics',
    level: 'A2',
    description:
      'Radioactivity, nuclear reactions, nuclear energy, binding energy',
  },
  {
    name: 'Magnetism',
    level: 'A2',
    description:
      'Magnetic fields, electromagnetic induction, alternating currents',
  },
]

async function populateTopics() {
  console.log('📚 Populating Topic table...\n')

  // Create topics (upsert to avoid duplicates)
  for (const topic of TOPICS) {
    const created = await prisma.topic.upsert({
      where: { name: topic.name },
      update: { level: topic.level, description: topic.description },
      create: topic,
    })
    console.log(`   ✓ ${created.name} (${created.level})`)
  }

  // Link questions to topics
  console.log('\n🔗 Linking questions to topics...\n')

  const topics = await prisma.topic.findMany()
  const topicMap = new Map(topics.map((t) => [t.name, t.id]))

  const questions = await prisma.question.findMany({
    where: { topicId: null },
  })

  let linked = 0
  for (const q of questions) {
    const topicId = topicMap.get(q.topic)
    if (topicId) {
      await prisma.question.update({
        where: { id: q.id },
        data: { topicId },
      })
      linked++
    } else {
      console.log(`   ⚠️  No topic found for "${q.topic}" (Q${q.questionNumber})`)
    }
  }

  console.log(`   ✓ Linked ${linked} questions to topics`)

  // Summary
  console.log('\n📊 Final summary:')
  for (const topic of topics) {
    const count = await prisma.question.count({
      where: { topicId: topic.id },
    })
    console.log(`   ${topic.name} (${topic.level}): ${count} questions`)
  }

  console.log('\n✅ Done!')
}

populateTopics()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
