import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

type NotificationBody = {
  workspace_slug?: string
  event?: 'feedback' | 'payment_submitted' | 'payment_updated'
  rating?: number
  comment?: string
  transaction_id?: string
  status?: string
  note?: string | null
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as NotificationBody
    if (!body.workspace_slug || !body.event) return NextResponse.json({ ok: false }, { status: 400 })
    const supabase = await createClient()
    const { data, error } = await supabase.rpc('get_telegram_notification_target', { workspace_slug: body.workspace_slug })
    const target = Array.isArray(data) ? data[0] : data
    if (error || !target?.webhook_url) return NextResponse.json({ ok: true, connected: false })
    const payload = {
      event: body.event,
      workspace_slug: body.workspace_slug,
      rating: body.rating,
      comment: body.comment?.slice(0, 2000),
      transaction_id: body.transaction_id,
      status: body.status,
      note: body.note?.slice(0, 500) || null,
    }
    const response = await fetch(target.webhook_url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload), signal: AbortSignal.timeout(8000) })
    return NextResponse.json({ ok: response.ok, connected: true })
  } catch {
    return NextResponse.json({ ok: false }, { status: 200 })
  }
}
