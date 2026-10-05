import { NextResponse } from 'next/server'
import { getFirebaseAdminAuth } from '@/lib/firebase/admin'
import { getUserByEmail, updateUserPassword } from '@/lib/auth/server'
import { getPasswordResetAdminClient, hashResetToken, normalizeResetEmail } from '@/lib/password-reset'

export const runtime = 'nodejs'
const RESET_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/
const INVALID_LINK_MESSAGE = 'That reset link is invalid, expired, or already used. Request a new link and try again.'

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({})) as { token?: string; password?: string }
    const token = String(body.token || '').trim()
    const password = String(body.password || '')
    if (!RESET_TOKEN_PATTERN.test(token)) return NextResponse.json({ error: INVALID_LINK_MESSAGE }, { status: 400 })
    if (password.length < 8) return NextResponse.json({ error: 'Choose a password with at least 8 characters.' }, { status: 400 })

    const supabase = getPasswordResetAdminClient()
    const tokenHash = hashResetToken(token)
    const result = await supabase.from('password_reset_codes')
      .select('id,email,expires_at')
      .eq('code_hash', tokenHash)
      .is('used_at', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (result.error) throw result.error
    const record = result.data
    if (!record || new Date(record.expires_at).getTime() <= Date.now()) {
      return NextResponse.json({ error: INVALID_LINK_MESSAGE }, { status: 400 })
    }

    // Claim the token atomically before changing the password; only one concurrent request can succeed.
    const consumedAt = new Date().toISOString()
    const consumed = await supabase.from('password_reset_codes')
      .update({ used_at: consumedAt })
      .eq('id', record.id)
      .is('used_at', null)
      .gt('expires_at', consumedAt)
      .select('email')
      .maybeSingle()
    if (consumed.error) throw consumed.error
    if (!consumed.data) return NextResponse.json({ error: INVALID_LINK_MESSAGE }, { status: 400 })

    const email = normalizeResetEmail(consumed.data.email)
    const customUser = await getUserByEmail(email)
    if (customUser) await updateUserPassword(customUser.id, password)
    else {
      const adminAuth = await getFirebaseAdminAuth()
      const firebaseUser = await adminAuth.getUserByEmail(email)
      await adminAuth.updateUser(firebaseUser.uid, { password })
    }
    return NextResponse.json({ message: 'Your password was updated. You can now log in.' })
  } catch (error) {
    if ((error as { code?: string })?.code === 'auth/user-not-found') {
      return NextResponse.json({ error: INVALID_LINK_MESSAGE }, { status: 400 })
    }
    console.error('feedback_deo_password_reset_link_verify_failed', error instanceof Error ? error.message : 'unknown')
    return NextResponse.json({ error: 'We could not update your password right now. Please try again or request a new link.' }, { status: 500 })
  }
}
