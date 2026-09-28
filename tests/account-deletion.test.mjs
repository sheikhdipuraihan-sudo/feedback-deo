import test from 'node:test'
import assert from 'node:assert/strict'
import { ACCOUNT_DELETION_PHRASE, isRecentReauthentication, validateAccountDeletionInput } from '../lib/account-deletion.ts'

test('requires every account deletion confirmation field', () => {
  assert.equal(validateAccountDeletionInput({ password: '', email: '', confirmationPhrase: '', acknowledged: false }, 'owner@example.com'), 'Enter your current password.')
  assert.equal(validateAccountDeletionInput({ password: 'secret', email: 'owner@example.com', confirmationPhrase: ACCOUNT_DELETION_PHRASE, acknowledged: true }, 'OWNER@example.com'), null)
})

test('rejects near-miss email and confirmation phrase values', () => {
  assert.match(validateAccountDeletionInput({ password: 'secret', email: 'other@example.com', confirmationPhrase: ACCOUNT_DELETION_PHRASE, acknowledged: true }, 'owner@example.com'), /exact email/i)
  assert.match(validateAccountDeletionInput({ password: 'secret', email: 'owner@example.com', confirmationPhrase: 'delete account', acknowledged: true }, 'owner@example.com'), /Type DELETE ACCOUNT/i)
})

test('accepts only recently reauthenticated sessions', () => {
  const now = 1_000_000
  assert.equal(isRecentReauthentication(now - 60, now), true)
  assert.equal(isRecentReauthentication(now - 601, now), false)
  assert.equal(isRecentReauthentication(undefined, now), false)
})
