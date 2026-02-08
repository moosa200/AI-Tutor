import { Pinecone } from '@pinecone-database/pinecone'
import { config } from 'dotenv'

config()

const pc = new Pinecone({ apiKey: process.env.PINECONE_API_KEY })
const newIndexName = 'physics-questions-gemini'

console.log('🔧 Creating new Pinecone index for Gemini embeddings...')
console.log(`📛 Index name: ${newIndexName}`)
console.log(`📐 Dimensions: 768 (Gemini text-embedding-004)`)
console.log(`📊 Metric: cosine`)
console.log(`☁️  Cloud: AWS us-east-1`)

try {
  await pc.createIndex({
    name: newIndexName,
    dimension: 768,
    metric: 'cosine',
    spec: {
      serverless: {
        cloud: 'aws',
        region: 'us-east-1',
      },
    },
  })

  console.log('\n✅ Index created successfully!')
  console.log('\n📝 Next steps:')
  console.log('1. Update your .env file:')
  console.log(`   PINECONE_INDEX=${newIndexName}`)
  console.log('2. Get the index host:')
  console.log('   - Go to https://app.pinecone.io/')
  console.log(`   - Find index "${newIndexName}"`)
  console.log('   - Copy the host URL')
  console.log('   - Update PINECONE_HOST in .env')
  console.log('3. Run: npm run ingest:test')
} catch (error) {
  if (error.message.includes('already exists')) {
    console.log(`\n⚠️  Index "${newIndexName}" already exists`)
    console.log('You can use it directly or delete it first in Pinecone console')
  } else {
    console.error('\n❌ Error creating index:', error.message)
  }
}
