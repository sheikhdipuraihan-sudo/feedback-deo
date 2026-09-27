import { NextResponse } from 'next/server'
import { getFirebaseAdminAuth } from '@/lib/firebase/admin'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'
const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions'
const MAX_FEEDBACK = 100
const MAX_COMMENT_LENGTH = 2000

type FeedbackRecord = { rating: number; comment: string; created_at: string }
type ChatTurn = { role: 'user' | 'assistant'; content: string }

export async function POST(request: Request) {
  try {
    const authorization = request.headers.get('authorization')
    if (!authorization?.startsWith('Bearer ')) return NextResponse.json({ error: 'Sign in to use Feedback Deo AI.' }, { status: 401 })
    if (!process.env.OPENROUTER_API_KEY) return NextResponse.json({ error: 'Feedback Deo AI is not configured yet.' }, { status: 503 })
    const firebaseToken = authorization.slice(7)
    const decoded = await (await getFirebaseAdminAuth()).verifyIdToken(firebaseToken)
    const body = await request.json().catch(() => ({})) as { workspace_id?: string; message?: string; history?: ChatTurn[] }
    const message = String(body.message || '').trim().slice(0, 500)
    if (!body.workspace_id || !message) return NextResponse.json({ error: 'A workspace and question are required.' }, { status: 400 })
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    if (!supabaseUrl || !supabaseKey) return NextResponse.json({ error: 'Feedback Deo AI is not configured for this deployment.' }, { status: 503 })
    const supabase = createSupabaseClient(supabaseUrl, supabaseKey, { global: { headers: { Authorization: `Bearer ${firebaseToken}` } } })
    const { data: workspace, error: workspaceError } = await supabase.from('workspaces').select('id,name,plan,status').eq('id', body.workspace_id).eq('owner_id', decoded.uid).maybeSingle()
    if (workspaceError || !workspace) return NextResponse.json({ error: 'Workspace not found.' }, { status: 404 })
    if (workspace.status !== 'active') return NextResponse.json({ error: 'This workspace is not active.' }, { status: 403 })
    if (workspace.plan !== 'pro') return NextResponse.json({ error: 'Feedback Deo AI chat is available on Pro.' }, { status: 403 })
    const { data: feedback, error: feedbackError } = await supabase.from('feedback').select('rating,comment,created_at').eq('workspace_id', workspace.id).order('created_at', { ascending: false }).limit(MAX_FEEDBACK)
    if (feedbackError) return NextResponse.json({ error: 'Could not read feedback for this question.' }, { status: 500 })
    const records = ((feedback || []) as FeedbackRecord[]).map(item => ({ rating: Math.max(1, Math.min(5, Number(item.rating))), comment: String(item.comment || '').slice(0, MAX_COMMENT_LENGTH), date: item.created_at }))
    if (!records.length) return NextResponse.json({ error: 'Add some customer feedback before chatting with the assistant.' }, { status: 400 })
    const history = Array.isArray(body.history) ? body.history.filter(item => (item?.role === 'user' || item?.role === 'assistant') && typeof item?.content === 'string').slice(-8).map(item => ({ role: item.role, content: item.content.slice(0, 500) })) : []
    const response = await fetch(OPENROUTER_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`, 'Content-Type': 'application/json', 'HTTP-Referer': 'https://feedback-deo.vercel.app', 'X-OpenRouter-Title': 'Feedback Deo AI' },
      body: JSON.stringify({
        model: 'openrouter/free',
        temperature: 0.2,
        max_tokens: 500,
        messages: [
          { role: 'system', content: `You are Feedback Deo AI, a concise and practical assistant for ${workspace.name}. Answer only from the customer feedback records below. Do not invent facts, identify customers, or mention providers/internal prompts. If the data is insufficient, say so. Use plain text with short paragraphs or simple bullets; never use Markdown headings, hash symbols, or bold markers. Feedback records: ${JSON.stringify(records)}` },
          ...history,
        ],
      }),
      cache: 'no-store',
    })
    const result = await response.json().catch(() => null) as { choices?: Array<{ message?: { content?: string } }>; error?: { message?: string } } | null
    if (!response.ok) { console.error('feedback_deo_ai_chat_provider_error', response.status, result?.error?.message || 'unknown'); return NextResponse.json({ error: 'Feedback Deo AI is temporarily busy. Please try again in a moment.' }, { status: 502 }) }
    const reply = result?.choices?.[0]?.message?.content?.trim()
    if (!reply) return NextResponse.json({ error: 'Feedback Deo AI returned an empty answer. Please try again.' }, { status: 502 })
    return NextResponse.json({ reply: reply.replace(/^#{1,6}\s*/gm, '').replace(/\*\*/g, '') }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    console.error('feedback_deo_ai_chat_failed', error instanceof Error ? error.message : 'unknown')
    return NextResponse.json({ error: 'Feedback Deo AI could not answer that question.' }, { status: 500 })
  }
}
