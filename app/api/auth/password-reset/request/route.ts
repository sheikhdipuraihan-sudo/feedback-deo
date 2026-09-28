import { NextResponse } from 'next/server'
import { getFirebaseAdminAuth } from '@/lib/firebase/admin'
import { createResetLink, createResetToken, getPasswordResetAdminClient, hashResetToken, normalizeResetEmail, RESET_LINK_TTL_MINUTES, sendResetLink } from '@/lib/password-reset'

export const runtime = 'nodejs'
const RESEND_COOLDOWN_MS = 60_000

export async function POST(request: Request) {
  const genericMessage = 'If an account exists for that email, a one-time password reset link has been sent. Check your inbox and spam folder.'
  try {
    const body = await request.json().catch(() => ({})) as { email?: string }
    const email = normalizeResetEmail(String(body.email || ''))
    if (!email || !email.includes('@') || email.length > 254) return NextResponse.json({ error: 'Enter a valid email address.' }, { status: 400 })

    const adminAuth = await getFirebaseAdminAuth()
    let firebaseUser
    try {
      firebaseUser = await adminAuth.getUserByEmail(email)
    } catch (error) {
      if ((error as { code?: string })?.code === 'auth/user-not-found') return NextResponse.json({ message: genericMessage })
      throw error
    }

    const supabase = getPasswordResetAdminClient()
    // Include used links in the cooldown check so repeatedly consuming links cannot bypass throttling.
    const recent = await supabase.from('password_reset_codes')
      .select('created_at')
      .eq('email', email)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (recent.error) throw recent.error
    if (recent.data && Date.now() - new Date(recent.data.created_at).getTime() < RESEND_COOLDOWN_MS) {
      return NextResponse.json({ message: genericMessage })
    }

    const token = createResetToken()
    const tokenHash = hashResetToken(token)
    const resetLink = createResetLink(token)
    const expiresAt = new Date(Date.now() + RESET_LINK_TTL_MINUTES * 60_000).toISOString()

    // Invalidate any earlier link for this address before inserting its replacement.
    const { error: deleteError } = await supabase.from('password_reset_codes').delete().eq('email', email)
    if (deleteError) throw deleteError
    const { error: insertError } = await supabase.from('password_reset_codes').insert({
      email,
      code_hash: tokenHash,
      expires_at: expiresAt,
      attempts: 0,
    })
    if (insertError) throw insertError

    try {
      await sendResetLink(email, resetLink)
    } catch (sendError) {
      await supabase.from('password_reset_codes').delete().eq('email', email).is('used_at', null)
      throw sendError
    }

    console.info('feedback_deo_password_reset_link_requested', firebaseUser.uid)
    return NextResponse.json({ message: genericMessage })
  } catch (error) {
    console.error('feedback_deo_password_reset_link_request_failed', error instanceof Error ? error.message : 'unknown')
    return NextResponse.json({ error: 'We could not send a reset link right now. Please try again later.' }, { status: 500 })
  }
}
