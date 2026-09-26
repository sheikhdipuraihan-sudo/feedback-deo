let adminAuthPromise: Promise<import('firebase-admin/auth').Auth> | null = null

export function getFirebaseAdminAuth() {
  if (adminAuthPromise) return adminAuthPromise
  adminAuthPromise = Promise.all([import('firebase-admin/app'), import('firebase-admin/auth')]).then(([appModule, authModule]) => {
    const { cert, getApp, getApps, initializeApp } = appModule
    const projectId = process.env.FIREBASE_PROJECT_ID
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL
    const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n')
    if (!projectId || !clientEmail || !privateKey) throw new Error('Firebase Admin environment is not configured.')
    const app = getApps().length ? getApp() : initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) })
    return authModule.getAuth(app)
  })
  return adminAuthPromise
}
