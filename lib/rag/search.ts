import { generateEmbedding } from './gemini-embeddings'
import { searchSimilarQuestions, QuestionMetadata } from './pinecone'

export interface SearchResult {
  id: string
  score: number
  metadata: QuestionMetadata
}

// Search for relevant questions based on a query
export async function searchQuestions(
  query: string,
  topK: number = 5,
  filters?: {
    year?: number
    paper?: string
    topic?: string
    difficulty?: string
  }
): Promise<SearchResult[]> {
  // Generate embedding for the query
  const embedding = await generateEmbedding(query)

  // Build Pinecone filter
  const filter: Record<string, any> = {}
  if (filters?.year) filter.year = filters.year
  if (filters?.paper) filter.paper = filters.paper
  if (filters?.topic) filter.topic = filters.topic
  if (filters?.difficulty) filter.difficulty = filters.difficulty

  // Search Pinecone
  const matches = await searchSimilarQuestions(
    embedding,
    topK,
    Object.keys(filter).length > 0 ? filter : undefined
  )

  return matches.map(match => ({
    id: match.id,
    score: match.score || 0,
    metadata: match.metadata as unknown as QuestionMetadata,
  }))
}

// Format search results for inclusion in prompts
export function formatSearchResultsForPrompt(results: SearchResult[]): string {
  if (results.length === 0) {
    return 'No relevant past paper questions found.'
  }

  return results
    .map((r, i) => {
      const m = r.metadata
      return `--- Question ${i + 1} (${m.year} ${m.paper} Q${m.questionNumber}, ${m.topic}, ${m.marks} marks) ---
Question: ${m.text}

Mark Scheme: ${m.markScheme}
${m.examinerRemarks ? `\nExaminer Remarks: ${m.examinerRemarks}` : ''}`
    })
    .join('\n\n')
}
