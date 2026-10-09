import { NextResponse } from 'next/server'
import { getFirebaseAdminAuth } from '@/lib/firebase/admin'
import { verifyTurnstileToken } from '@/lib/turnstile'
import { ACCOUNT_CONFIRMATION_BASE_URL, sendAccountConfirmationEmail } from '@/lib/account-confirmation'
import {
  createSession,
  createSupabaseAccessToken,
  createUser,
  destroySession,
  getCurrentUserFromRequest,
  getLegacyFirebaseUser,
  getSessionUser,
  getUserByEmail,
  hashPassword,
  createEmailVerificationToken,
  normalizeEmail,
  publicUser,
  updateUserPassword,
  verifyPassword,
} from '@/lib/auth/server'

export const runtime = 'nodejs'

function bad(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status })
}

function validPassword(password: string) {
  return password.length >= 8 && password.length <= 200
}

export async function GET(request: Request) {
  const action = new URL(request.url).searchParams.get('action') || 'me'
  if (action === 'me') return NextResponse.json({ user: await getSessionUser() })
  if (action === 'token') {
    const user = await getSessionUser()
    if (!user) return bad('Your session has expired. Please log in again.', 401)
    return NextResponse.json({ token: await createSupabaseAccessToken(user) }, { headers: { 'Cache-Control': 'private, no-store' } })
  }
  return bad('Unknown auth action.', 404)
}

export async function POST(request: Request) {
  const action = new URL(request.url).searchParams.get('action')
  const body = await request.json().catch(() => ({})) as Record<string, unknown>
  const email = normalizeEmail(String(body.email || ''))
  const password = String(body.password || '')
  if (action === 'register' || action === 'login') {
    const verified = await verifyTurnstileToken(body.turnstileToken, new URL(request.url).hostname)
    if (!verified) return bad('Complete the verification challenge and try again.', 403)
  }
  if (action === 'register') {
    if (!email.includes('@') || email.length > 254) return bad('Enter a valid email address.')
    if (!validPassword(password)) return bad('Choose a password between 8 and 200 characters.')
    if (await getUserByEmail(email)) return bad('This email already has an account. Log in or use Forgot your password.', 409)
    try {
      const user = await createUser({ email, password, businessName: String(body.businessName || '') })
      const publicRecord = publicUser(user)
      await createSession(publicRecord)
      try {
        const verificationToken = await createEmailVerificationToken(user.id)
        await sendAccountConfirmationEmail(email, `${process.env.NEXT_PUBLIC_APP_URL || ACCOUNT_CONFIRMATION_BASE_URL}/api/auth/account-confirmation?token=${encodeURIComponent(verificationToken)}`, user.business_name || undefined)
      } catch (error) {
        console.warn('custom_auth_confirmation_email_failed', error instanceof Error ? error.message : 'unknown error')
      }
      return NextResponse.json({ user: publicRecord }, { status: 201 })
    } catch (error) {
      console.error('custom_auth_register_failed', error instanceof Error ? error.message : 'unknown error')
      return bad('We could not create your account right now.', 500)
    }
  }
  if (action === 'login') {
    if (!email || !password) return bad('Enter your email and password.')
    const user = await getUserByEmail(email)
    if (!user?.password_hash) {
      try {
        await (await getFirebaseAdminAuth()).getUserByEmail(email)
        return bad('LEGACY_FIREBASE_ACCOUNT', 409)
      } catch (error) {
        if ((error as { code?: string })?.code === 'auth/user-not-found') return bad('Invalid email or password.', 401)
        console.error('legacy_account_lookup_failed', error instanceof Error ? error.message : 'unknown error')
        return bad('This older account needs password reset before it can be migrated.', 409)
      }
    }
    if (!(await verifyPassword(password, user.password_hash))) return bad('Invalid email or password.', 401)
    const publicRecord = publicUser(user)
    await createSession(publicRecord)
    return NextResponse.json({ user: publicRecord })
  }
  if (action === 'migrate') {
    if (!validPassword(password)) return bad('Choose a password between 8 and 200 characters.')
    const legacy = await getLegacyFirebaseUser(request)
    if (!legacy?.email || !legacy.uid) return bad('Your old account could not be verified. Please log in again.', 401)
    const existing = await getUserByEmail(legacy.email)
    let user = existing
    if (existing) {
      if (existing.firebase_uid && existing.firebase_uid !== legacy.uid) return bad('This account is already linked to another login.', 409)
      const { error } = await (await import('@/lib/auth/server')).getAuthAdminClient().from('auth_users').update({ firebase_uid: legacy.uid, password_hash: await hashPassword(password), updated_at: new Date().toISOString() }).eq('id', existing.id)
      if (error) throw error
      user = { ...existing, firebase_uid: legacy.uid, password_hash: 'set' }
    } else {
      const firebaseUser = await (await getFirebaseAdminAuth()).getUser(legacy.uid)
      user = await createUser({ email: legacy.email, password, id: legacy.uid, firebaseUid: legacy.uid, businessName: firebaseUser.displayName || '' })
    }
    const publicRecord = publicUser(user!)
    await createSession(publicRecord)
    return NextResponse.json({ user: publicRecord, migrated: true })
  }
  if (action === 'logout') {
    await destroySession()
    return NextResponse.json({ ok: true })
  }
  if (action === 'session-token') {
    const user = await getCurrentUserFromRequest(request)
    if (!user) return bad('Unauthorized.', 401)
    return NextResponse.json({ token: await createSupabaseAccessToken(user) })
  }
  return bad('Unknown auth action.', 404)
}
