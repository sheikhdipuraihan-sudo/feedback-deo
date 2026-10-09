const SITEVERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify'

type SiteverifyResult = { success?: boolean; hostname?: string }

export async function verifyTurnstileToken(token: unknown, expectedHostname: string): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY
  if (!secret || typeof token !== 'string' || !token || token.length > 2048) {
    if (!secret) console.error('turnstile_secret_not_configured')
    return false
  }

  try {
    const response = await fetch(SITEVERIFY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ secret, response: token }),
      signal: AbortSignal.timeout(10000),
    })
    if (!response.ok) throw new Error(`Siteverify returned ${response.status}`)
    const result = await response.json() as SiteverifyResult
    return result.success === true && result.hostname?.toLowerCase() === expectedHostname.toLowerCase()
  } catch (error) {
    console.error('turnstile_siteverify_failed', error instanceof Error ? error.message : 'unknown error')
    return false
  }
}
