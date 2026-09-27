'use client'

import { useCallback, useEffect, useState } from 'react'
import { ArrowLeft, CheckCircle2, CreditCard, ExternalLink, ShieldCheck } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { signOut as firebaseSignOut } from 'firebase/auth'
import { createClient } from '@/lib/supabase/client'
import { waitForFirebaseUser } from '@/lib/firebase/client'
import Preloader from '@/components/Preloader'
import { notifyTelegram } from '@/lib/telegram'

type Workspace = { id: string; name: string; slug: string; plan: 'free' | 'pro'; status: 'active' | 'banned' }
type Payment = { id: string; transaction_id: string; status: 'pending' | 'approved' | 'rejected'; created_at: string; admin_note: string | null }

export default function PaymentPage() {
  const router = useRouter()
  const supabase = createClient()
  const [workspace, setWorkspace] = useState<Workspace | null>(null)
  const [payments, setPayments] = useState<Payment[]>([])
  const [transactionId, setTransactionId] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    if (!supabase) { setError('Supabase is not configured for this deployment.'); setLoading(false); return }
    const user = await waitForFirebaseUser()
    if (!user) { router.replace('/?auth=login'); return }
    const { data, error: workspaceError } = await supabase.from('workspaces').select('id,name,slug,plan,status').eq('owner_id', user.uid).order('created_at', { ascending: true }).limit(1).maybeSingle()
    if (workspaceError) setError('Could not load your café. Please try again.')
    setWorkspace(data as Workspace | null)
    if (data) {
      const paymentResult = await supabase.from('subscription_payments').select('id,transaction_id,status,created_at,admin_note').eq('workspace_id', data.id).order('created_at', { ascending: false }).limit(5)
      setPayments((paymentResult.data || []) as Payment[])
    }
    setLoading(false)
  }, [router, supabase])

  useEffect(() => { void Promise.resolve().then(() => load()) }, [load])

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!supabase || !workspace || !transactionId.trim()) return
    setSaving(true); setError(''); setMessage('')
    const user = await waitForFirebaseUser()
    if (!user) { router.replace('/?auth=login'); return }
    const { error: insertError } = await supabase.from('subscription_payments').insert({ workspace_id: workspace.id, submitted_by: user.uid, amount: 49, bkash_number: '01939357037', transaction_id: transactionId.trim(), requested_plan: 'pro' })
    if (insertError) setError(insertError.code === '23505' ? 'That transaction ID has already been submitted.' : 'Could not submit the payment. Please check the transaction ID and try again.')
    else {
      setMessage('Payment submitted for admin review. Your plan will change after the payment is checked.')
      void notifyTelegram({ workspace_slug: workspace.slug, event: 'payment_submitted', transaction_id: transactionId.trim(), status: 'pending' })
      setTransactionId(''); await load()
    }
    setSaving(false)
  }

  if (loading) return <main className="dashboard-page"><div className="dashboard-shell standalone-shell"><Preloader label="Loading payment page…" /></div></main>
  if (workspace?.status === 'banned') return <main className="dashboard-page"><div className="dashboard-shell standalone-shell"><Link className="back-link" href="/dashboard"><ArrowLeft /> Back to dashboard</Link><section className="payment-card"><h1>Workspace suspended</h1><p>This workspace cannot submit payment requests while it is suspended.</p></section></div></main>
  if (!workspace) return <main className="dashboard-page"><div className="dashboard-shell standalone-shell"><Link className="back-link" href="/dashboard"><ArrowLeft /> Back to dashboard</Link><section className="payment-card"><h1>Create your café space first</h1><p>You need a café workspace before upgrading.</p><Link className="button green" href="/dashboard">Open dashboard</Link></section></div></main>

  return <main className="dashboard-page"><div className="dashboard-shell standalone-shell"><Link className="back-link" href="/dashboard"><ArrowLeft /> Back to dashboard</Link><section className="payment-card"><div className="payment-icon"><CreditCard /></div><p className="kicker">FEEDBACK DEO PRO</p><h1>Upgrade {workspace.name}</h1><p className="payment-lead">Get unlimited feedback for this café. Submit your bKash transaction ID and an admin will verify it.</p>{workspace.plan === 'pro' ? <div className="payment-success"><CheckCircle2 /><strong>This café is already on Pro.</strong><span>Unlimited feedback is active.</span></div> : <><div className="payment-amount"><span>Monthly Pro plan</span><strong>৳49</strong></div><div className="bkash-box"><strong>Send ৳49 via bKash</strong><p>Merchant / personal number</p><code>01939357037</code><small>Use your bKash payment transaction ID below. Never share your bKash PIN.</small></div><div className="uid-box"><span>Your café UID</span><code>{workspace.slug}</code></div><form className="payment-form" onSubmit={submit}><label>bKash transaction ID<input value={transactionId} onChange={event => setTransactionId(event.target.value)} placeholder="Example: 8A72K9QX" required /></label>{error && <p className="form-error" role="alert">{error}</p>}{message && <p className="form-success" role="status">{message}</p>}<button className="button green full" disabled={saving}>{saving ? 'Submitting…' : 'Submit payment for review'} <ShieldCheck /></button></form></>}<p className="payment-note"><ShieldCheck /> We only need the transaction ID and café UID. Never share your bKash PIN or password.</p></section>{payments.length > 0 && <section className="payment-history"><h2>Payment submissions</h2>{payments.map(payment => <div className="payment-history-row" key={payment.id}><div><strong>{payment.transaction_id}</strong><small>{new Date(payment.created_at).toLocaleString()}</small></div><span className={`payment-status ${payment.status}`}>{payment.status}</span></div>)}</section>}<a className="payment-help" href="https://feedback-deo.vercel.app/#pricing" target="_blank" rel="noreferrer">View plan details <ExternalLink /></a></div></main>
}
