import { getApp, getApps, initializeApp } from 'firebase/app'
import { getAuth, onAuthStateChanged, type User } from 'firebase/auth'

const firebaseConfig = {
  apiKey: 'AIzaSyCMi510deKlX1N3eo_T8mu-9wOUlU2_PUE',
  authDomain: 'bhaiedikii.firebaseapp.com',
  projectId: 'bhaiedikii',
  storageBucket: 'bhaiedikii.firebasestorage.app',
  messagingSenderId: '268934087919',
  appId: '1:268934087919:web:9bd4cee4ea6adaac35471a',
}

const firebaseApp = getApps().length ? getApp() : initializeApp(firebaseConfig)
export const firebaseAuth = getAuth(firebaseApp)

export function waitForFirebaseUser() {
  return new Promise<User | null>(resolve => {
    if (firebaseAuth.currentUser) { resolve(firebaseAuth.currentUser); return }
    const unsubscribe = onAuthStateChanged(firebaseAuth, user => { unsubscribe(); resolve(user) })
  })
}

export async function syncFirebaseClaims(user: User) {
  const token = await user.getIdToken()
  const response = await fetch('/api/auth/claims', { method: 'POST', headers: { Authorization: `Bearer ${token}` } })
  if (!response.ok) throw new Error('Could not initialize secure account permissions.')
  await user.getIdToken(true)
}
