import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { streamChatResponse } from '@/lib/gemini'
import { searchQuestions, formatSearchResultsForPrompt } from '@/lib/rag/search'
import { rateLimit, RATE_LIMITS } from '@/lib/rate-limit'
import { validateMessages } from '@/lib/validation'
import { sanitizeError, withTimeout } from '@/lib/error-handling'
import { getOrCreateUser, logEvent } from '@/lib/events'

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth()

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Rate limiting: 30 requests per minute per user
    try {
      rateLimit(userId, RATE_LIMITS.CHAT)
    } catch (error) {
      const sanitized = sanitizeError(error)
      return NextResponse.json(
        { error: sanitized.message },
        { status: 429 }
      )
    }

    const body = await req.json()
    const { messages: rawMessages, useRAG = true } = body

    // Validate and sanitize messages
    let messages
    try {
      messages = validateMessages(rawMessages)
    } catch (error) {
      const sanitized = sanitizeError(error)
      return NextResponse.json(
        { error: sanitized.message },
        { status: 400 }
      )
    }

    // Log chat event
    const user = await getOrCreateUser(userId)
    logEvent(user.id, 'chat_message')

    // Get the last user message for RAG search
    const lastUserMessage = [...messages].reverse().find(m => m.role === 'user')
    let context = ''

    if (useRAG && lastUserMessage) {
      try {
        // Search for relevant past paper questions with timeout
        const results = await withTimeout(
          searchQuestions(lastUserMessage.content, 3),
          5000, // 5 second timeout
          'RAG search timed out'
        )
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
          const sanitized = sanitizeError(error)
          controller.enqueue(
            encoder.encode(`\n\n[Error: ${sanitized.message}]`)
          )
          controller.close()
        }
      },
    })

    return new Response(readableStream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-cache',
        'X-RateLimit-Limit': String(RATE_LIMITS.CHAT.maxRequests),
        'X-RateLimit-Window': String(RATE_LIMITS.CHAT.windowMs),
      },
    })
  } catch (error) {
    console.error('Chat API error:', error)
    const sanitized = sanitizeError(error)
    return NextResponse.json(
      { error: sanitized.message },
      { status: 500 }
    )
  }
}
