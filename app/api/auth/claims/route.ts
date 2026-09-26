import { NextResponse } from 'next/server'
import { getFirebaseAdminAuth } from '@/lib/firebase/admin'

export async function POST(request: Request) {
  try {
    const authorization = request.headers.get('authorization')
    if (!authorization?.startsWith('Bearer ')) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const token = authorization.slice(7)
    const decoded = await getFirebaseAdminAuth().verifyIdToken(token)
    const current = await getFirebaseAdminAuth().getUser(decoded.uid)
    if (current.customClaims?.role !== 'authenticated') await getFirebaseAdminAuth().setCustomUserClaims(decoded.uid, { ...current.customClaims, role: 'authenticated' })
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Could not initialize account permissions.' }, { status: 401 })
  }
}
