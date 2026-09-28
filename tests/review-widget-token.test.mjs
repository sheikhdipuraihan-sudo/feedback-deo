import assert from 'node:assert/strict'
import test from 'node:test'
import { createReviewWidgetToken, getReviewWidgetLimit, getReviewWidgetTheme, verifyReviewWidgetToken } from '../lib/embed/review-widget.ts'

const secret = 'test-widget-signing-secret-with-adequate-entropy'

test('review widget tokens are URL-safe and tied to both the slug and server secret', () => {
  const token = createReviewWidgetToken('northwind-store', secret)
  assert.match(token, /^[A-Za-z0-9_-]{43}$/)
  assert.equal(verifyReviewWidgetToken('northwind-store', token, secret), true)
  assert.equal(verifyReviewWidgetToken('another-store', token, secret), false)
  assert.equal(verifyReviewWidgetToken('northwind-store', token, 'different-secret'), false)
})

test('malformed public widget tokens fail closed', () => {
  assert.equal(verifyReviewWidgetToken('northwind-store', '', secret), false)
  assert.equal(verifyReviewWidgetToken('northwind-store', 'not-a-token', secret), false)
})

test('the public widget only accepts the White and Dark themes', () => {
  assert.equal(getReviewWidgetTheme('white'), 'white')
  assert.equal(getReviewWidgetTheme('dark'), 'dark')
  assert.equal(getReviewWidgetTheme('brand-injection'), 'white')
})

test('review limits are restricted to the published options', () => {
  assert.equal(getReviewWidgetLimit('4'), 4)
  assert.equal(getReviewWidgetLimit('24'), 24)
  assert.equal(getReviewWidgetLimit('999'), 8)
  assert.equal(getReviewWidgetLimit('8<script>'), 8)
})
