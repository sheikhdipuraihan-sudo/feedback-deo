export async function notifyTelegram(payload: {
  workspace_slug: string
  event: 'feedback'
  rating?: number
  comment?: string
}) {
  try {
    await fetch('/api/telegram/notify', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) })
  } catch {
    // Notifications must never block feedback or feedback actions.
  }
}
