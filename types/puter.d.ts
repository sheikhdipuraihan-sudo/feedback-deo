export {}

declare global {
  interface PuterChatMessage {
    role: 'system' | 'user' | 'assistant'
    content: string
  }

  interface PuterChatChunk {
    text?: string
  }

  interface PuterUser {
    username?: string
  }

  interface PuterApi {
    auth: {
      isSignedIn(): boolean
      getUser(): Promise<PuterUser>
      signIn(options?: { attempt_temp_user_creation?: boolean; request_auth?: boolean }): Promise<unknown>
      signOut(): Promise<unknown>
    }
    ai: {
      chat(
        messages: PuterChatMessage[],
        testMode: boolean,
        options: {
          model: string
          stream: true
          max_tokens: number
          temperature: number
          verbosity?: 'low' | 'medium' | 'high'
        },
      ): Promise<AsyncIterable<PuterChatChunk>>
    }
  }

  interface Window {
    puter?: PuterApi
  }
}
