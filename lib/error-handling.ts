/**
 * Production-grade error handling and retry logic
 */

export class APIError extends Error {
  constructor(
    message: string,
    public statusCode: number = 500,
    public code?: string
  ) {
    super(message)
    this.name = 'APIError'
  }
}

export class RateLimitError extends APIError {
  constructor(message: string = 'Rate limit exceeded') {
    super(message, 429, 'RATE_LIMIT')
  }
}

export class ValidationError extends APIError {
  constructor(message: string) {
    super(message, 400, 'VALIDATION_ERROR')
  }
}

interface RetryOptions {
  maxRetries?: number
  delayMs?: number
  backoffMultiplier?: number
  shouldRetry?: (error: any) => boolean
}

/**
 * Retry function with exponential backoff
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxRetries = 3,
    delayMs = 1000,
    backoffMultiplier = 2,
    shouldRetry = (error) => {
      // Retry on network errors or 5xx errors
      if (error?.code === 'ECONNRESET' || error?.code === 'ETIMEDOUT') return true
      if (error?.statusCode >= 500) return true
      // Don't retry on 4xx errors (client errors)
      return false
    },
  } = options

  let lastError: any
  let delay = delayMs

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error

      if (attempt === maxRetries || !shouldRetry(error)) {
        throw error
      }

      console.warn(`Retry attempt ${attempt + 1}/${maxRetries} after ${delay}ms`, {
        error: error instanceof Error ? error.message : String(error),
      })

      await sleep(delay)
      delay *= backoffMultiplier
    }
  }

  throw lastError
}

/**
 * Sleep utility
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Sanitize error for client response
 */
export function sanitizeError(error: any): { message: string; code?: string } {
  if (error instanceof APIError) {
    return {
      message: error.message,
      code: error.code,
    }
  }

  // Don't leak internal errors to client
  console.error('Internal error:', error)
  return {
    message: 'An unexpected error occurred',
    code: 'INTERNAL_ERROR',
  }
}

/**
 * Timeout wrapper
 */
export async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  errorMessage: string = 'Operation timed out'
): Promise<T> {
  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new APIError(errorMessage, 408, 'TIMEOUT')), timeoutMs)
  )

  return Promise.race([promise, timeout])
}
