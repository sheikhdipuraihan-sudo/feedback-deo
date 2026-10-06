import { NextResponse } from 'next/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { getCurrentUserFromRequest } from '@/lib/auth/server'
import { getBusinessTypeLabel } from '@/lib/business-types'
import { hasProAccess } from '@/lib/pro-access'
import {
  buildChatSystemPrompt,
  FEEDBACK_DEO_IDENTITY_REPLY,
  FEEDBACK_DEO_REFUSAL_REPLY,
  FEEDBACK_DEO_TEMPORARY_REPLY,
  isAssistantIdentityQuestion,
  normalizeChatOutput,
} from '@/lib/ai/prompts'
import {
  AIProviderRefusalError,
  AIProviderStreamInterruptedError,
  AIProvidersUnavailableError,
  hasAIProvider,
  streamAIText,
  type AIMessage,
} from '@/lib/ai/providers'

export const runtime = 'nodejs'
export const maxDuration = 30
const MAX_FEEDBACK = 100
const MAX_COMMENT_LENGTH = 1000
const encoder = new TextEncoder()

type FeedbackRecord = { rating: number; comment: string; created_at: string }
type ChatTurn = { role: 'user' | 'assistant'; content: string }

type WorkspaceRecord = {
  id: string
  name: string
  plan: 'free' | 'pro'
  referral_pro_until?: string | null
  status: 'active' | 'banned'
  business_type?: string | null
  qr_theme?: string | null
  qr_business_name?: string | null
  qr_brand_color?: string | null
  qr_layout?: string | null
  qr_brand_text?: string | null
}

function eventChunk(event: Record<string, string>): Uint8Array {
  return encoder.encode(`data: ${JSON.stringify(event)}\n\n`)
}

function createChatStream(messages: AIMessage[], fixedReply?: string): Response {
  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      let fullText = ''
      const send = (event: Record<string, string>) => controller.enqueue(eventChunk(event))
      try {
        if (fixedReply) {
          const words = fixedReply.match(/\S+\s*/g) || [fixedReply]
          for (const word of words) {
            fullText += word
            send({ type: 'delta', text: word })
            await new Promise(resolve => setTimeout(resolve, 18))
          }
        } else {
          for await (const delta of streamAIText({ messages, temperature: 0.25, maxTokens: 700 })) {
            fullText += delta
            send({ type: 'delta', text: delta })
          }
        }
        const finalText = normalizeChatOutput(fullText)
        if (!finalText) {
          send({ type: 'error', code: 'empty', text: FEEDBACK_DEO_TEMPORARY_REPLY })
        } else {
          send({ type: 'done', text: finalText })
        }
      } catch (error) {
        if (error instanceof AIProviderRefusalError) {
          send({ type: 'error', code: 'refused', text: FEEDBACK_DEO_REFUSAL_REPLY })
        } else if (error instanceof AIProviderStreamInterruptedError) {
          send({ type: 'error', code: 'interrupted', text: 'The connection was interrupted while I was replying. Please try your question again.' })
        } else {
          if (!(error instanceof AIProvidersUnavailableError)) {
            console.error('feedback_deo_ai_chat_failed', { name: error instanceof Error ? error.name : 'unknown' })
          }
          send({ type: 'error', code: 'unavailable', text: FEEDBACK_DEO_TEMPORARY_REPLY })
        }
      } finally {
        try { controller.close() } catch { /* the client may have disconnected */ }
      }
    },
  })

  return new Response(body, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
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
      .select('id,name,plan,referral_pro_until,status,business_type,qr_theme,qr_business_name,qr_brand_color,qr_layout,qr_brand_text')
      .eq('id', workspaceId)
      .eq('owner_id', decoded.uid)
      .maybeSingle()
    const workspace = workspaceData as WorkspaceRecord | null
    if (workspaceError || !workspace) return NextResponse.json({ error: 'Workspace not found.' }, { status: 404 })
    if (workspace.status !== 'active') return NextResponse.json({ error: 'This workspace is not active.' }, { status: 403 })
    if (!hasProAccess(workspace)) return NextResponse.json({ error: 'Feedback Deo AI chat is available on Pro.' }, { status: 403 })

    if (isAssistantIdentityQuestion(message)) return createChatStream([], FEEDBACK_DEO_IDENTITY_REPLY)
    if (!hasAIProvider()) return NextResponse.json({ error: 'Feedback Deo AI is temporarily unavailable. Please try again in a moment.' }, { status: 503 })

    const [{ data: feedback, error: feedbackError }, { data: feedbackPoints }] = await Promise.all([
      supabase.from('feedback').select('rating,comment,created_at').eq('workspace_id', workspace.id).order('created_at', { ascending: false }).limit(MAX_FEEDBACK),
      supabase.from('tables').select('name').eq('workspace_id', workspace.id).order('created_at', { ascending: true }).limit(50),
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
      plan: hasProAccess(workspace) ? 'pro' : 'free',
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
    const messages: AIMessage[] = [
      { role: 'system', content: systemPrompt },
      ...turns,
    ]

    return createChatStream(messages)
  } catch (error) {
    console.error('feedback_deo_ai_chat_request_failed', { name: error instanceof Error ? error.name : 'unknown' })
    return NextResponse.json({ error: 'Feedback Deo AI could not complete that request. Please try again.' }, { status: 500 })
  }
}
