import { NextResponse } from 'next/server'
import { getSessionUser, getAuthAdminClient } from '@/lib/auth/server'
import { registerReferralOwnerDevice } from '@/lib/referrals/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function unavailable() {
  return NextResponse.json(
    { error: 'Refer & Earn is temporarily unavailable. Please try again later.' },
    { status: 503, headers: { 'Cache-Control': 'private, no-store' } },
  )
}

export async function GET() {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'Please sign in to open Refer & Earn.' }, { status: 401 })
  if (!user.email_verified) return NextResponse.json({ error: 'Verify your email before sharing a referral link.' }, { status: 403 })

  try {
    const { code } = await registerReferralOwnerDevice(user.id)
    const { data, error } = await getAuthAdminClient().rpc('get_referral_overview', { p_owner_id: user.id })
    if (error) {
      if (error.message.includes('email_verification_required')) {
        return NextResponse.json({ error: 'Verify your email before sharing a referral link.' }, { status: 403 })
      }
      return unavailable()
    }
    const overview = Array.isArray(data) ? data[0] : data
    if (!overview) return unavailable()
    const appOrigin = (process.env.NEXT_PUBLIC_APP_URL || 'https://feedback-deo.vercel.app').replace(/\/+$/, '')
    const referralProActive = Boolean(overview.referral_pro_until && Date.parse(overview.referral_pro_until) > Date.now())
    return NextResponse.json(
      { ...overview, referral_pro_active: referralProActive, referral_link: `${appOrigin}/r/${code}` },
      { headers: { 'Cache-Control': 'private, no-store' } },
    )
  } catch {
    return unavailable()
  }
}

export async function POST() {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'Please sign in to redeem referral points.' }, { status: 401 })

  try {
    const { data, error } = await getAuthAdminClient().rpc('redeem_referral_reward', { p_owner_id: user.id })
    if (error) {
      const message = error.message.toLowerCase()
      if (message.includes('email_verification_required')) return NextResponse.json({ error: 'Verify your email before redeeming points.' }, { status: 403 })
      if (message.includes('active_workspace_required')) return NextResponse.json({ error: 'Create an active business workspace before redeeming points.' }, { status: 409 })
      if (message.includes('workspace_already_pro')) return NextResponse.json({ error: 'Your active workspace already has paid Pro. Your points are saved; redeem them after it returns to Free.' }, { status: 409 })
      if (message.includes('not_enough_referral_points')) return NextResponse.json({ error: 'You need 5 unused, verified referral points to redeem one month.' }, { status: 409 })
      return unavailable()
    }
    return NextResponse.json(
      { ...(data || {}), message: 'One month of Referral Pro has been added to your workspace.' },
      { headers: { 'Cache-Control': 'private, no-store' } },
    )
  } catch {
    return unavailable()
  }
}
