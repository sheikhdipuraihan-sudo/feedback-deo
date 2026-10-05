import { NextResponse } from 'next/server'
import { getFirebaseAdminAuth } from '@/lib/firebase/admin'
import { ACCOUNT_CONFIRMATION_BASE_URL, sendAccountConfirmationEmail } from '@/lib/account-confirmation'
import { getAuthAdminClient } from '@/lib/auth/server'
import { createHash } from 'node:crypto'

export const runtime = 'nodejs'

export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get('token') || ''
  if (!token) return NextResponse.redirect(new URL('/?confirmation=invalid', request.url))
  const tokenHash = createHash('sha256').update(token).digest('hex')
  const admin = getAuthAdminClient()
  const result = await admin.from('auth_verification_tokens').select('token_hash,user_id').eq('token_hash', tokenHash).eq('purpose', 'email_verification').is('used_at', null).gt('expires_at', new Date().toISOString()).maybeSingle()
  if (result.error || !result.data) return NextResponse.redirect(new URL('/?confirmation=invalid', request.url))
  await admin.from('auth_verification_tokens').update({ used_at: new Date().toISOString() }).eq('token_hash', tokenHash)
  await admin.from('auth_users').update({ email_verified: true, updated_at: new Date().toISOString() }).eq('id', result.data.user_id)
  return NextResponse.redirect(new URL('/?confirmation=success', request.url))
}

export async function POST(request: Request) {
  try {
    const authorization = request.headers.get('authorization')
    if (!authorization?.startsWith('Bearer ')) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const auth = await getFirebaseAdminAuth()
    const decoded = await auth.verifyIdToken(authorization.slice(7))
    const body = await request.json().catch(() => ({})) as { businessName?: string }
    const user = await auth.getUser(decoded.uid)
    if (!user.email) return NextResponse.json({ error: 'Your account does not have an email address.' }, { status: 400 })

    const verificationLink = await auth.generateEmailVerificationLink(user.email, {
      url: `${ACCOUNT_CONFIRMATION_BASE_URL}/dashboard`,
      handleCodeInApp: false,
    })
    await sendAccountConfirmationEmail(user.email, verificationLink, typeof body.businessName === 'string' ? body.businessName.slice(0, 120) : undefined)
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('feedback_deo_account_confirmation_failed', error instanceof Error ? error.message : 'unknown error')
    return NextResponse.json({ error: 'We could not send the account confirmation email right now.' }, { status: 500 })
  }
}
