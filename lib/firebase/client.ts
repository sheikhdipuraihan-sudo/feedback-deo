export type AppUser = {
  uid: string
  id: string
  email: string
  role: 'authenticated' | 'admin'
  email_verified: boolean
  business_name: string | null
  getIdToken: () => Promise<string>
}

async function request(path: string, init?: RequestInit) {
  const response = await fetch(path, { ...init, credentials: 'include', headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) } })
  const payload = await response.json().catch(() => ({})) as { user?: AppUser; token?: string; error?: string }
  if (!response.ok) throw new Error(payload.error || 'Authentication request failed.')
  return payload
}

function withToken(user: Omit<AppUser, 'getIdToken'>): AppUser {
  return { ...user, getIdToken: async () => getSessionToken() }
}

export async function registerWithPassword(email: string, password: string, businessName: string, turnstileToken: string) {
  const payload = await request('/api/auth/custom?action=register', { method: 'POST', body: JSON.stringify({ email, password, businessName, turnstileToken }) })
  return withToken(payload.user as Omit<AppUser, 'getIdToken'>)
}

export async function loginWithPassword(email: string, password: string, turnstileToken: string) {
  const response = await fetch('/api/auth/custom?action=login', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password, turnstileToken }) })
  const payload = await response.json().catch(() => ({})) as { user?: Omit<AppUser, 'getIdToken'>; error?: string }
  if (!response.ok) {
    const error = new Error(payload.error || 'Authentication request failed.')
    ;(error as Error & { code?: string }).code = response.status === 409 && payload.error === 'LEGACY_FIREBASE_ACCOUNT' ? 'legacy-account' : undefined
    throw error
  }
  return withToken(payload.user!)
}

export async function migrateLegacyAccount(firebaseToken: string, email: string, password: string) {
  const payload = await request('/api/auth/custom?action=migrate', { method: 'POST', headers: { Authorization: `Bearer ${firebaseToken}` }, body: JSON.stringify({ email, password }) })
  return withToken(payload.user as Omit<AppUser, 'getIdToken'>)
}

export async function getSessionToken() {
  const payload = await request('/api/auth/custom?action=token')
  return payload.token as string
}

export async function waitForFirebaseUser() {
  try {
    const payload = await request('/api/auth/custom?action=me')
    return payload.user ? withToken(payload.user as Omit<AppUser, 'getIdToken'>) : null
  } catch {
    return null
  }
}

export async function signOutCurrentUser() {
  await request('/api/auth/custom?action=logout', { method: 'POST' })
}

// Kept as a compatibility no-op for older call sites during the migration.
export async function syncFirebaseClaims() {
  return undefined
}
