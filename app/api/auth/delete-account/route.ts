import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getFirebaseAdminAuth } from '@/lib/firebase/admin'
import { getCurrentUserFromRequest, getAuthAdminClient, getUserByEmail, verifyPassword } from '@/lib/auth/server'
import { ACCOUNT_DELETION_REAUTH_WINDOW_SECONDS, isRecentReauthentication, validateAccountDeletionInput, type AccountDeletionInput } from '@/lib/account-deletion'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  try {
    const authorization = request.headers.get('authorization') || ''
    if (!authorization.startsWith('Bearer ')) return NextResponse.json({ error: 'A signed-in session is required.' }, { status: 401 })
    const token = authorization.slice(7)
    const customUser = await getCurrentUserFromRequest(request)
    const adminAuth = customUser ? null : await getFirebaseAdminAuth()
    const decoded = customUser ? { uid: customUser.uid, email: customUser.email, auth_time: Math.floor(Date.now() / 1000) } : await adminAuth!.verifyIdToken(token)
    if (!decoded.email) return NextResponse.json({ error: 'Your account must have an email address.' }, { status: 400 })
    if (!customUser && !isRecentReauthentication(decoded.auth_time)) return NextResponse.json({ error: `For your protection, reauthenticate and try again within ${ACCOUNT_DELETION_REAUTH_WINDOW_SECONDS / 60} minutes.` }, { status: 401 })
    const body = await request.json().catch(() => ({})) as Partial<AccountDeletionInput>
    const input: AccountDeletionInput = { password: String(body.password || ''), email: String(body.email || ''), confirmationPhrase: String(body.confirmationPhrase || ''), acknowledged: body.acknowledged === true }
    const validationError = validateAccountDeletionInput(input, decoded.email)
    if (validationError) return NextResponse.json({ error: validationError }, { status: 400 })
    if (customUser) {
      const account = await getUserByEmail(decoded.email)
      if (!account?.password_hash || !(await verifyPassword(input.password, account.password_hash))) return NextResponse.json({ error: 'The current password is incorrect.' }, { status: 401 })
    }
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!supabaseUrl || !serviceRoleKey) return NextResponse.json({ error: 'Account deletion is not configured. Please contact feedbackdeo@gmail.com.' }, { status: 503 })
    const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } })
    const { error: resetDeleteError } = await supabase.from('password_reset_codes').delete().eq('email', decoded.email.toLowerCase())
    if (resetDeleteError) console.warn('feedback_deo_account_delete_reset_cleanup_failed', resetDeleteError.message)
    const { data: ownedWorkspaces, error: workspaceLookupError } = await supabase.from('workspaces').select('id').eq('owner_id', decoded.uid)
    if (workspaceLookupError) return NextResponse.json({ error: 'We could not verify your workspace data. Nothing was deleted; please try again or contact feedbackdeo@gmail.com.' }, { status: 500 })
    const workspaceIds = (ownedWorkspaces || []).map(row => row.id).filter(Boolean)
    if (workspaceIds.length) {
      // Explicitly clear every account-owned child record before removing the workspace rows.
      const cleanupResults = await Promise.all([
        supabase.from('feedback').delete().in('workspace_id', workspaceIds),
        supabase.from('tables').delete().in('workspace_id', workspaceIds),
        supabase.from('telegram_connections').delete().in('workspace_id', workspaceIds),
        supabase.from('telegram_link_tokens').delete().in('workspace_id', workspaceIds),
      ])
      const cleanupError = cleanupResults.find(result => result.error)
      if (cleanupError?.error) return NextResponse.json({ error: 'We could not remove every workspace record. Nothing else was deleted; please try again or contact feedbackdeo@gmail.com.' }, { status: 500 })
      const { error: workspaceDeleteError } = await supabase.from('workspaces').delete().in('id', workspaceIds).eq('owner_id', decoded.uid)
      if (workspaceDeleteError) return NextResponse.json({ error: 'We could not remove your workspace data. Nothing else was deleted; please try again or contact feedbackdeo@gmail.com.' }, { status: 500 })
    }
    if (customUser) await getAuthAdminClient().from('auth_users').delete().eq('id', decoded.uid)
    else await adminAuth!.deleteUser(decoded.uid)
    return NextResponse.json({ deleted: true }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    console.error('feedback_deo_account_delete_failed', error instanceof Error ? error.message : 'unknown')
    return NextResponse.json({ error: 'We could not delete your account. Please try again or contact feedbackdeo@gmail.com.' }, { status: 500 })
  }
}
