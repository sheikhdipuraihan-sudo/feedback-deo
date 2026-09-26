let adminAuthPromise: Promise<import('firebase-admin/auth').Auth> | null = null

export function getFirebaseAdminAuth() {
  if (adminAuthPromise) return adminAuthPromise
  adminAuthPromise = Promise.all([import('firebase-admin/app'), import('firebase-admin/auth')]).then(([appModule, authModule]) => {
    const { cert, getApp, getApps, initializeApp } = appModule
    const privateKeyB64 = process.env.FIREBASE_PRIVATE_KEY_B64
    const encoded = process.env.FIREBASE_SERVICE_ACCOUNT_B64
    const serviceAccountJson = !privateKeyB64 && (encoded ? Buffer.from(encoded, 'base64').toString('utf8') : process.env.FIREBASE_SERVICE_ACCOUNT_JSON)
    const raw = serviceAccountJson ? JSON.parse(serviceAccountJson) : null
    const credentials = privateKeyB64 ? {
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: Buffer.from(privateKeyB64, 'base64').toString('utf8'),
    } : raw ? {
      projectId: raw.projectId || raw.project_id,
      clientEmail: raw.clientEmail || raw.client_email,
      privateKey: (raw.privateKey || raw.private_key)?.replace(/\\n/g, '\n'),
    } : {
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
