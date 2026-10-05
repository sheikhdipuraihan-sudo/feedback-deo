import { NextResponse } from 'next/server'
import { getFirebaseAdminAuth } from '@/lib/firebase/admin'
import { getAuthAdminClient } from '@/lib/auth/server'

export const runtime = 'nodejs'

function authorized(request: Request) {
  const expected = process.env.FIREBASE_ACCOUNT_IMPORT_SECRET
  return Boolean(expected && request.headers.get('x-firebase-import-secret') === expected)
}

export async function POST(request: Request) {
  if (!authorized(request)) return NextResponse.json({ error: 'Not found.' }, { status: 404 })
  try {
    const firebase = await getFirebaseAdminAuth()
    const supabase = getAuthAdminClient()
    let pageToken: string | undefined
    let imported = 0
    let linked = 0
    let skipped = 0
    do {
      const page = await firebase.listUsers(1000, pageToken)
      for (const firebaseUser of page.users) {
        if (!firebaseUser.email) {
          skipped += 1
          continue
        }
        const email = firebaseUser.email.trim().toLowerCase()
        const existing = await supabase.from('auth_users').select('id,google_sub').eq('email', email).maybeSingle()
        if (existing.error) throw existing.error
        if (existing.data) {
          const { error } = await supabase.from('auth_users').update({ firebase_uid: firebaseUser.uid, email_verified: firebaseUser.emailVerified, updated_at: new Date().toISOString(), business_name: existing.data.google_sub ? undefined : (firebaseUser.displayName || undefined) }).eq('id', existing.data.id)
          if (error) throw error
          linked += 1
        } else {
          const { error } = await supabase.from('auth_users').insert({ id: firebaseUser.uid, email, password_hash: null, firebase_uid: firebaseUser.uid, google_sub: null, role: 'authenticated', email_verified: firebaseUser.emailVerified, business_name: firebaseUser.displayName || null })
          if (error) throw error
          imported += 1
        }
      }
      pageToken = page.pageToken
    } while (pageToken)
    return NextResponse.json({ imported, linked, skipped })
  } catch (error) {
    console.error('firebase_account_import_failed', error instanceof Error ? error.message : 'unknown error')
    return NextResponse.json({ error: 'Firebase account import failed.' }, { status: 500 })
  }
}
