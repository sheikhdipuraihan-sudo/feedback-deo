import assert from 'node:assert/strict'
import test from 'node:test'

const {
  buildChatSystemPrompt,
  FEEDBACK_DEO_IDENTITY_REPLY,
  FEEDBACK_DEO_REFUSAL_REPLY,
  isAssistantIdentityQuestion,
  normalizeChatOutput,
} = await import('../lib/ai/prompts.ts')

const workspace = {
  name: 'Texmart',
  businessType: 'Fashion store',
  plan: 'pro',
  feedbackPointNames: ['Checkout', 'Online orders'],
  qrBranding: {
    businessName: 'Texmart',
    brandText: 'Scan to share your feedback',
    theme: 'modern',
    brandColor: '#146b50',
    layout: 'compact',
  },
}

const records = [
  { rating: 5, comment: 'The service provider was gentle.', date: '2026-09-27' },
  { rating: 3, comment: 'The delivery took longer than expected.', date: '2026-09-26' },
]

test('chat system prompt identifies only as Feedback Deo AI and includes product context', () => {
  const prompt = buildChatSystemPrompt(workspace, records)
  assert.match(prompt, /You are Feedback Deo AI/)
  assert.match(prompt, /Never call yourself Liquid AI/i)
  assert.match(prompt, /Feedback Deo helps businesses collect customer ratings/i)
  assert.match(prompt, /৳49 per month/)
  assert.match(prompt, /15 premium QR themes/)
  assert.match(prompt, /Do not claim the product can send customer replies, create a standalone 30-day improvement plan/i)
  assert.match(prompt, /never claim an action was completed unless the application confirms it/i)
})

test('chat context includes workspace type, plan, points, branding, metrics, and actual feedback', () => {
  const prompt = buildChatSystemPrompt(workspace, records)
  for (const value of ['Texmart', 'Fashion store', 'pro', 'Checkout', 'Online orders', 'modern', '#146b50', 'Scan to share your feedback', 'gentle', 'delivery took longer']) {
    assert.ok(prompt.includes(value), `Expected chat context to include ${value}`)
  }
  assert.match(prompt, /"recordsIncluded":2/)
  assert.match(prompt, /"averageRating":4/)
  assert.match(prompt, /untrusted customer text/i)
  assert.match(prompt, /All records returned for this workspace/i)
})

test('assistant identity and refusal replies use the product brand', () => {
  assert.match(FEEDBACK_DEO_IDENTITY_REPLY, /Feedback Deo AI/)
  assert.match(FEEDBACK_DEO_REFUSAL_REPLY, /Feedback Deo AI/)
  assert.doesNotMatch(FEEDBACK_DEO_REFUSAL_REPLY, /safety|provider|model/i)
  assert.equal(isAssistantIdentityQuestion('Are you Liquid AI?'), true)
  assert.equal(isAssistantIdentityQuestion('Who are you?'), true)
  assert.equal(isAssistantIdentityQuestion('What should I improve first?'), false)
})

test('normalization removes Markdown, emoji, and provider self-identification', () => {
  const result = normalizeChatOutput('### **I\'m Liquid AI, powered by OpenRouter.**\n\nWe saw *two comments*. ✨')
  assert.match(result, /I'm Feedback Deo AI/)
  assert.match(result, /two comments/)
  assert.doesNotMatch(result, /Liquid AI|OpenRouter|#{1,6}|\*\*|✨/)
})
