import { createHmac, timingSafeEqual } from 'node:crypto'

export type ReviewWidgetTheme = 'white' | 'dark'

const TOKEN_CONTEXT = 'feedback-deo:public-review-widget:v1:'
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/
const REVIEW_LIMITS = [4, 8, 12, 24] as const

export function createReviewWidgetToken(slug: string, secret: string): string {
  if (!slug || !secret) throw new Error('A workspace slug and signing secret are required.')
  return createHmac('sha256', secret).update(`${TOKEN_CONTEXT}${slug}`).digest('base64url')
}

export function verifyReviewWidgetToken(slug: string, token: string, secret: string): boolean {
  if (!slug || !secret || !TOKEN_PATTERN.test(token)) return false
  const expected = Buffer.from(createReviewWidgetToken(slug, secret))
  const received = Buffer.from(token)
  return expected.length === received.length && timingSafeEqual(expected, received)
}

export function getReviewWidgetTheme(value: unknown): ReviewWidgetTheme {
  return value === 'dark' ? 'dark' : 'white'
}

export function getReviewWidgetLimit(value: unknown): (typeof REVIEW_LIMITS)[number] {
  const limit = typeof value === 'number' ? value : Number(value)
  return REVIEW_LIMITS.includes(limit as (typeof REVIEW_LIMITS)[number])
    ? limit as (typeof REVIEW_LIMITS)[number]
    : 8
}
