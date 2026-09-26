import { createBrowserClient } from '@supabase/ssr'
import type { SupabaseClient } from '@supabase/supabase-js'
import { firebaseAuth } from '@/lib/firebase/client'

let browserClient: SupabaseClient | null = null

export function createClient() {
  if (browserClient) return browserClient
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) return null
  browserClient = createBrowserClient(url, key, { accessToken: async () => firebaseAuth.currentUser ? firebaseAuth.currentUser.getIdToken() : null })
  return browserClient
}
