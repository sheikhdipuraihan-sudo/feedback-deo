import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildResetEmail,
  createResetLink,
  createResetToken,
  hashResetToken,
  PASSWORD_RESET_BASE_URL,
  RESET_LINK_TTL_MINUTES,
} from '../lib/password-reset.ts'

test('reset tokens are unique, 256-bit, and URL-safe', () => {
  const first = createResetToken()
  const second = createResetToken()
  assert.match(first, /^[A-Za-z0-9_-]{43}$/)
  assert.match(second, /^[A-Za-z0-9_-]{43}$/)
  assert.notEqual(first, second)
})

test('token hash is deterministic, secret-keyed, and changes with the token', () => {
  const priorTokenSecret = process.env.PASSWORD_RESET_TOKEN_SECRET
  const priorOtpSecret = process.env.PASSWORD_RESET_OTP_SECRET
  process.env.PASSWORD_RESET_TOKEN_SECRET = 'test-only-reset-secret'
  delete process.env.PASSWORD_RESET_OTP_SECRET
  try {
    const hash = hashResetToken('A'.repeat(43))
    assert.equal(hash, hashResetToken('A'.repeat(43)))
    assert.notEqual(hash, hashResetToken('B'.repeat(43)))
    process.env.PASSWORD_RESET_TOKEN_SECRET = 'rotated-test-secret'
    assert.notEqual(hash, hashResetToken('A'.repeat(43)))
  } finally {
    if (priorTokenSecret === undefined) delete process.env.PASSWORD_RESET_TOKEN_SECRET
    else process.env.PASSWORD_RESET_TOKEN_SECRET = priorTokenSecret
    if (priorOtpSecret === undefined) delete process.env.PASSWORD_RESET_OTP_SECRET
    else process.env.PASSWORD_RESET_OTP_SECRET = priorOtpSecret
  }
})

test('reset link uses the requested production origin and keeps the token in the fragment', () => {
  const token = createResetToken()
  const link = new URL(createResetLink(token))
  assert.equal(PASSWORD_RESET_BASE_URL, 'https://feedback-deo.vercel.app')
  assert.equal(link.origin, 'https://feedback-deo.vercel.app')
  assert.equal(link.pathname, '/reset-password')
  assert.equal(link.search, '')
  assert.equal(new URLSearchParams(link.hash.slice(1)).get('token'), token)
})

test('reset email is branded, link-based, one-time, and expires in ten minutes', () => {
  const link = createResetLink(createResetToken())
  const email = buildResetEmail(link)
  assert.equal(email.subject, 'Reset your Feedback Deo password')
  assert.match(email.text, new RegExp(link.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
  assert.match(email.html, /Reset password/)
  assert.match(email.html, /only be used once/)
  assert.match(email.html, new RegExp(`${RESET_LINK_TTL_MINUTES} minutes`))
  assert.doesNotMatch(email.text, /six-digit|reset code|one-time code/i)
})
