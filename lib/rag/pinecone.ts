import { Pinecone } from '@pinecone-database/pinecone'

let pineconeClient: Pinecone | null = null

export function getPineconeClient(): Pinecone {
  if (!pineconeClient) {
    pineconeClient = new Pinecone({
      apiKey: process.env.PINECONE_API_KEY!,
    })
  }
  return pineconeClient
}

export function getPineconeIndex() {
  const client = getPineconeClient()
  return client.index(process.env.PINECONE_INDEX || 'physics-questions')
}

export interface QuestionMetadata {
  year: number
  paper: string
  questionNumber: string
  topic: string
  text: string
  markScheme: string
  examinerRemarks?: string
  marks: number
  difficulty: string
}

// Upsert vectors to Pinecone
export async function upsertVectors(
  vectors: {
    id: string
    values: number[]
    metadata: QuestionMetadata
  }[]
) {
  const index = getPineconeIndex()

  // Pinecone recommends batches of 100
  const batchSize = 100
  for (let i = 0; i < vectors.length; i += batchSize) {
    const batch = vectors.slice(i, i + batchSize)
    await index.upsert(batch as any)
    console.log(`Upserted batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(vectors.length / batchSize)}`)
  }
}

// Search for similar questions
export async function searchSimilarQuestions(
  embedding: number[],
  topK: number = 5,
  filter?: Record<string, any>
) {
  const index = getPineconeIndex()

  const results = await index.query({
    vector: embedding,
    topK,
    includeMetadata: true,
    filter,
  })

  return results.matches || []
}
