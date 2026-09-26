import { NextResponse } from 'next/server'
import { getFirebaseAdminAuth } from '@/lib/firebase/admin'

export async function POST(request: Request) {
  try {
    const authorization = request.headers.get('authorization')
    if (!authorization?.startsWith('Bearer ')) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const token = authorization.slice(7)
    const auth = await getFirebaseAdminAuth()
    const decoded = await auth.verifyIdToken(token)
    const current = await auth.getUser(decoded.uid)
    if (current.customClaims?.role !== 'authenticated') await auth.setCustomUserClaims(decoded.uid, { ...current.customClaims, role: 'authenticated' })
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('firebase_claims_failed', error instanceof Error ? error.message : 'unknown error')
    return NextResponse.json({ error: 'Could not initialize account permissions.' }, { status: 401 })
  }
}
