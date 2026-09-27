import { NextResponse } from 'next/server'
import { getFirebaseAdminAuth } from '@/lib/firebase/admin'
import { getPasswordResetAdminClient, hashResetCode, normalizeResetEmail } from '@/lib/password-reset'

export const runtime = 'nodejs'
const MAX_ATTEMPTS = 5

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({})) as { email?: string; code?: string; password?: string }
    const email = normalizeResetEmail(String(body.email || ''))
    const code = String(body.code || '').trim()
    const password = String(body.password || '')
    if (!email || !email.includes('@') || !/^\d{6}$/.test(code)) return NextResponse.json({ error: 'Enter the six-digit code from your email.' }, { status: 400 })
    if (password.length < 8) return NextResponse.json({ error: 'Choose a password with at least 8 characters.' }, { status: 400 })
    const supabase = getPasswordResetAdminClient()
    const result = await supabase.from('password_reset_codes').select('id,code_hash,expires_at,attempts,used_at').eq('email', email).is('used_at', null).order('created_at', { ascending: false }).limit(1).maybeSingle()
    if (result.error) throw result.error
    const record = result.data
    if (!record || new Date(record.expires_at).getTime() <= Date.now() || record.attempts >= MAX_ATTEMPTS) return NextResponse.json({ error: 'That code is invalid or expired. Request a new code and try again.' }, { status: 400 })
    const expectedHash = hashResetCode(email, code)
    if (expectedHash !== record.code_hash) {
      await supabase.from('password_reset_codes').update({ attempts: record.attempts + 1 }).eq('id', record.id)
      return NextResponse.json({ error: 'That code is incorrect. Check the email and try again.' }, { status: 400 })
    }
    const adminAuth = await getFirebaseAdminAuth()
    const firebaseUser = await adminAuth.getUserByEmail(email)
    await adminAuth.updateUser(firebaseUser.uid, { password })
    const { error: markUsedError } = await supabase.from('password_reset_codes').update({ used_at: new Date().toISOString() }).eq('id', record.id)
    if (markUsedError) throw markUsedError
    return NextResponse.json({ message: 'Your password was updated. You can now log in.' })
  } catch (error) {
    if ((error as { code?: string })?.code === 'auth/user-not-found') return NextResponse.json({ error: 'That code is invalid or expired. Request a new code and try again.' }, { status: 400 })
    console.error('feedback_deo_password_reset_verify_failed', error instanceof Error ? error.message : 'unknown')
    return NextResponse.json({ error: 'We could not update your password right now. Please try again later.' }, { status: 500 })
  }
}
