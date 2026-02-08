import { Pinecone } from '@pinecone-database/pinecone'
import { config } from 'dotenv'

config()

const pc = new Pinecone({ apiKey: process.env.PINECONE_API_KEY })
const indexName = 'physics-questions-gemini'

try {
  const index = await pc.describeIndex(indexName)
  console.log(`\n✅ Index ready: ${indexName}`)
  console.log(`\n📋 Add these to your .env:\n`)
  console.log(`PINECONE_INDEX=${indexName}`)
  console.log(`PINECONE_HOST=${index.host}`)
} catch (error) {
  console.error('❌ Error:', error.message)
}
