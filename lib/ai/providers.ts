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
  choices?: Array<{
    finish_reason?: string | null
    message?: {
      content?: unknown
      refusal?: string | null
    }
  }>
}

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
      model: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',
      tokenLimitField: 'max_completion_tokens',
    })
  }

  return providers
}

function extractText(payload: ChatCompletionPayload | null): { text: string | null; refused: boolean } {
  const choice = payload?.choices?.[0]
  const refusal = typeof choice?.message?.refusal === 'string' && Boolean(choice.message.refusal.trim())
  const finishReason = String(choice?.finish_reason || '').toLowerCase()
  if (refusal || finishReason === 'content_filter' || finishReason === 'safety') {
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
        console.warn('feedback_deo_ai_provider_failed', { provider: provider.name, status: response.status })
        continue
      }

      const result = extractText(payload)
      if (result.refused) throw new AIProviderRefusalError()
      if (!result.text) {
        console.warn('feedback_deo_ai_provider_empty', { provider: provider.name })
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
        reason: error instanceof Error && error.name === 'TimeoutError' ? 'timeout' : 'network_or_invalid_response',
      })
    }
  }

  throw new AIProvidersUnavailableError()
}
