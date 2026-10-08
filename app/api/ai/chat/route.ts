import { NextResponse } from 'next/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { getCurrentUserFromRequest } from '@/lib/auth/server'
import { getBusinessTypeLabel } from '@/lib/business-types'
import { buildChatSystemPrompt } from '@/lib/ai/prompts'

export const runtime = 'nodejs'
const MAX_FEEDBACK = 100
const MAX_COMMENT_LENGTH = 1000

type FeedbackRecord = { rating: number; comment: string; created_at: string }
type ChatTurn = { role: 'user' | 'assistant'; content: string }

type WorkspaceRecord = {
  id: string
  name: string
  status: 'active' | 'banned'
  plan?: string | null
  business_type?: string | null
  qr_theme?: string | null
  qr_business_name?: string | null
  qr_brand_color?: string | null
  qr_layout?: string | null
  qr_brand_text?: string | null
}

export async function POST(request: Request) {
  try {
    const authorization = request.headers.get('authorization')
    if (!authorization?.startsWith('Bearer ')) return NextResponse.json({ error: 'Sign in to use Feedback Deo AI.' }, { status: 401 })

    const firebaseToken = authorization.slice(7)
    const decoded = await getCurrentUserFromRequest(request)
    if (!decoded) return NextResponse.json({ error: 'Your session expired. Please sign in again.' }, { status: 401 })
    const body = await request.json().catch(() => ({})) as { workspace_id?: string; message?: string; history?: ChatTurn[] }
    const workspaceId = typeof body.workspace_id === 'string' ? body.workspace_id : ''
    const message = String(body.message || '').trim().slice(0, 500)
    if (!workspaceId || !message) return NextResponse.json({ error: 'A workspace and question are required.' }, { status: 400 })

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    if (!supabaseUrl || !supabaseKey) return NextResponse.json({ error: 'Feedback Deo AI is not configured for this deployment.' }, { status: 503 })

    const supabase = createSupabaseClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: `Bearer ${firebaseToken}` } },
    })
    const { data: workspaceData, error: workspaceError } = await supabase
      .from('workspaces')
      .select('id,name,status,plan,business_type,qr_theme,qr_business_name,qr_brand_color,qr_layout,qr_brand_text')
      .eq('id', workspaceId)
      .eq('owner_id', decoded.uid)
      .maybeSingle()
    const workspace = workspaceData as WorkspaceRecord | null
    if (workspaceError || !workspace) return NextResponse.json({ error: 'Workspace not found.' }, { status: 404 })
    if (workspace.status !== 'active') return NextResponse.json({ error: 'This workspace is not active.' }, { status: 403 })

    const [{ data: feedback, error: feedbackError }, { data: feedbackPoints }, { data: telegramRows, error: telegramError }] = await Promise.all([
      supabase.from('feedback').select('rating,comment,created_at').eq('workspace_id', workspace.id).order('created_at', { ascending: false }).limit(MAX_FEEDBACK),
      supabase.from('tables').select('name').eq('workspace_id', workspace.id).order('created_at', { ascending: true }).limit(50),
      supabase.rpc('get_telegram_connection'),
    ])
    if (feedbackError) return NextResponse.json({ error: 'Feedback Deo AI could not read this workspace’s feedback. Please try again.' }, { status: 500 })

    const records = ((feedback || []) as FeedbackRecord[]).map(item => ({
      rating: Math.max(1, Math.min(5, Number(item.rating) || 1)),
      comment: String(item.comment || '').slice(0, MAX_COMMENT_LENGTH),
      date: item.created_at,
    }))
    const businessType = getBusinessTypeLabel(workspace.business_type)
    const systemPrompt = buildChatSystemPrompt({
      name: workspace.name,
      businessType,
      plan: workspace.plan || undefined,
      telegram: !telegramError && telegramRows
        ? (() => {
          const row = Array.isArray(telegramRows) ? telegramRows[0] : telegramRows
          return row ? { connected: Boolean(row.connected), username: row.telegram_username || null } : null
        })()
        : null,
      feedbackPointNames: (feedbackPoints || []).map(point => String(point.name || '')).filter(Boolean),
      qrBranding: {
        businessName: workspace.qr_business_name || null,
        brandText: workspace.qr_brand_text || null,
        theme: workspace.qr_theme || null,
        brandColor: workspace.qr_brand_color || null,
        layout: workspace.qr_layout || null,
      },
    }, records)

    const history = Array.isArray(body.history)
      ? body.history
        .filter(item => (item?.role === 'user' || item?.role === 'assistant') && typeof item?.content === 'string')
        .slice(-8)
        .map(item => ({ role: item.role, content: item.content.slice(0, 500) }))
      : []
    const alreadyIncludesQuestion = history.length > 0
      && history[history.length - 1].role === 'user'
      && history[history.length - 1].content === message
    const turns: ChatTurn[] = alreadyIncludesQuestion
      ? history
      : [...history.slice(-7), { role: 'user', content: message }]
    const messages: PuterChatMessage[] = [
      { role: 'system', content: systemPrompt },
      ...turns,
    ]

    return NextResponse.json({ messages }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    console.error('feedback_deo_ai_chat_request_failed', { name: error instanceof Error ? error.name : 'unknown' })
    return NextResponse.json({ error: 'Feedback Deo AI could not complete that request. Please try again.' }, { status: 500 })
  }
}
