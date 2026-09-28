import { NextResponse } from 'next/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { getFirebaseAdminAuth } from '@/lib/firebase/admin'
import { createReviewWidgetToken } from '@/lib/embed/review-widget'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  const authorization = request.headers.get('authorization')
  if (!authorization?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Sign in to create a website widget.' }, { status: 401 })
  }

  let decoded: { uid: string }
  try {
    decoded = await (await getFirebaseAdminAuth()).verifyIdToken(authorization.slice(7))
  } catch {
    return NextResponse.json({ error: 'Your session expired. Please sign in again.' }, { status: 401 })
  }

  const body = await request.json().catch(() => ({})) as { workspace_id?: string }
  if (typeof body.workspace_id !== 'string' || body.workspace_id.length > 80 || !body.workspace_id) {
    return NextResponse.json({ error: 'A valid workspace is required.' }, { status: 400 })
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const signingSecret = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !signingSecret) {
    return NextResponse.json({ error: 'Website widgets are temporarily unavailable.' }, { status: 503 })
  }

  const supabase = createSupabaseClient(supabaseUrl, signingSecret, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const { data: workspace, error } = await supabase
    .from('workspaces')
    .select('id,slug,plan,status')
    .eq('id', body.workspace_id)
    .eq('owner_id', decoded.uid)
    .maybeSingle()

  if (error || !workspace) return NextResponse.json({ error: 'Workspace not found.' }, { status: 404 })
  if (workspace.status !== 'active') return NextResponse.json({ error: 'This workspace is not active.' }, { status: 403 })
  if (workspace.plan !== 'pro') return NextResponse.json({ error: 'The website reviews widget is available on Pro.' }, { status: 403 })

  return NextResponse.json(
    { token: createReviewWidgetToken(workspace.slug, signingSecret) },
    { headers: { 'Cache-Control': 'private, no-store' } },
  )
}
