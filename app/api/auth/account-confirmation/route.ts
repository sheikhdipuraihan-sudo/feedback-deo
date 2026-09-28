import { NextResponse } from 'next/server'
import { getFirebaseAdminAuth } from '@/lib/firebase/admin'
import { ACCOUNT_CONFIRMATION_BASE_URL, sendAccountConfirmationEmail } from '@/lib/account-confirmation'

export const runtime = 'nodejs'

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
