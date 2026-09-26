import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  try {
    const body = await request.json() as { link_token?: string; chat_id?: string; username?: string; webhook_url?: string }
    if (!body.link_token || !body.chat_id || !body.webhook_url) return NextResponse.json({ error: 'Missing Telegram connection details.' }, { status: 400 })
    const supabase = await createClient()
    const { error } = await supabase.rpc('claim_telegram_connection', {
      link_token: body.link_token,
      telegram_chat_id: String(body.chat_id),
      telegram_username: body.username || '',
      notification_webhook_url: body.webhook_url,
    })
    if (error) return NextResponse.json({ error: 'This connection code is invalid or expired.' }, { status: 400 })
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Could not connect Telegram.' }, { status: 400 })
  }
}
