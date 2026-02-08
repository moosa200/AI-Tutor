import 'dotenv/config'
import { Pinecone } from '@pinecone-database/pinecone'

const PINECONE_API_KEY = process.env.PINECONE_API_KEY!
const INDEX_NAME = 'physics-questions-gemini'
const DIMENSIONS = 3072

async function recreateIndex() {
  console.log('🔧 Recreating Pinecone index with correct dimensions...')

  const pc = new Pinecone({ apiKey: PINECONE_API_KEY })

  try {
    // Delete existing index
    console.log(`🗑️  Deleting existing index: ${INDEX_NAME}`)
    await pc.deleteIndex(INDEX_NAME)
    console.log('✅ Index deleted')

    // Wait for deletion to complete
    console.log('⏳ Waiting 10 seconds for deletion to complete...')
    await new Promise(resolve => setTimeout(resolve, 10000))

  } catch (error: any) {
    if (error.message?.includes('not found')) {
      console.log('ℹ️  Index does not exist, creating new one')
    } else {
      throw error
    }
  }

  // Create new index with correct dimensions
  console.log(`📦 Creating new index: ${INDEX_NAME} (${DIMENSIONS} dimensions)`)
  await pc.createIndex({
    name: INDEX_NAME,
    dimension: DIMENSIONS,
    metric: 'cosine',
    spec: {
      serverless: {
        cloud: 'aws',
        region: 'us-east-1',
      },
    },
  })

  console.log('✅ Index created successfully!')

  // Wait for index to be ready
  console.log('⏳ Waiting for index to be ready...')
  await new Promise(resolve => setTimeout(resolve, 20000))

  // Verify
  const indexes = await pc.listIndexes()
  const ourIndex = indexes.indexes?.find(idx => idx.name === INDEX_NAME)

  if (ourIndex) {
    console.log(`\n✨ Success! Index details:`)
    console.log(`   Name: ${ourIndex.name}`)
    console.log(`   Dimension: ${ourIndex.dimension}`)
    console.log(`   Host: ${ourIndex.host}`)
    console.log(`\n⚠️  Update your .env file with this host if different:`)
    console.log(`   PINECONE_HOST=${ourIndex.host}`)
  }
}

recreateIndex().catch(console.error)
