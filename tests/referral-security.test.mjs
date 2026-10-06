import assert from 'node:assert/strict'
import { test } from 'node:test'
import { hasProAccess } from '../lib/pro-access.ts'
import {
  createReferralDeviceToken,
  hashReferralDeviceToken,
  signReferralCookie,
  signReferralDeviceCookie,
  verifyReferralCookie,
  verifyReferralDeviceCookie,
} from '../lib/referral-security.ts'

process.env.SUPABASE_JWT_SECRET ||= 'test-only-referral-signing-secret-at-least-32-bytes'

const NOW = Date.parse('2026-10-06T12:00:00.000Z')

test('paid Pro remains active; an unexpired referral month grants Pro only until expiry', () => {
  assert.equal(hasProAccess({ plan: 'pro', referral_pro_until: null }, NOW), true)
  assert.equal(hasProAccess({ plan: 'free', referral_pro_until: '2026-10-07T00:00:00.000Z' }, NOW), true)
  assert.equal(hasProAccess({ plan: 'free', referral_pro_until: '2026-10-06T12:00:00.000Z' }, NOW), false)
  assert.equal(hasProAccess({ plan: 'free', referral_pro_until: 'not-a-date' }, NOW), false)
})

test('referral attribution cookies are signed and tampering is rejected', () => {
  const code = '0123456789ABCDEF'
  const cookie = signReferralCookie(code)
  assert.equal(verifyReferralCookie(cookie), code)
  assert.equal(verifyReferralCookie(`${cookie.slice(0, -1)}x`), null)
  assert.equal(verifyReferralCookie('not-a-code.signature'), null)
  assert.equal(signReferralCookie(code.toLowerCase()).split('.')[0], code)
})

test('device tokens are signed, validated, and stored as a keyed hash', () => {
  const token = createReferralDeviceToken()
  const cookie = signReferralDeviceCookie(token)
  assert.equal(verifyReferralDeviceCookie(cookie), token)
  assert.equal(verifyReferralDeviceCookie(`${cookie}.extra`), null)
  assert.equal(hashReferralDeviceToken(token).length, 64)
  assert.match(hashReferralDeviceToken(token), /^[a-f0-9]{64}$/)
})
