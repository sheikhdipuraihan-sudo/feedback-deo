export async function notifyTelegram(payload: {
  workspace_slug: string
  event: 'feedback' | 'payment_submitted' | 'payment_updated'
  rating?: number
  comment?: string
  transaction_id?: string
  status?: string
  note?: string | null
}) {
  try {
    await fetch('/api/telegram/notify', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) })
  } catch {
    // Notifications must never block feedback or payment actions.
  }
}
