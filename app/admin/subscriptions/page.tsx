'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Check, ChevronDown, ChevronUp, LogOut, RefreshCw, Search, ShieldCheck, X } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { signOut as firebaseSignOut } from 'firebase/auth'
import { createClient } from '@/lib/supabase/client'
import { firebaseAuth } from '@/lib/firebase/client'
import Preloader from '@/components/Preloader'
import { notifyTelegram } from '@/lib/telegram'

type Payment = { id: string; workspace_id: string; workspace_name: string; workspace_slug: string; submitted_by: string; amount: number; bkash_number: string; transaction_id: string; status: 'pending' | 'approved' | 'rejected'; admin_note: string | null; created_at: string; reviewed_at: string | null }
type Workspace = { id: string; name: string; slug: string; plan: 'free' | 'pro'; status: 'active' | 'banned'; owner_id: string; created_at: string }

export default function AdminSubscriptionsPage() {
  const router = useRouter()
  const supabase = createClient()
  const [payments, setPayments] = useState<Payment[]>([])
  const [workspaces, setWorkspaces] = useState<Workspace[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [busyId, setBusyId] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [note, setNote] = useState<Record<string, string>>({})

  const load = useCallback(async (background = false) => {
    if (!supabase) { setError('Supabase is not configured for this deployment.'); setLoading(false); return }
    if (background) setRefreshing(true); else setLoading(true)
    setError(''); setMessage('')
    const [paymentResult, workspaceResult] = await Promise.all([supabase.rpc('get_subscription_payments'), supabase.rpc('get_admin_workspaces')])
    if (paymentResult.error || workspaceResult.error) setError('Admin access is required, or the data could not be loaded.')
    setPayments((paymentResult.data || []) as Payment[])
    setWorkspaces((workspaceResult.data || []) as Workspace[])
    setLoading(false); setRefreshing(false)
  }, [supabase])

  useEffect(() => { void Promise.resolve().then(() => load()) }, [load])

  const filteredWorkspaces = useMemo(() => { const term = search.trim().toLowerCase(); if (!term) return workspaces; return workspaces.filter(item => `${item.name} ${item.slug} ${item.id} ${item.owner_id}`.toLowerCase().includes(term)) }, [search, workspaces])
  const filteredPayments = useMemo(() => { const term = search.trim().toLowerCase(); if (!term) return payments; return payments.filter(item => `${item.workspace_name} ${item.workspace_slug} ${item.transaction_id} ${item.status}`.toLowerCase().includes(term)) }, [search, payments])

  async function review(payment: Payment, decision: 'approved' | 'rejected') {
    if (!supabase) return
    setBusyId(payment.id); setError(''); setMessage('')
    const { error: reviewError } = await supabase.rpc('review_subscription_payment', { payment_id: payment.id, decision, note: note[payment.id] || null })
    if (reviewError) setError(reviewError.message.includes('admin') ? 'Your account is not authorized as an admin.' : 'Could not update this payment.')
    else {
      setMessage(`Payment ${payment.transaction_id} marked ${decision}.`)
      void notifyTelegram({ workspace_slug: payment.workspace_slug, event: 'payment_updated', transaction_id: payment.transaction_id, status: decision })
      await load(true)
    }
    setBusyId('')
  }

  async function changePlan(workspace: Workspace, plan: 'free' | 'pro') {
    if (!supabase || !window.confirm(`Change ${workspace.name} to ${plan}?`)) return
    setBusyId(workspace.id); setError(''); setMessage('')
    const { error: planError } = await supabase.rpc('set_workspace_plan', { workspace_uuid: workspace.id, target_plan: plan })
    if (planError) setError(planError.message.includes('admin') ? 'Your account is not authorized as an admin.' : 'Could not change the plan.')
    else { setMessage(`${workspace.name} is now on ${plan}.`); await load(true) }
    setBusyId('')
  }

  async function signOut() { await firebaseSignOut(firebaseAuth); router.replace('/') }

  async function changeStatus(workspace: Workspace) {
    if (!supabase) return
    const target = workspace.status === 'banned' ? 'active' : 'banned'
    if (!window.confirm(`${target === 'banned' ? 'Ban' : 'Unban'} ${workspace.name}?`)) return
    setBusyId(workspace.id); setError(''); setMessage('')
    const { error: statusError } = await supabase.rpc('set_workspace_status', { workspace_uuid: workspace.id, target_status: target })
    if (statusError) setError(statusError.message.includes('admin') ? 'Your account is not authorized as an admin.' : 'Could not change the workspace status.')
    else { setMessage(`${workspace.name} is now ${target}.`); await load(true) }
    setBusyId('')
  }

  if (loading) return <main className="dashboard-page"><div className="dashboard-shell standalone-shell"><Preloader label="Loading admin dashboard…" /></div></main>
  return <main className="dashboard-page"><div className="dashboard-shell standalone-shell"><header className="dashboard-header"><Link className="brand" href="/">feedback <span>deo</span>.</Link><div className="dash-actions"><button className="icon-button" onClick={() => void load(true)} disabled={refreshing} aria-label="Refresh admin data"><RefreshCw className={refreshing ? 'spin' : ''} /></button><button className="logout" onClick={signOut}><LogOut /> Log out</button></div></header><div className="admin-title"><div><p className="kicker">ADMIN CONSOLE</p><h1>Subscriptions</h1><p>Review bKash payments and manage café plans.</p></div><ShieldCheck /></div>{error && <p className="form-error" role="alert">{error}</p>}{message && <p className="form-success" role="status">{message}</p>}<div className="admin-search"><Search /><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search by café name, UID, transaction ID, or owner ID" aria-label="Search cafés and payments" />{search && <button onClick={() => setSearch('')} aria-label="Clear search">×</button>}</div><section className="admin-panel"><div className="panel-heading"><div><h2>Payment requests</h2><p>{filteredPayments.length} matching request{filteredPayments.length === 1 ? '' : 's'}</p></div></div>{filteredPayments.length === 0 ? <div className="admin-empty">No payment requests match this search.</div> : <div className="admin-payment-list">{filteredPayments.map(payment => <article className="admin-payment" key={payment.id}><div className="admin-payment-top"><div><strong>{payment.workspace_name}</strong><small>UID: {payment.workspace_slug}</small><small>bKash transaction: <code>{payment.transaction_id}</code></small></div><span className={`payment-status ${payment.status}`}>{payment.status}</span></div><div className="admin-payment-meta"><span>৳{payment.amount}</span><span>{payment.bkash_number}</span><time>{new Date(payment.created_at).toLocaleString()}</time></div>{payment.status === 'pending' && <div className="admin-review"><input value={note[payment.id] || ''} onChange={event => setNote(current => ({ ...current, [payment.id]: event.target.value }))} placeholder="Optional review note" /><button className="button green" onClick={() => void review(payment, 'approved')} disabled={busyId === payment.id}><Check /> Approve & upgrade</button><button className="button reject" onClick={() => void review(payment, 'rejected')} disabled={busyId === payment.id}><X /> Reject</button></div>}{payment.admin_note && <p className="admin-note">Note: {payment.admin_note}</p>}</article>)}</div>}</section><section className="admin-panel"><div className="panel-heading"><div><h2>All cafés</h2><p>Search by name or immutable UID and change plan access.</p></div></div>{filteredWorkspaces.length === 0 ? <div className="admin-empty">No cafés match this search.</div> : <div className="admin-workspace-list">{filteredWorkspaces.map(workspace => <article className="admin-workspace" key={workspace.id}><div><strong>{workspace.name}</strong><code>{workspace.slug}</code><small>Created {new Date(workspace.created_at).toLocaleDateString()}</small></div><div className="admin-workspace-actions"><span className={`payment-status ${workspace.plan}`}>{workspace.plan}</span><span className={`payment-status ${workspace.status}`}>{workspace.status}</span><button className="button outline" onClick={() => void changePlan(workspace, workspace.plan === 'pro' ? 'free' : 'pro')} disabled={busyId === workspace.id}>{workspace.plan === 'pro' ? 'Downgrade to Free' : 'Upgrade to Pro'} {workspace.plan === 'pro' ? <ChevronDown /> : <ChevronUp />}</button><button className={`button ${workspace.status === 'banned' ? 'outline' : 'reject'}`} onClick={() => void changeStatus(workspace)} disabled={busyId === workspace.id}>{workspace.status === 'banned' ? 'Unban' : 'Ban'}</button></div></article>)}</div>}</section></div></main>
}
