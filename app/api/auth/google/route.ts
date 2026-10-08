import { NextResponse } from 'next/server'
import { randomBytes, timingSafeEqual } from 'node:crypto'
import { cookies } from 'next/headers'
import { createSession, createUser, getUserByEmail, getUserByGoogleSub, getAuthAdminClient, publicUser } from '@/lib/auth/server'

export const runtime = 'nodejs'
const STATE_COOKIE = 'feedback_deo_google_state'
const DEFAULT_ORIGIN = 'https://feedback-deo.vercel.app'

function origin(request: Request) {
  return process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin || DEFAULT_ORIGIN
}

function redirectUri(request: Request) {
  return process.env.GOOGLE_REDIRECT_URI || `${origin(request)}/api/auth/google/callback`
}

function failure(request: Request, reason: string) {
  return NextResponse.redirect(new URL(`/?auth=google_error&reason=${encodeURIComponent(reason)}`, origin(request)))
}

export async function GET(request: Request) {
  const clientId = process.env.GOOGLE_CLIENT_ID
  if (!clientId) return failure(request, 'Google sign-in is not configured yet.')
  const state = randomBytes(32).toString('base64url')
  const store = await cookies()
  store.set(STATE_COOKIE, state, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: 600 })
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri(request),
    response_type: 'code',
    scope: 'openid email profile',
    state,
    prompt: 'select_account',
  })
  return NextResponse.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`)
}

export async function POST(request: Request) {
  return GET(request)
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204 })
}

export async function PUT() {
  return new NextResponse(null, { status: 405 })
}

export async function DELETE() {
  return new NextResponse(null, { status: 405 })
}

export async function PATCH() {
  return new NextResponse(null, { status: 405 })
}

export async function HEAD() {
  return new NextResponse(null, { status: 405 })
}

export async function handleGoogleCallback(request: Request) {
  const url = new URL(request.url)
  const code = url.searchParams.get('code')
  const returnedState = url.searchParams.get('state') || ''
  const store = await cookies()
  const expectedState = store.get(STATE_COOKIE)?.value || ''
  store.delete(STATE_COOKIE)
  if (!code || !expectedState) return failure(request, 'The Google sign-in session expired. Please try again.')
  const a = Buffer.from(returnedState)
  const b = Buffer.from(expectedState)
  if (a.length !== b.length || !timingSafeEqual(a, b)) return failure(request, 'The Google sign-in request could not be verified.')
  const clientId = process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET
  if (!clientId || !clientSecret) return failure(request, 'Google sign-in is not configured yet.')
  try {
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ code, client_id: clientId, client_secret: clientSecret, redirect_uri: redirectUri(request), grant_type: 'authorization_code' }) })
    const tokenPayload = await tokenResponse.json() as { access_token?: string }
    if (!tokenResponse.ok || !tokenPayload.access_token) return failure(request, 'Google could not complete sign-in.')
    const profileResponse = await fetch('https://openidconnect.googleapis.com/v1/userinfo', { headers: { Authorization: `Bearer ${tokenPayload.access_token}` } })
    const profile = await profileResponse.json() as { sub?: string; email?: string; email_verified?: boolean; name?: string }
    if (!profileResponse.ok || !profile.sub || !profile.email || profile.email_verified !== true) return failure(request, 'Google did not return a verified email address.')
    const email = profile.email.trim().toLowerCase()
    const existingGoogle = await getUserByGoogleSub(profile.sub)
    let user = existingGoogle
    if (!user) {
      const existingEmail = await getUserByEmail(email)
      if (existingEmail) {
        const { data, error } = await getAuthAdminClient().from('auth_users').update({ google_sub: profile.sub, email_verified: true, updated_at: new Date().toISOString() }).eq('id', existingEmail.id).select('id,email,password_hash,firebase_uid,google_sub,role,email_verified,business_name').single()
        if (error) throw error
        user = data
      } else {
        user = await createUser({ email, password: randomBytes(48).toString('base64url'), googleSub: profile.sub, emailVerified: true, businessName: profile.name || '' })
      }
    }
    await createSession(publicUser(user))
    const destination = '/dashboard'
    return NextResponse.redirect(new URL(destination, origin(request)))
  } catch (error) {
    console.error('google_auth_callback_failed', error instanceof Error ? error.message : 'unknown error')
    return failure(request, 'Google sign-in could not be completed.')
  }
}

export const dynamic = 'force-dynamic'
