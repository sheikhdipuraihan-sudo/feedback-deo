let adminAuthPromise: Promise<import('firebase-admin/auth').Auth> | null = null

export function getFirebaseAdminAuth() {
  if (adminAuthPromise) return adminAuthPromise
  adminAuthPromise = Promise.all([import('firebase-admin/app'), import('firebase-admin/auth')]).then(([appModule, authModule]) => {
    const { cert, getApp, getApps, initializeApp } = appModule
    const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON
    const credentials = serviceAccountJson
      ? JSON.parse(serviceAccountJson)
      : {
          projectId: process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
        }
    if (!credentials.projectId || !credentials.clientEmail || !credentials.privateKey) throw new Error('Firebase Admin environment is not configured.')
    const app = getApps().length ? getApp() : initializeApp({ credential: cert(credentials) })
    return authModule.getAuth(app)
  })
  return adminAuthPromise
}
