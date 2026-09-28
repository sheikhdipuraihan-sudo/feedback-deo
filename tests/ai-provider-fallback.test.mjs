import assert from 'node:assert/strict'
import { afterEach, test } from 'node:test'

const providerEnvNames = ['OPENROUTER_API_KEY', 'GEMINI_API_KEY', 'GROQ_API_KEY']
const originalFetch = globalThis.fetch
const originalEnv = Object.fromEntries(providerEnvNames.map(name => [name, process.env[name]]))
const {
  AIProviderRefusalError,
  AIProviderStreamInterruptedError,
  AIProvidersUnavailableError,
  generateAIText,
  streamAIText,
} = await import('../lib/ai/providers.ts')

function configureProviders() {
  process.env.OPENROUTER_API_KEY = 'test-openrouter-key'
  process.env.GEMINI_API_KEY = 'test-gemini-key'
  process.env.GROQ_API_KEY = 'test-groq-key'
}

function jsonResponse(status, payload) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

function sseResponse(frames) {
  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    start(controller) {
      for (const frame of frames) controller.enqueue(encoder.encode(frame))
      controller.close()
    },
  })
  return new Response(stream, { status: 200, headers: { 'content-type': 'text/event-stream' } })
}

function getHost(input) {
  return new URL(String(input)).hostname
}

function completionRequest(init) {
  return JSON.parse(init.body)
}

afterEach(() => {
  globalThis.fetch = originalFetch
  for (const name of providerEnvNames) {
    if (originalEnv[name] === undefined) delete process.env[name]
    else process.env[name] = originalEnv[name]
  }
})

test('falls through a throttled OpenRouter and empty Gemini response to Groq', async () => {
  configureProviders()
  const calls = []
  globalThis.fetch = async input => {
    const host = getHost(input)
    calls.push(host)
    if (host === 'openrouter.ai') return jsonResponse(429, { error: { code: 'rate_limit' } })
    if (host === 'generativelanguage.googleapis.com') return jsonResponse(200, { choices: [{ message: { content: '  ' } }] })
    return jsonResponse(200, { choices: [{ message: { content: 'Groq fallback is working.' } }] })
  }

  const result = await generateAIText({ messages: [{ role: 'user', content: 'Summarize these ratings.' }], temperature: 0.2, maxTokens: 200 })
  assert.equal(result.text, 'Groq fallback is working.')
  assert.equal(result.provider, 'Groq')
  assert.deepEqual(calls, ['openrouter.ai', 'generativelanguage.googleapis.com', 'api.groq.com'])
})

test('uses Gemini after an OpenRouter server error', async () => {
  configureProviders()
  const calls = []
  globalThis.fetch = async input => {
    const host = getHost(input)
    calls.push(host)
    if (host === 'openrouter.ai') return jsonResponse(503, { error: { code: 'overloaded' } })
    return jsonResponse(200, { choices: [{ message: { content: 'Gemini fallback is working.' } }] })
  }

  const result = await generateAIText({ messages: [{ role: 'user', content: 'Summarize these ratings.' }], temperature: 0.2, maxTokens: 200 })
  assert.equal(result.text, 'Gemini fallback is working.')
  assert.equal(result.provider, 'Gemini')
  assert.deepEqual(calls, ['openrouter.ai', 'generativelanguage.googleapis.com'])
})

test('streams SSE deltas and sets the provider stream flag', async () => {
  configureProviders()
  let requestBody
  globalThis.fetch = async (_input, init) => {
    requestBody = completionRequest(init)
    return sseResponse([
      'data: {"choices":[{"delta":{"content":"Hello "},"finish_reason":null}]}\n\n',
      'data: {"choices":[{"delta":{"content":"there."},"finish_reason":null}]}\n\n',
      'data: [DONE]\n\n',
    ])
  }

  const deltas = []
  for await (const delta of streamAIText({ messages: [{ role: 'user', content: 'Hello' }], temperature: 0.2, maxTokens: 100 })) deltas.push(delta)
  assert.equal(deltas.join(''), 'Hello there.')
  assert.equal(requestBody.stream, true)
})

test('falls back to Gemini when OpenRouter returns an empty stream', async () => {
  configureProviders()
  const calls = []
  globalThis.fetch = async input => {
    const host = getHost(input)
    calls.push(host)
    if (host === 'openrouter.ai') return sseResponse(['data: [DONE]\n\n'])
    return sseResponse([
      'data: {"choices":[{"delta":{"content":"Gemini streamed fallback."},"finish_reason":null}]}\n\n',
      'data: [DONE]\n\n',
    ])
  }

  const deltas = []
  for await (const delta of streamAIText({ messages: [{ role: 'user', content: 'Answer' }], temperature: 0.2, maxTokens: 100 })) deltas.push(delta)
  assert.equal(deltas.join(''), 'Gemini streamed fallback.')
  assert.deepEqual(calls, ['openrouter.ai', 'generativelanguage.googleapis.com'])
})

test('does not fall through to another provider after a structured refusal', async () => {
  configureProviders()
  const calls = []
  globalThis.fetch = async input => {
    calls.push(getHost(input))
    return sseResponse(['data: {"choices":[{"delta":{"refusal":"blocked"},"finish_reason":"content_filter"}]}\n\n'])
  }

  await assert.rejects(
    async () => { for await (const _delta of streamAIText({ messages: [{ role: 'user', content: 'A request.' }], temperature: 0.2, maxTokens: 100 })) { /* no text expected */ } },
    AIProviderRefusalError,
  )
  assert.deepEqual(calls, ['openrouter.ai'])
})

test('reports an interruption after partial output instead of silently falling back', async () => {
  configureProviders()
  const calls = []
  globalThis.fetch = async input => {
    calls.push(getHost(input))
    if (calls.length === 1) {
      let sent = false
      const encoder = new TextEncoder()
      const stream = new ReadableStream({
        pull(controller) {
          if (!sent) {
            sent = true
            controller.enqueue(encoder.encode('data: {"choices":[{"delta":{"content":"Partial"},"finish_reason":null}]}\n\n'))
          } else {
            controller.error(new Error('socket closed'))
          }
        },
      })
      return new Response(stream, { status: 200, headers: { 'content-type': 'text/event-stream' } })
    }
    return sseResponse(['data: {"choices":[{"delta":{"content":"should not be used"}}]}\n\n'])
  }

  const deltas = []
  await assert.rejects(async () => {
    for await (const delta of streamAIText({ messages: [{ role: 'user', content: 'A request.' }], temperature: 0.2, maxTokens: 100 })) deltas.push(delta)
  }, AIProviderStreamInterruptedError)
  assert.equal(deltas.join(''), 'Partial')
  assert.deepEqual(calls, ['openrouter.ai'])
})

test('keeps structured refusals terminal for non-streamed completions', async () => {
  configureProviders()
  const calls = []
  globalThis.fetch = async input => {
    calls.push(getHost(input))
    return jsonResponse(200, { choices: [{ finish_reason: 'content_filter', message: { content: null } }] })
  }

  await assert.rejects(
    generateAIText({ messages: [{ role: 'user', content: 'A request.' }], temperature: 0.2, maxTokens: 100 }),
    AIProviderRefusalError,
  )
  assert.deepEqual(calls, ['openrouter.ai'])
})

test('fails cleanly when all configured providers return no usable text', async () => {
  configureProviders()
  globalThis.fetch = async () => jsonResponse(200, { choices: [{ message: { content: null } }] })
  await assert.rejects(generateAIText({ messages: [{ role: 'user', content: 'A request.' }], temperature: 0.2, maxTokens: 100 }), AIProvidersUnavailableError)
})

test('fails without making a request if no provider key is configured', async () => {
  for (const name of providerEnvNames) delete process.env[name]
  let called = false
  globalThis.fetch = async () => { called = true; return jsonResponse(200, { choices: [{ message: { content: 'unexpected' } }] }) }
  await assert.rejects(generateAIText({ messages: [{ role: 'user', content: 'A request.' }], temperature: 0.2, maxTokens: 100 }), AIProvidersUnavailableError)
  assert.equal(called, false)
})
