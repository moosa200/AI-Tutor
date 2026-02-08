import { Pinecone } from '@pinecone-database/pinecone'
import { config } from 'dotenv'

config()

const pc = new Pinecone({ apiKey: process.env.PINECONE_API_KEY })
const indexName = process.env.PINECONE_INDEX || 'physics-questions'

try {
  const index = await pc.describeIndex(indexName)
  console.log(`✅ Index: ${indexName}`)
  console.log(`📐 Dimensions: ${index.dimension}`)
  console.log(`📊 Total vectors: ${index.recordCount || 0}`)
  console.log(`🔧 Metric: ${index.metric}`)
} catch (error) {
  console.error('❌ Error:', error.message)
}
