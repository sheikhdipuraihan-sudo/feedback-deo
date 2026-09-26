import { cert, getApp, getApps, initializeApp } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'

function getAdminApp() {
  if (getApps().length) return getApp()
  const projectId = process.env.FIREBASE_PROJECT_ID
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n')
  if (!projectId || !clientEmail || !privateKey) throw new Error('Firebase Admin environment is not configured.')
  return initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) })
}

export function getFirebaseAdminAuth() { return getAuth(getAdminApp()) }
