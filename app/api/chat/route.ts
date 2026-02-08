import { auth } from '@clerk/nextjs/server'
import { NextRequest } from 'next/server'
import { streamChatResponse } from '@/lib/gemini'
import { searchQuestions, formatSearchResultsForPrompt } from '@/lib/rag/search'

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth()

    if (!userId) {
      return new Response('Unauthorized', { status: 401 })
    }

    const { messages, useRAG = true } = await req.json()

    if (!messages || !Array.isArray(messages)) {
      return new Response('Invalid messages format', { status: 400 })
    }

    // Get the last user message for RAG search
    const lastUserMessage = [...messages].reverse().find(m => m.role === 'user')
    let context = ''

    if (useRAG && lastUserMessage) {
      try {
        // Search for relevant past paper questions
        const results = await searchQuestions(lastUserMessage.content, 3)
        context = formatSearchResultsForPrompt(results)
      } catch (error) {
        // RAG search failed, continue without context
        console.error('RAG search error:', error)
      }
    }

    // Stream response from Gemini
    const stream = streamChatResponse(messages, context || undefined)

    // Convert async generator to ReadableStream
    const encoder = new TextEncoder()

    const readableStream = new ReadableStream({
      async start(controller) {
        try {
          for await (const text of stream) {
            controller.enqueue(encoder.encode(text))
          }
          controller.close()
        } catch (error) {
          console.error('Stream error:', error)
          controller.error(error)
        }
      },
    })

    return new Response(readableStream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-cache',
      },
    })
  } catch (error) {
    console.error('Chat API error:', error)
    return new Response('Internal server error', { status: 500 })
  }
}
