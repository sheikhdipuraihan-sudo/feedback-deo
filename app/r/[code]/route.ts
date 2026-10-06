import { NextResponse } from 'next/server'
import { randomBytes } from 'node:crypto'
import { cookies } from 'next/headers'
import { getAuthAdminClient } from '@/lib/auth/server'
import {
  REFERRAL_COOKIE,
  REFERRAL_DEVICE_COOKIE,
  hashReferralDeviceToken,
  isValidReferralCode,
  normalizeReferralCode,
  signReferralCookie,
  signReferralDeviceCookie,
  verifyReferralCookie,
  verifyReferralDeviceCookie,
} from '@/lib/referral-security'
import { getReferralCookieOptions } from '@/lib/referrals/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: Request, context: { params: Promise<{ code: string }> }) {
  const { code: rawCode } = await context.params
  const code = normalizeReferralCode(rawCode)
  const destination = new URL('/', request.url)
  const response = () => {
    const result = NextResponse.redirect(destination)
    result.headers.set('Cache-Control', 'private, no-store')
    result.headers.set('Referrer-Policy', 'no-referrer')
    return result
  }
  if (!isValidReferralCode(code)) return response()

  try {
    const admin = getAuthAdminClient()
    const codeResult = await admin.from('referral_codes').select('owner_id').eq('code', code).maybeSingle()
    if (codeResult.error || !codeResult.data) return response()

    const store = await cookies()
    const existingAttribution = verifyReferralCookie(store.get(REFERRAL_COOKIE)?.value)
    const existingDevice = verifyReferralDeviceCookie(store.get(REFERRAL_DEVICE_COOKIE)?.value)
    const deviceToken = existingDevice || cryptoRandomDeviceToken()
    if (!existingDevice) {
      store.set(REFERRAL_DEVICE_COOKIE, signReferralDeviceCookie(deviceToken), {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 60 * 60 * 24 * 365,
      })
    }

    // Keep first-touch attribution for the full 30-day signup window.
    if (!existingAttribution) {
      const deviceHash = hashReferralDeviceToken(deviceToken)
      const ownerDevice = await admin.from('referral_owner_devices')
        .select('owner_id')
        .eq('owner_id', String(codeResult.data.owner_id))
        .eq('device_hash', deviceHash)
        .maybeSingle()
      if (!ownerDevice.error && !ownerDevice.data) {
        store.set(REFERRAL_COOKIE, signReferralCookie(code), getReferralCookieOptions())
      }
    }
  } catch {
    // Invalid or unavailable referral links fail closed and still return safely to the app.
  }

  return response()
}

function cryptoRandomDeviceToken() {
  return randomBytes(32).toString('base64url')
}
