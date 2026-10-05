import { handleGoogleCallback } from '@/app/api/auth/google/route'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  return handleGoogleCallback(request)
}
