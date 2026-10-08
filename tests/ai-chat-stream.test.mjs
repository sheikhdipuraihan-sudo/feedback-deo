import assert from 'node:assert/strict'
import test from 'node:test'

const { chooseFinalChatText } = await import('../lib/ai/chat-stream.ts')

test('uses the completed response when it contains more than a short streamed draft', () => {
  const final = 'Here is a complete answer with specific context, useful reasoning, and several practical next steps.'
  assert.equal(chooseFinalChatText('We recommend', final), final)
})

test('preserves the streamed response when a provider final event is truncated', () => {
  const streamed = 'The complete response arrived in the stream and contains useful context.'
  assert.equal(chooseFinalChatText(streamed, 'The complete response'), streamed)
})

test('handles an empty stream or empty finalized value safely', () => {
  assert.equal(chooseFinalChatText('', 'A complete answer.'), 'A complete answer.')
  assert.equal(chooseFinalChatText('A streamed answer.', ''), 'A streamed answer.')
})
