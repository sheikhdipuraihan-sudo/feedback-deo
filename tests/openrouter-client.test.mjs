import test from 'node:test'
import assert from 'node:assert/strict'

const { streamOpenRouterChat, OpenRouterRequestError, openRouterErrorForStatus } = await import('../lib/ai/openrouter-client.ts')

async function collect(generator) {
  const parts = []
  for await (const part of generator) parts.push(part)
  return parts
}

function responseFromChunks(chunks, status = 200) {
  const encoder = new TextEncoder()
  return new Response(new ReadableStream({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk))
      controller.close()
    },
  }), { status, headers: { 'Content-Type': 'text/event-stream' } })
}

test('uses only the zero-cost OpenRouter free router and sends the user key directly to OpenRouter', async () => {
  let requestUrl
  let requestInit
  const fetcher = async (url, init) => {
    requestUrl = url
    requestInit = init
    return responseFromChunks(['data: {"choices":[{"delta":{"content":"A complete"}}]}\n\n', 'data: {"choices":[{"delta":{"content":" answer."}}]}\n\n', 'data: [DONE]\n\n'])
  }
  const parts = await collect(streamOpenRouterChat(
    [{ role: 'user', content: 'Hello' }],
    'sk-or-user-owned-test-key',
    { fetcher, referer: 'https://feedbackdeo.sites.bd', maxTokens: 1400, temperature: 0.2 },
  ))

  assert.equal(requestUrl, 'https://openrouter.ai/api/v1/chat/completions')
  assert.equal(requestInit.method, 'POST')
  assert.equal(requestInit.headers.Authorization, 'Bearer sk-or-user-owned-test-key')
  assert.equal(requestInit.headers['HTTP-Referer'], 'https://feedbackdeo.sites.bd')
  assert.equal(requestInit.headers['X-Title'], 'Feedback Deo')
  const body = JSON.parse(requestInit.body)
  assert.equal(body.model, 'openrouter/free')
  assert.equal(body.stream, true)
  assert.equal(body.max_tokens, 1400)
  assert.equal(body.temperature, 0.2)
  assert.deepEqual(parts, ['A complete', ' answer.'])
})

test('maps free-model limits and key errors to clear user messages', () => {
  assert.match(openRouterErrorForStatus(401), /API key/i)
  assert.match(openRouterErrorForStatus(402), /No paid model is configured/i)
  assert.match(openRouterErrorForStatus(429), /limit was reached/i)
})

test('rejects an empty key without making an API request', async () => {
  let called = false
  const fetcher = async () => { called = true; return new Response(null, { status: 200 }) }
  await assert.rejects(
    collect(streamOpenRouterChat([{ role: 'user', content: 'Hello' }], '  ', { fetcher, referer: 'https://feedbackdeo.sites.bd' })),
    OpenRouterRequestError,
  )
  assert.equal(called, false)
})

test('reports an OpenRouter rate-limit error returned before streaming starts', async () => {
  const fetcher = async () => new Response(JSON.stringify({ error: { message: 'Rate limit reached' } }), { status: 429 })
  await assert.rejects(
    collect(streamOpenRouterChat([{ role: 'user', content: 'Hello' }], 'sk-or-user-owned-test-key', { fetcher, referer: 'https://feedbackdeo.sites.bd' })),
    error => error instanceof OpenRouterRequestError && error.status === 429 && /limit was reached/i.test(error.message),
  )
})
