/**
 * Simple in-memory rate limiter for API endpoints
 * For production, consider Redis-based rate limiting
 */

import { RateLimitError } from './error-handling'

interface RateLimitConfig {
  windowMs: number // Time window in milliseconds
  maxRequests: number // Max requests per window
}

interface RateLimitEntry {
  count: number
  resetTime: number
}

const rateLimitStore = new Map<string, RateLimitEntry>()

// Clean up old entries every 5 minutes
setInterval(() => {
  const now = Date.now()
  for (const [key, entry] of rateLimitStore.entries()) {
    if (entry.resetTime < now) {
      rateLimitStore.delete(key)
    }
  }
}, 5 * 60 * 1000)

/**
 * Rate limit checker
 */
export function checkRateLimit(
  identifier: string,
  config: RateLimitConfig
): { allowed: boolean; remaining: number; resetTime: number } {
  const now = Date.now()
  const entry = rateLimitStore.get(identifier)

  if (!entry || entry.resetTime < now) {
    // New window
    const resetTime = now + config.windowMs
    rateLimitStore.set(identifier, {
      count: 1,
      resetTime,
    })
    return {
      allowed: true,
      remaining: config.maxRequests - 1,
      resetTime,
    }
  }

  if (entry.count >= config.maxRequests) {
    // Rate limit exceeded
    return {
      allowed: false,
      remaining: 0,
      resetTime: entry.resetTime,
    }
  }

  // Increment count
  entry.count++
  return {
    allowed: true,
    remaining: config.maxRequests - entry.count,
    resetTime: entry.resetTime,
  }
}

/**
 * Middleware-style rate limiter
 */
export function rateLimit(identifier: string, config: RateLimitConfig): void {
  const result = checkRateLimit(identifier, config)

  if (!result.allowed) {
    const resetIn = Math.ceil((result.resetTime - Date.now()) / 1000)
    throw new RateLimitError(
      `Rate limit exceeded. Try again in ${resetIn} seconds.`
    )
  }
}

/**
 * Preset rate limit configs
 */
export const RATE_LIMITS = {
  // Chat API: 30 requests per minute
  CHAT: {
    windowMs: 60 * 1000,
    maxRequests: 30,
  },
  // Practice submit: 60 requests per hour
  PRACTICE: {
    windowMs: 60 * 60 * 1000,
    maxRequests: 60,
  },
  // RAG search: 100 requests per minute
  RAG: {
    windowMs: 60 * 1000,
    maxRequests: 100,
  },
}
