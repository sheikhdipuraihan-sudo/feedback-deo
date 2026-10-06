'use client'

import { useCallback, useEffect, useState } from 'react'
import { Check, Copy, Gift, Link2, LockKeyhole, RefreshCw, Users } from 'lucide-react'
import { useRouter } from 'next/navigation'
import DashboardPageFrame from '@/components/DashboardPageFrame'
import Preloader from '@/components/Preloader'

type ReferralOverview = {
  referral_code: string
  qualified_total: number
  spent_points: number
  available_points: number
  rewards_claimed: number
  referral_pro_until: string | null
  workspace_id: string | null
  workspace_plan: 'free' | 'pro' | null
  referral_pro_active: boolean
  referral_link: string
}

function formatDate(value: string | null) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', year: 'numeric' }).format(date)
}

export default function ReferralsPage() {
  const router = useRouter()
  const [overview, setOverview] = useState<ReferralOverview | null>(null)
  const [loading, setLoading] = useState(true)
  const [claiming, setClaiming] = useState(false)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const load = useCallback(async () => {
    setError('')
    try {
      const response = await fetch('/api/referrals', { cache: 'no-store' })
      const result = await response.json().catch(() => ({})) as ReferralOverview & { error?: string }
      if (response.status === 401) { router.replace('/?auth=login'); return }
      if (!response.ok) { setError(result.error || 'Could not load referral progress.'); setLoading(false); return }
      setOverview(result)
      setLoading(false)
    } catch {
      setError('Could not connect to the referral service. Please try again.')
      setLoading(false)
    }
  }, [router])

  useEffect(() => { void Promise.resolve().then(() => load()) }, [load])

  async function copyLink() {
    if (!overview?.referral_link) return
    try {
      await navigator.clipboard.writeText(overview.referral_link)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1800)
    } catch {
      setError('Copy failed. You can select and copy the referral link manually.')
    }
  }

  async function redeem() {
    setClaiming(true); setError(''); setMessage('')
    try {
      const response = await fetch('/api/referrals', { method: 'POST' })
      const result = await response.json().catch(() => ({})) as { error?: string; message?: string }
      if (response.status === 401) { router.replace('/?auth=login'); return }
      if (!response.ok) setError(result.error || 'Could not redeem referral points.')
      else { setMessage(result.message || 'One month of Referral Pro has been added.'); await load() }
    } catch {
      setError('Could not connect to the referral service. Please try again.')
    } finally {
      setClaiming(false)
    }
  }

  if (loading) return <Preloader label="Loading referral rewards…" />

  const points = Math.max(0, Number(overview?.available_points || 0))
  const qualified = Math.max(0, Number(overview?.qualified_total || 0))
  const unusedTowardNextMonth = points % 5
  const isPaidPro = overview?.workspace_plan === 'pro'
  const bonusActive = Boolean(overview?.referral_pro_active)

  return <DashboardPageFrame mainClassName="referrals-page-shell">
    <section className="referrals-hero">
      <div className="referrals-hero-copy"><p className="kicker">FEEDBACK DEO · REFER &amp; EARN</p><h1>Share Feedback Deo.<br />Earn free Pro months.</h1><p>Invite real businesses. For every 5 qualified referrals, redeem 1 month of Pro. There is no lifetime limit on how many months you can earn.</p></div>
      <div className="referrals-hero-icon"><Gift /></div>
    </section>

    {error && <p className="form-error" role="alert">{error}</p>}
    {message && <p className="form-success" role="status">{message}</p>}

    <section className="referral-link-card">
      <div className="referral-link-icon"><Link2 /></div>
      <div className="referral-link-copy"><p className="kicker">YOUR PERSONAL REFERRAL LINK</p><h2>Invite a business owner</h2><p>They must be a new user, verify their email, and create an active workspace before the referral earns a point.</p><div className="referral-link-field"><input aria-label="Your referral link" readOnly value={overview?.referral_link || ''} /><button type="button" className="button green" onClick={() => void copyLink()}>{copied ? <Check /> : <Copy />}{copied ? 'Copied' : 'Copy link'}</button></div></div>
    </section>

    <section className="referral-stats-grid">
      <article className="referral-stat-card"><div className="referral-stat-icon"><Users /></div><small>QUALIFIED REFERRALS</small><strong>{qualified}</strong><span>New, verified accounts with an active workspace</span></article>
      <article className="referral-stat-card"><div className="referral-stat-icon"><Gift /></div><small>UNSPENT POINTS</small><strong>{points}</strong><span>{Math.floor(points / 5)} {Math.floor(points / 5) === 1 ? 'month' : 'months'} ready to redeem</span></article>
      <article className="referral-stat-card"><div className="referral-stat-icon"><Check /></div><small>MONTHS REDEEMED</small><strong>{Number(overview?.rewards_claimed || 0)}</strong><span>Redeem again every time you earn 5 more points</span></article>
    </section>

    <section className="referral-redeem-card">
      <div className="referral-redeem-top"><div><p className="kicker">NEXT REWARD</p><h2>5 points = 1 month of Pro</h2><p>Each month lasts one calendar month. If you already have paid Pro, your points stay saved until the workspace can use the reward.</p></div><div className="referral-reward-badge"><Gift /><strong>1 month</strong><small>Pro access</small></div></div>
      <div className="referral-progress-track" role="progressbar" aria-label="Progress toward the next month of Pro" aria-valuemin={0} aria-valuemax={5} aria-valuenow={unusedTowardNextMonth}><span style={{ width: `${unusedTowardNextMonth * 20}%` }} /></div>
      <div className="referral-progress-labels"><span>{unusedTowardNextMonth} of 5 points toward your next unclaimed month</span><span>{Math.max(0, 5 - unusedTowardNextMonth)} to go</span></div>
      {!overview?.workspace_id && <p className="referral-requirement"><LockKeyhole /> Create an active business workspace before redeeming points.</p>}
      {isPaidPro && <p className="referral-requirement"><LockKeyhole /> Your paid Pro plan is already active. Points remain saved until your workspace returns to Free.</p>}
      <button className="button green referral-redeem-button" type="button" onClick={() => void redeem()} disabled={claiming || points < 5 || !overview?.workspace_id || isPaidPro}>{claiming ? 'Redeeming…' : 'Redeem 5 points for 1 month'} <Gift /></button>
    </section>

    {bonusActive && <section className="referral-active-card"><Check /><div><strong>Referral Pro is active</strong><span>Current bonus access runs through {formatDate(overview?.referral_pro_until || null)}. New rewards stack after that date.</span></div></section>}

    <section className="referral-rules-card"><h2>How we keep rewards fair</h2><ul><li>Only brand-new accounts count; existing accounts and account linking do not.</li><li>The invited person must verify their email and create an active workspace.</li><li>One referral can be attributed to each account, and each signed browser/device token can earn only one referral credit.</li><li>Self-referrals, duplicate devices, or manipulated signups do not qualify. Referral attribution uses a first-party cookie; clearing or blocking cookies can prevent credit.</li><li>Referral months are separate from paid Pro access and expire; unused points do not expire while your account remains open.</li></ul></section>

    <button type="button" className="button outline referral-refresh" onClick={() => void load()}><RefreshCw /> Refresh referral status</button>
  </DashboardPageFrame>
}
