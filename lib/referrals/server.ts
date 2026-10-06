import { randomBytes } from 'node:crypto'
import { cookies } from 'next/headers'
import { getAuthAdminClient, normalizeEmail } from '@/lib/auth/server'
import {
  REFERRAL_COOKIE,
  REFERRAL_DEVICE_COOKIE,
  hashReferralDeviceToken,
  signReferralDeviceCookie,
  verifyReferralCookie,
  verifyReferralDeviceCookie,
} from '@/lib/referral-security'

const DEVICE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365
const ATTRIBUTION_COOKIE_MAX_AGE = 60 * 60 * 24 * 30

function cookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge,
  }
}

async function getOrCreateDeviceToken() {
  const store = await cookies()
  const existing = verifyReferralDeviceCookie(store.get(REFERRAL_DEVICE_COOKIE)?.value)
  if (existing) return { store, token: existing }

  const token = randomBytes(32).toString('base64url')
  store.set(REFERRAL_DEVICE_COOKIE, signReferralDeviceCookie(token), cookieOptions(DEVICE_COOKIE_MAX_AGE))
  return { store, token }
}

export async function registerReferralOwnerDevice(ownerId: string) {
  const { token } = await getOrCreateDeviceToken()
  const admin = getAuthAdminClient()
  const codeResult = await admin.rpc('get_or_create_referral_code', { p_owner_id: ownerId })
  if (codeResult.error || typeof codeResult.data !== 'string') throw codeResult.error || new Error('Referral code unavailable.')

  const deviceHash = hashReferralDeviceToken(token)
  const deviceResult = await admin.from('referral_owner_devices').upsert(
    { owner_id: ownerId, device_hash: deviceHash },
    { onConflict: 'owner_id,device_hash', ignoreDuplicates: true },
  )
  if (deviceResult.error) throw deviceResult.error
  return { code: codeResult.data, deviceHash }
}

/** Called only after a genuinely new custom-auth or Google account has been created. */
export async function recordReferralSignup(inviteeId: string, inviteeEmail: string) {
  try {
    const store = await cookies()
    const rawAttribution = store.get(REFERRAL_COOKIE)?.value
    const code = verifyReferralCookie(rawAttribution)
    const deviceToken = verifyReferralDeviceCookie(store.get(REFERRAL_DEVICE_COOKIE)?.value)
    // Consume the first-touch attribution after one new-account attempt; a device token persists.
    store.delete(REFERRAL_COOKIE)
    if (!code || !deviceToken) return

    const admin = getAuthAdminClient()
    const codeResult = await admin.from('referral_codes').select('owner_id').eq('code', code).maybeSingle()
    if (codeResult.error || !codeResult.data) return
    const ownerId = String(codeResult.data.owner_id)
    if (!ownerId || ownerId === inviteeId) return

    const ownerResult = await admin.from('auth_users').select('email,email_verified').eq('id', ownerId).maybeSingle()
    if (ownerResult.error || !ownerResult.data?.email_verified) return
    if (normalizeEmail(String(ownerResult.data.email || '')) === normalizeEmail(inviteeEmail)) return

    const deviceHash = hashReferralDeviceToken(deviceToken)
    const ownerDeviceResult = await admin.from('referral_owner_devices')
      .select('owner_id')
      .eq('owner_id', ownerId)
      .eq('device_hash', deviceHash)
      .maybeSingle()
    if (ownerDeviceResult.error || ownerDeviceResult.data) return

    const insertResult = await admin.from('referrals').insert({
      referral_code: code,
      referrer_id: ownerId,
      invitee_id: inviteeId,
      device_hash: deviceHash,
      status: 'pending',
    })
    if (insertResult.error && insertResult.error.code !== '23505') {
      console.warn('feedback_deo_referral_attribution_failed', { code: insertResult.error.code || 'unknown' })
    }
  } catch (error) {
    // Referral tracking is best-effort and never blocks a legitimate account signup.
    console.warn('feedback_deo_referral_attribution_failed', { name: error instanceof Error ? error.name : 'unknown' })
  }
}

export function getReferralCookieMaxAge() {
  return ATTRIBUTION_COOKIE_MAX_AGE
}

export function getReferralCookieOptions() {
  return cookieOptions(ATTRIBUTION_COOKIE_MAX_AGE)
}
