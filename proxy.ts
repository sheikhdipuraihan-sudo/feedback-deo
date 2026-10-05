import { NextResponse, type NextRequest } from 'next/server'

export function proxy(request: NextRequest) {
  if (!request.cookies.get('feedback_deo_session')?.value) return NextResponse.redirect(new URL('/?auth=login', request.url))
  return NextResponse.next()
}

export const config = { matcher: ['/dashboard/:path*', '/payment/:path*', '/admin/:path*'] }
