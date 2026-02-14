/**
 * Input validation utilities
 */

import { ValidationError } from './error-handling'

/**
 * Sanitize text input (prevent XSS, remove harmful characters)
 */
export function sanitizeText(text: string): string {
  if (typeof text !== 'string') {
    throw new ValidationError('Input must be a string')
  }

  // Remove null bytes
  let sanitized = text.replace(/\0/g, '')

  // Trim whitespace
  sanitized = sanitized.trim()

  return sanitized
}

/**
 * Validate message content
 */
export function validateMessage(content: string): string {
  const sanitized = sanitizeText(content)

  if (sanitized.length === 0) {
    throw new ValidationError('Message cannot be empty')
  }

  if (sanitized.length > 10000) {
    throw new ValidationError('Message too long (max 10,000 characters)')
  }

  return sanitized
}

/**
 * Validate student answer
 */
export function validateStudentAnswer(answer: string): string {
  const sanitized = sanitizeText(answer)

  if (sanitized.length === 0) {
    throw new ValidationError('Answer cannot be empty')
  }

  if (sanitized.length > 5000) {
    throw new ValidationError('Answer too long (max 5,000 characters)')
  }

  return sanitized
}

/**
 * Validate chat messages array
 */
export function validateMessages(
  messages: any[]
): { role: 'user' | 'assistant'; content: string }[] {
  if (!Array.isArray(messages)) {
    throw new ValidationError('Messages must be an array')
  }

  if (messages.length === 0) {
    throw new ValidationError('Messages array cannot be empty')
  }

  if (messages.length > 50) {
    throw new ValidationError('Too many messages (max 50)')
  }

  return messages.map((msg, index) => {
    if (!msg || typeof msg !== 'object') {
      throw new ValidationError(`Invalid message at index ${index}`)
    }

    if (msg.role !== 'user' && msg.role !== 'assistant') {
      throw new ValidationError(`Invalid role at index ${index}: ${msg.role}`)
    }

    if (typeof msg.content !== 'string') {
      throw new ValidationError(`Invalid content at index ${index}`)
    }

    return {
      role: msg.role,
      content: validateMessage(msg.content),
    }
  })
}

/**
 * Validate question ID
 */
export function validateQuestionId(id: any): string {
  if (typeof id !== 'string') {
    throw new ValidationError('Question ID must be a string')
  }

  // Basic CUID validation (starts with 'c', alphanumeric)
  if (!/^c[a-z0-9]{24}$/.test(id)) {
    throw new ValidationError('Invalid question ID format')
  }

  return id
}

/**
 * Validate pagination params
 */
export function validatePagination(params: {
  page?: any
  limit?: any
}): { page: number; limit: number } {
  let page = 1
  let limit = 10

  if (params.page !== undefined) {
    page = parseInt(String(params.page), 10)
    if (isNaN(page) || page < 1) {
      throw new ValidationError('Page must be a positive integer')
    }
  }

  if (params.limit !== undefined) {
    limit = parseInt(String(params.limit), 10)
    if (isNaN(limit) || limit < 1 || limit > 100) {
      throw new ValidationError('Limit must be between 1 and 100')
    }
  }

  return { page, limit }
}

/**
 * Validate search query
 */
export function validateSearchQuery(query: any): string {
  if (typeof query !== 'string') {
    throw new ValidationError('Search query must be a string')
  }

  const sanitized = sanitizeText(query)

  if (sanitized.length < 3) {
    throw new ValidationError('Search query must be at least 3 characters')
  }

  if (sanitized.length > 500) {
    throw new ValidationError('Search query too long (max 500 characters)')
  }

  return sanitized
}
