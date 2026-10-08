export type OpenRouterChatMessage = {
  role: 'system' | 'user' | 'assistant'
  content: string
}

type OpenRouterOptions = {
  fetcher?: typeof fetch
  referer?: string
  maxTokens?: number
  temperature?: number
}

export class OpenRouterRequestError extends Error {
  readonly status?: number

  constructor(message: string, status?: number) {
    super(message)
    this.name = 'OpenRouterRequestError'
    this.status = status
  }
}

function errorForStatus(status: number, providerMessage: string) {
  if (status === 401 || status === 403) return 'OpenRouter rejected this API key. Check that it is valid and enabled, then reconnect it.'
  if (status === 402) return 'OpenRouter could not use the free-model route for this account or key. No paid model is configured; check the key/account status or try again later.'
  if (status === 429) return 'OpenRouter’s free-model request limit was reached. Wait a while and try again.'
  if (status === 503 || status === 502) return 'OpenRouter’s free models are temporarily unavailable. Please try again later.'
  return providerMessage ? `OpenRouter could not complete the request: ${providerMessage.slice(0, 240)}` : `OpenRouter could not complete the request (HTTP ${status}).`
}

export function openRouterErrorForStatus(status: number, providerMessage = '') {
  return errorForStatus(status, providerMessage)
}

export async function* streamOpenRouterChat(
  messages: OpenRouterChatMessage[],
  apiKey: string,
  options: OpenRouterOptions = {},
): AsyncGenerator<string> {
  const fetcher = options.fetcher || fetch
  const referer = options.referer || (typeof window !== 'undefined' ? window.location.origin : '')
  if (!apiKey.trim()) throw new OpenRouterRequestError('Add your own OpenRouter API key to continue.')
  if (!referer) throw new OpenRouterRequestError('OpenRouter needs a browser origin to identify this app.')

  const response = await fetcher('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey.trim()}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': referer,
      'X-Title': 'Feedback Deo',
    },
    body: JSON.stringify({
      model: 'openrouter/free',
      messages,
      stream: true,
      max_tokens: options.maxTokens ?? 1200,
      temperature: options.temperature ?? 0.35,
    }),
  })

  if (!response.ok) {
    let providerMessage = ''
    try {
      const payload = await response.json() as { error?: { message?: string } | string; message?: string }
      providerMessage = typeof payload.error === 'string'
        ? payload.error
        : payload.error?.message || payload.message || ''
    } catch { /* use the mapped status message */ }
    throw new OpenRouterRequestError(errorForStatus(response.status, providerMessage), response.status)
  }
  if (!response.body) throw new OpenRouterRequestError('OpenRouter returned no response stream.')

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let dataLines: string[] = []
  let streamEnded = false

  const parsePendingEvent = (): string | null => {
    if (!dataLines.length) return null
    const raw = dataLines.join('\n').trim()
    dataLines = []
    if (!raw || raw === '[DONE]') { streamEnded = raw === '[DONE]'; return null }

    let payload: {
      error?: { message?: string } | string
      choices?: Array<{
        delta?: { content?: string | Array<{ type?: string; text?: string }> }
        finish_reason?: string | null
      }>
    }
    try { payload = JSON.parse(raw) as typeof payload }
    catch { throw new OpenRouterRequestError('OpenRouter returned an unreadable response chunk.') }

    if (payload.error) {
      const message = typeof payload.error === 'string' ? payload.error : payload.error.message || ''
      throw new OpenRouterRequestError(errorForStatus(502, message), 502)
    }
    const choice = payload.choices?.[0]
    if (choice?.finish_reason === 'error') throw new OpenRouterRequestError('OpenRouter’s free-model stream stopped early. Please try again.')
    const content = choice?.delta?.content
    if (typeof content === 'string') return content
    if (Array.isArray(content)) return content.map(part => part.text || '').join('')
    return null
  }

  const processLine = (line: string): string | null => {
    if (line.startsWith(':') || line.startsWith('event:') || line.startsWith('id:') || line.startsWith('retry:')) return null
    if (line.startsWith('data:')) { dataLines.push(line.slice(5).replace(/^ /, '')); return null }
    if (line === '') return parsePendingEvent()
    return null
  }

  try {
    while (true) {
      const { value, done } = await reader.read()
      buffer += decoder.decode(value || new Uint8Array(), { stream: !done })
      const lines = buffer.split(/\r?\n/)
      buffer = done ? '' : (lines.pop() || '')
      for (const line of lines) {
        const text = processLine(line)
        if (text) yield text
        if (streamEnded) return
      }
      if (done) {
        if (buffer) {
          const text = processLine(buffer)
          if (text) yield text
        }
        const text = parsePendingEvent()
        if (text) yield text
        return
      }
    }
  } finally {
    reader.releaseLock()
  }
}
