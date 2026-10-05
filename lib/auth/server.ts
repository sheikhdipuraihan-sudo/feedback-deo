import { createHash, createHmac, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto'
import bcrypt from 'bcryptjs'
import { cookies } from 'next/headers'
import { createClient } from '@supabase/supabase-js'
import { getFirebaseAdminAuth } from '@/lib/firebase/admin'

export const SESSION_COOKIE = 'feedback_deo_session'
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30
const TOKEN_TTL_SECONDS = 60 * 15

type AuthUserRow = {
  id: string
  email: string
  password_hash: string | null
  firebase_uid: string | null
  role: 'authenticated' | 'admin'
  email_verified: boolean
  business_name: string | null
}

export type AuthUser = Pick<AuthUserRow, 'id' | 'email' | 'role' | 'email_verified' | 'business_name'> & { uid: string }

function required(name: string) {
  const value = process.env[name]
  if (!value) throw new Error(`${name} is not configured.`)
  return value
}

export function getAuthAdminClient() {
  return createClient(required('NEXT_PUBLIC_SUPABASE_URL'), required('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

export function normalizeEmail(value: string) {
  return value.trim().toLowerCase()
}

export function publicUser(row: AuthUserRow): AuthUser {
  return {
    id: row.id,
    uid: row.id,
    email: row.email,
    role: row.role,
    email_verified: row.email_verified,
    business_name: row.business_name,
  }
}

function tokenHash(token: string) {
  return createHash('sha256').update(token).digest('hex')
}

export async function createEmailVerificationToken(userId: string) {
  const raw = randomBytes(32).toString('base64url')
  const { error } = await getAuthAdminClient().from('auth_verification_tokens').insert({
    token_hash: tokenHash(raw),
    user_id: userId,
    purpose: 'email_verification',
    expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
  })
  if (error) throw error
  return raw
}

function base64Url(value: string | Buffer) {
  return Buffer.from(value).toString('base64url')
}

function signJwt(payload: Record<string, unknown>) {
  const header = base64Url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const body = base64Url(JSON.stringify(payload))
  const signature = base64Url(createHmac('sha256', required('SUPABASE_JWT_SECRET')).update(`${header}.${body}`).digest())
  return `${header}.${body}.${signature}`
}

export async function createSupabaseAccessToken(user: AuthUser) {
  const now = Math.floor(Date.now() / 1000)
  return signJwt({
    aud: 'authenticated',
    role: 'authenticated',
    sub: user.id,
    email: user.email,
    user_metadata: { role: user.role },
    iat: now,
    exp: now + TOKEN_TTL_SECONDS,
  })
}

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 12)
}

export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash)
}

async function getUserById(id: string) {
  const { data, error } = await getAuthAdminClient().from('auth_users').select('id,email,password_hash,firebase_uid,role,email_verified,business_name').eq('id', id).maybeSingle()
  if (error) throw error
  return data as AuthUserRow | null
}

export async function getUserByEmail(email: string) {
  const { data, error } = await getAuthAdminClient().from('auth_users').select('id,email,password_hash,firebase_uid,role,email_verified,business_name').eq('email', normalizeEmail(email)).maybeSingle()
  if (error) throw error
  return data as AuthUserRow | null
}

export async function createUser(input: { email: string; password: string; businessName?: string; id?: string; firebaseUid?: string }) {
  const email = normalizeEmail(input.email)
  const row = {
    id: input.id || randomUUID(),
    email,
    password_hash: await hashPassword(input.password),
    firebase_uid: input.firebaseUid || null,
    role: 'authenticated' as const,
    email_verified: false,
    business_name: input.businessName?.trim().slice(0, 120) || null,
  }
  const { data, error } = await getAuthAdminClient().from('auth_users').insert(row).select('id,email,password_hash,firebase_uid,role,email_verified,business_name').single()
  if (error) throw error
  return data as AuthUserRow
}

export async function updateUserPassword(id: string, password: string) {
  const { error } = await getAuthAdminClient().from('auth_users').update({ password_hash: await hashPassword(password), updated_at: new Date().toISOString() }).eq('id', id)
  if (error) throw error
}

export async function createSession(user: AuthUser) {
  const raw = randomBytes(32).toString('base64url')
  const { error } = await getAuthAdminClient().from('auth_sessions').insert({
    token_hash: tokenHash(raw),
    user_id: user.id,
    expires_at: new Date(Date.now() + SESSION_TTL_SECONDS * 1000).toISOString(),
  })
  if (error) throw error
  const store = await cookies()
  store.set(SESSION_COOKIE, raw, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_TTL_SECONDS,
  })
}

export async function destroySession() {
  const store = await cookies()
  const raw = store.get(SESSION_COOKIE)?.value
  if (raw) await getAuthAdminClient().from('auth_sessions').delete().eq('token_hash', tokenHash(raw))
  store.delete(SESSION_COOKIE)
}

export async function getSessionUser() {
  const raw = (await cookies()).get(SESSION_COOKIE)?.value
  if (!raw) return null
  const { data: session, error: sessionError } = await getAuthAdminClient().from('auth_sessions').select('user_id,expires_at').eq('token_hash', tokenHash(raw)).gt('expires_at', new Date().toISOString()).maybeSingle()
  if (sessionError || !session) return null
  const user = await getUserById(session.user_id)
  if (!user) return null
  void getAuthAdminClient().from('auth_sessions').update({ last_seen_at: new Date().toISOString() }).eq('token_hash', tokenHash(raw))
  return publicUser(user)
}

export async function getUserFromBearer(request: Request) {
  const header = request.headers.get('authorization') || ''
  if (!header.startsWith('Bearer ')) return null
  const token = header.slice(7)
  const parts = token.split('.')
  if (parts.length !== 3) return null
  try {
    const expected = createHmac('sha256', required('SUPABASE_JWT_SECRET')).update(`${parts[0]}.${parts[1]}`).digest('base64url')
    const received = Buffer.from(parts[2], 'base64url')
    const expectedBuffer = Buffer.from(expected, 'base64url')
    if (received.length !== expectedBuffer.length || !timingSafeEqual(received, expectedBuffer)) return null
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8')) as { sub?: string; exp?: number; email?: string }
    if (!payload.sub || !payload.exp || payload.exp <= Math.floor(Date.now() / 1000)) return null
    const user = await getUserById(payload.sub)
    return user ? publicUser(user) : null
  } catch {
    return null
  }
}

export async function getLegacyFirebaseUser(request: Request) {
  const header = request.headers.get('authorization') || ''
  if (!header.startsWith('Bearer ')) return null
  try {
    const decoded = await (await getFirebaseAdminAuth()).verifyIdToken(header.slice(7))
    return { uid: decoded.uid, email: decoded.email ? normalizeEmail(decoded.email) : null }
  } catch {
    return null
  }
}

export function getCurrentUserFromRequest(request: Request) {
  return getUserFromBearer(request)
}
