import { GoogleGenerativeAI } from '@google/generative-ai'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)

// Gemini's embedding model - FREE tier (3072 dimensions)
const EMBEDDING_MODEL = 'gemini-embedding-001'

// Generate embeddings for a single text using Gemini
export async function generateEmbedding(text: string): Promise<number[]> {
  const model = genAI.getGenerativeModel({ model: EMBEDDING_MODEL })

  const result = await model.embedContent(text)
  return result.embedding.values
}

// Generate embeddings for multiple texts (batch)
export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  const model = genAI.getGenerativeModel({ model: EMBEDDING_MODEL })

  const embeddings: number[][] = []

  // Gemini embedContent supports batch but let's keep it simple for now
  for (const text of texts) {
    const result = await model.embedContent(text)
    embeddings.push(result.embedding.values)
  }

  return embeddings
}

// Get embedding dimensions (3072 for gemini-embedding-001)
export function getEmbeddingDimensions(): number {
  return 3072
}
