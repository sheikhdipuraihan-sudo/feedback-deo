export type AIMessage = {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export type AIProviderName = 'OpenRouter' | 'Gemini' | 'Groq'

type AIProvider = {
  name: AIProviderName
  url: string
  apiKey: string
  model: string
  headers?: Record<string, string>
  tokenLimitField: 'max_tokens' | 'max_completion_tokens'
}

type CompletionOptions = {
  messages: AIMessage[]
  temperature: number
  maxTokens: number
}

type ChatCompletionPayload = {
  model?: string
  choices?: Array<{
    finish_reason?: string | null
    message?: {
      content?: unknown
      refusal?: string | null
    }
  }>
}

type StreamPayload = {
  error?: unknown
  choices?: Array<{
    finish_reason?: string | null
    delta?: { content?: unknown; refusal?: string | null }
    message?: { refusal?: string | null }
  }>
}

type StreamFrame = { text?: string; done?: boolean; refused?: boolean; error?: boolean }

const PROVIDER_TIMEOUT_MS = 8000

export class AIProvidersUnavailableError extends Error {
  constructor() {
    super('All configured AI providers failed or returned no usable text.')
    this.name = 'AIProvidersUnavailableError'
  }
}

export class AIProviderRefusalError extends Error {
  constructor() {
    super('The AI provider declined this request.')
    this.name = 'AIProviderRefusalError'
  }
}

export class AIProviderStreamInterruptedError extends Error {
  constructor() {
    super('The AI provider stream ended unexpectedly.')
    this.name = 'AIProviderStreamInterruptedError'
  }
}

export function hasAIProvider(): boolean {
  return Boolean(process.env.OPENROUTER_API_KEY || process.env.GEMINI_API_KEY || process.env.GROQ_API_KEY)
}

function getProviders(): AIProvider[] {
  const providers: AIProvider[] = []
  const openRouterKey = process.env.OPENROUTER_API_KEY
  const geminiKey = process.env.GEMINI_API_KEY
  const groqKey = process.env.GROQ_API_KEY

  if (openRouterKey) {
    providers.push({
      name: 'OpenRouter',
      url: 'https://openrouter.ai/api/v1/chat/completions',
      apiKey: openRouterKey,
      model: process.env.OPENROUTER_MODEL || 'openrouter/free',
      headers: {
        'HTTP-Referer': 'https://feedback-deo.vercel.app',
        'X-OpenRouter-Title': 'Feedback Deo AI',
      },
      tokenLimitField: 'max_tokens',
    })
  }

  if (geminiKey) {
    providers.push({
      name: 'Gemini',
      url: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
      apiKey: geminiKey,
      model: process.env.GEMINI_MODEL || 'gemini-3.8-flash',
      tokenLimitField: 'max_tokens',
    })
  }

  if (groqKey) {
    providers.push({
      name: 'Groq',
      url: 'https://api.groq.com/openai/v1/chat/completions',
      apiKey: groqKey,
      model: process.env.GROQ_MODEL || 'openai/gpt-oss-120b',
      tokenLimitField: 'max_completion_tokens',
    })
  }

  return providers
}

function extractText(payload: ChatCompletionPayload | null): { text: string | null; refused: boolean } {
  const choice = payload?.choices?.[0]
  const refusal = typeof choice?.message?.refusal === 'string' && Boolean(choice.message.refusal.trim())
  const finishReason = String(choice?.finish_reason || '').toLowerCase()
  if (refusal || finishReason === 'content_filter' || finishReason === 'safety' || finishReason === 'refusal') {
    return { text: null, refused: true }
  }

  const content = choice?.message?.content
  if (typeof content === 'string') return { text: content.trim() || null, refused: false }
  if (Array.isArray(content)) {
    const text = content.map(part => {
      if (typeof part === 'string') return part
      if (part && typeof part === 'object' && 'text' in part && typeof part.text === 'string') return part.text
      return ''
    }).join('').trim()
    return { text: text || null, refused: false }
  }
  return { text: null, refused: false }
}

function extractDeltaText(content: unknown): string {
  if (typeof content === 'string') return content
  if (Array.isArray(content)) {
    return content.map(part => {
      if (typeof part === 'string') return part
      if (part && typeof part === 'object' && 'text' in part && typeof part.text === 'string') return part.text
      return ''
    }).join('')
  }
  return ''
}

function parseStreamFrame(raw: string): StreamFrame {
  if (raw.trim() === '[DONE]') return { done: true }
  let payload: StreamPayload
  try {
    payload = JSON.parse(raw) as StreamPayload
  } catch {
    return { error: true }
  }
  if (payload.error) return { error: true }
  const choice = payload.choices?.[0]
  const reason = String(choice?.finish_reason || '').toLowerCase()
  const refusal = Boolean(choice?.delta?.refusal?.trim() || choice?.message?.refusal?.trim())
  if (refusal || ['content_filter', 'safety', 'refusal'].includes(reason)) return { refused: true }
  if (reason === 'error') return { error: true }
  return { text: extractDeltaText(choice?.delta?.content) }
}

async function* readOpenAICompatibleSse(body: ReadableStream<Uint8Array>, onFirstText: () => void): AsyncGenerator<string> {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let dataLines: string[] = []
  let streamDone = false

  while (!streamDone) {
    const result = await reader.read()
    buffer += decoder.decode(result.value || new Uint8Array(), { stream: !result.done })
    if (result.done) buffer += decoder.decode()
    const lines = buffer.split(/\r?\n/)
    buffer = result.done ? '' : (lines.pop() || '')
    if (result.done && buffer) lines.push(buffer)

    for (const line of lines) {
      if (line.startsWith(':')) continue
      if (line.startsWith('data:')) {
        dataLines.push(line.slice(5).replace(/^ /, ''))
        continue
      }
      if (line !== '' || dataLines.length === 0) continue

      const frame = parseStreamFrame(dataLines.join('\n'))
      dataLines = []
      if (frame.refused) throw new AIProviderRefusalError()
      if (frame.error) throw new Error('provider_stream_error')
      if (frame.done) { streamDone = true; break }
      if (frame.text) {
        onFirstText()
        yield frame.text
      }
    }

    if (result.done && dataLines.length) {
      const frame = parseStreamFrame(dataLines.join('\n'))
      dataLines = []
      if (frame.refused) throw new AIProviderRefusalError()
      if (frame.error) throw new Error('provider_stream_error')
      if (frame.done) streamDone = true
      if (frame.text) {
        onFirstText()
        yield frame.text
      }
      streamDone = true
    } else if (result.done) {
      streamDone = true
    }
  }
  try { reader.releaseLock() } catch { /* the upstream stream may already be closed */ }
}

export async function generateAIText(options: CompletionOptions): Promise<{ text: string; provider: AIProviderName }> {
  const providers = getProviders()
  if (!providers.length) throw new AIProvidersUnavailableError()

  for (const provider of providers) {
    try {
      const response = await fetch(provider.url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${provider.apiKey}`,
          'Content-Type': 'application/json',
          ...provider.headers,
        },
        body: JSON.stringify({
          model: provider.model,
          temperature: options.temperature,
          [provider.tokenLimitField]: options.maxTokens,
          messages: options.messages,
        }),
        cache: 'no-store',
        signal: AbortSignal.timeout(PROVIDER_TIMEOUT_MS),
      })

      const payload = await response.json().catch(() => null) as ChatCompletionPayload | null
      if (!response.ok) {
        console.warn('feedback_deo_ai_provider_failed', { provider: provider.name, model: provider.model, status: response.status })
        continue
      }

      const result = extractText(payload)
      if (result.refused) throw new AIProviderRefusalError()
      if (!result.text) {
        const choice = payload?.choices?.[0]
        const content = choice?.message?.content
        console.warn('feedback_deo_ai_provider_empty', {
          provider: provider.name,
          requestedModel: provider.model,
          resolvedModel: payload?.model || 'unknown',
          finishReason: choice?.finish_reason || 'unknown',
          contentType: content === null ? 'null' : Array.isArray(content) ? 'array' : typeof content,
          contentLength: typeof content === 'string' ? content.length : Array.isArray(content) ? content.length : 0,
        })
        continue
      }

      if (provider.name !== providers[0].name) {
        console.info('feedback_deo_ai_fallback_succeeded', { provider: provider.name })
      }
      return { text: result.text, provider: provider.name }
    } catch (error) {
      if (error instanceof AIProviderRefusalError) throw error
      console.warn('feedback_deo_ai_provider_unavailable', {
        provider: provider.name,
        model: provider.model,
        reason: error instanceof Error && error.name === 'TimeoutError' ? 'timeout' : 'network_or_invalid_response',
      })
    }
  }

  throw new AIProvidersUnavailableError()
}

export async function* streamAIText(options: CompletionOptions): AsyncGenerator<string> {
  const providers = getProviders()
  if (!providers.length) throw new AIProvidersUnavailableError()

  for (const provider of providers) {
    const controller = new AbortController()
    let emittedText = false
    let receivedFirstText = false
    const firstTextTimer = setTimeout(() => controller.abort(), PROVIDER_TIMEOUT_MS)
    try {
      const response = await fetch(provider.url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${provider.apiKey}`,
          'Content-Type': 'application/json',
          ...provider.headers,
        },
        body: JSON.stringify({
          model: provider.model,
          temperature: options.temperature,
          [provider.tokenLimitField]: options.maxTokens,
          messages: options.messages,
          stream: true,
        }),
        cache: 'no-store',
        signal: controller.signal,
      })

      if (!response.ok) {
        console.warn('feedback_deo_ai_stream_provider_failed', { provider: provider.name, status: response.status })
        continue
      }
      if (!response.body) {
        console.warn('feedback_deo_ai_stream_provider_empty', { provider: provider.name, reason: 'missing_body' })
        continue
      }

      for await (const delta of readOpenAICompatibleSse(response.body, () => {
        if (!receivedFirstText) {
          receivedFirstText = true
          clearTimeout(firstTextTimer)
        }
      })) {
        emittedText = true
        yield delta
      }

      if (!emittedText) {
        console.warn('feedback_deo_ai_stream_provider_empty', { provider: provider.name })
        continue
      }
      if (provider.name !== providers[0].name) {
        console.info('feedback_deo_ai_stream_fallback_succeeded', { provider: provider.name })
      }
      return
    } catch (error) {
      if (error instanceof AIProviderRefusalError) throw error
      if (emittedText) throw new AIProviderStreamInterruptedError()
      console.warn('feedback_deo_ai_stream_provider_unavailable', {
        provider: provider.name,
        reason: error instanceof Error && error.name === 'AbortError' ? 'first_text_timeout' : 'network_or_invalid_stream',
      })
    } finally {
      clearTimeout(firstTextTimer)
    }
  }

  throw new AIProvidersUnavailableError()
}
