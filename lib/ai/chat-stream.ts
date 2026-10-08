export function chooseFinalChatText(streamed: string, finalized: string): string {
  const streamedText = streamed.trim()
  const finalizedText = finalized.trim()
  if (!streamedText) return finalizedText
  if (!finalizedText) return streamedText

  // A provider stream can omit chunks even when the server's final assembled
  // response is complete. Prefer that response when it contains more text,
  // while preserving a longer stream if a provider's final value is truncated.
  return finalizedText.length > streamedText.length ? finalizedText : streamedText
}
