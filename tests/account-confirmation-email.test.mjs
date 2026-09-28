import assert from 'node:assert/strict'
import test from 'node:test'
import { buildAccountConfirmationEmail } from '../lib/account-confirmation.ts'

test('account confirmation email is branded and includes the verification link', () => {
  const link = 'https://feedback-deo.vercel.app/finish#oobCode=test'
  const email = buildAccountConfirmationEmail(link, 'The Commons Café')

  assert.equal(email.subject, 'Confirm your Feedback Deo account')
  assert.match(email.text, new RegExp(link.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&')))
  assert.match(email.text, /The Commons Café/)
  assert.match(email.html, /Account confirmation/)
  assert.match(email.html, /Confirm my account/)
  assert.match(email.html, /The Commons Café/)
})

test('account confirmation email escapes business names and links in HTML', () => {
  const email = buildAccountConfirmationEmail('https://example.com/?a=1&b=2', '<script>alert(1)</script>')

  assert.doesNotMatch(email.html, /<script>alert\(1\)<\/script>/)
  assert.match(email.html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/)
  assert.ok(email.html.includes('https://example.com/?a=1&amp;b=2'))
})
