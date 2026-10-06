import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto'

export const REFERRAL_COOKIE = 'feedback_deo_referral'
export const REFERRAL_DEVICE_COOKIE = 'feedback_deo_referral_device'

function secret() {
  const value = process.env.SUPABASE_JWT_SECRET
  if (!value) throw new Error('SUPABASE_JWT_SECRET is not configured.')
  return value
}

export function normalizeReferralCode(value: string) {
  return value.trim().toUpperCase()
}

export function isValidReferralCode(value: string) {
  return /^[A-F0-9]{16}$/.test(value)
}

function hmac(value: string) {
  return createHmac('sha256', secret()).update(value).digest('base64url')
}

export function signReferralCookie(code: string) {
  const normalized = normalizeReferralCode(code)
  if (!isValidReferralCode(normalized)) throw new Error('Invalid referral code.')
  return `${normalized}.${hmac(`referral:${normalized}`)}`
}

export function verifyReferralCookie(value: string | undefined) {
  if (!value) return null
  const [code, signature, extra] = value.split('.')
  if (extra !== undefined || !code || !signature || !isValidReferralCode(code)) return null
  const expected = Buffer.from(hmac(`referral:${code}`), 'base64url')
  const received = Buffer.from(signature, 'base64url')
  if (received.length !== expected.length || !timingSafeEqual(received, expected)) return null
  return code
}

export function createReferralDeviceToken() {
  return randomBytes(32).toString('base64url')
}

export function signReferralDeviceCookie(token: string) {
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) throw new Error('Invalid referral device token.')
  return `${token}.${hmac(`referral-device:${token}`)}`
}

export function verifyReferralDeviceCookie(value: string | undefined) {
  if (!value) return null
  const [token, signature, extra] = value.split('.')
  if (extra !== undefined || !token || !signature || !/^[A-Za-z0-9_-]{43}$/.test(token)) return null
  const expected = Buffer.from(hmac(`referral-device:${token}`), 'base64url')
  const received = Buffer.from(signature, 'base64url')
  if (received.length !== expected.length || !timingSafeEqual(received, expected)) return null
  return token
}

export function hashReferralDeviceToken(token: string) {
  return createHmac('sha256', secret()).update(`referral-device-id:${token}`).digest('hex')
}
