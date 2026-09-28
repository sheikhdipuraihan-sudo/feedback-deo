'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Activity,
  BadgeCheck,
  Ban,
  Building2,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Clock3,
  LogOut,
  RefreshCw,
  Search,
  ShieldCheck,
  X,
} from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { signOut as firebaseSignOut } from 'firebase/auth'
import { createClient } from '@/lib/supabase/client'
import { firebaseAuth } from '@/lib/firebase/client'
import Preloader from '@/components/Preloader'
import { notifyTelegram } from '@/lib/telegram'
import {
  ADMIN_PAGE_SIZE,
  filterPayments,
  filterWorkspaces,
  getAdminSummary,
  paginateItems,
  type AdminPayment,
  type AdminWorkspace,
  type PaymentStatusFilter,
  type WorkspacePlanFilter,
  type WorkspaceStatusFilter,
} from '@/lib/admin/subscriptions'

function formatDate(value: string, includeTime = true) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleString(undefined, includeTime
    ? { dateStyle: 'medium', timeStyle: 'short' }
    : { dateStyle: 'medium' })
}

function formatClock(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function authorizationOrFallback(message: string, fallback: string) {
  return message.toLowerCase().includes('admin')
    ? 'Your account is not authorized as an admin.'
    : fallback
}

type PaginationProps = {
  label: string
  page: number
  pageCount: number
  start: number
  end: number
  total: number
  onPageChange: (page: number) => void
}

function AdminPagination({ label, page, pageCount, start, end, total, onPageChange }: PaginationProps) {
  return <nav className="admin-pagination" aria-label={`${label} pagination`}>
    <span>Showing <strong>{start}–{end}</strong> of <strong>{total}</strong></span>
    {pageCount > 1 && <div className="admin-page-controls">
      <button type="button" className="icon-button" onClick={() => onPageChange(page - 1)} disabled={page <= 1} aria-label="Previous page"><ChevronLeft /></button>
      <span>Page {page} of {pageCount}</span>
      <button type="button" className="icon-button" onClick={() => onPageChange(page + 1)} disabled={page >= pageCount} aria-label="Next page"><ChevronRight /></button>
    </div>}
  </nav>
}

export default function AdminSubscriptionsPage() {
  const router = useRouter()
  const supabase = createClient()
  const [payments, setPayments] = useState<AdminPayment[]>([])
  const [workspaces, setWorkspaces] = useState<AdminWorkspace[]>([])
  const [search, setSearch] = useState('')
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatusFilter>('all')
  const [workspacePlan, setWorkspacePlan] = useState<WorkspacePlanFilter>('all')
  const [workspaceStatus, setWorkspaceStatus] = useState<WorkspaceStatusFilter>('all')
  const [paymentPage, setPaymentPage] = useState(1)
  const [workspacePage, setWorkspacePage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [busyId, setBusyId] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [note, setNote] = useState<Record<string, string>>({})
  const [lastRefreshedAt, setLastRefreshedAt] = useState<string | null>(null)

  const load = useCallback(async (background = false) => {
    if (!supabase) {
      setError('Supabase is not configured for this deployment.')
      setLoading(false)
      setRefreshing(false)
      return
    }
    if (background) setRefreshing(true)
    else setLoading(true)
    setError('')
    if (!background) setMessage('')
    try {
      const [paymentResult, workspaceResult] = await Promise.all([
        supabase.rpc('get_subscription_payments'),
        supabase.rpc('get_admin_workspaces'),
      ])
      if (paymentResult.error || workspaceResult.error) {
        const rpcMessage = paymentResult.error?.message || workspaceResult.error?.message || ''
        setError(authorizationOrFallback(rpcMessage, 'Admin access is required, or the data could not be loaded.'))
        return
      }
      setPayments((paymentResult.data || []) as AdminPayment[])
      setWorkspaces((workspaceResult.data || []) as AdminWorkspace[])
      setPaymentPage(1)
      setWorkspacePage(1)
      setLastRefreshedAt(new Date().toISOString())
    } catch {
      setError('Could not load admin data. Check your connection and try again.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [supabase])

  useEffect(() => { void Promise.resolve().then(() => load()) }, [load])

  const filteredPayments = useMemo(
    () => filterPayments(payments, search, paymentStatus),
    [payments, search, paymentStatus],
  )
  const filteredWorkspaces = useMemo(
    () => filterWorkspaces(workspaces, search, workspacePlan, workspaceStatus),
    [workspaces, search, workspacePlan, workspaceStatus],
  )
  const summary = useMemo(() => getAdminSummary(workspaces, payments), [workspaces, payments])
  const paymentResults = useMemo(
    () => paginateItems(filteredPayments, paymentPage, ADMIN_PAGE_SIZE),
    [filteredPayments, paymentPage],
  )
  const workspaceResults = useMemo(
    () => paginateItems(filteredWorkspaces, workspacePage, ADMIN_PAGE_SIZE),
    [filteredWorkspaces, workspacePage],
  )

  function updateSearch(value: string) {
    setSearch(value)
    setPaymentPage(1)
    setWorkspacePage(1)
  }

  async function review(payment: AdminPayment, decision: 'approved' | 'rejected') {
    if (!supabase) return
    setBusyId(payment.id)
    setError('')
    setMessage('')
    try {
      const { error: reviewError } = await supabase.rpc('review_subscription_payment', {
        payment_id: payment.id,
        decision,
        note: note[payment.id] || null,
      })
      if (reviewError) {
        setError(authorizationOrFallback(reviewError.message, 'Could not update this payment.'))
        return
      }
      setMessage(`Payment ${payment.transaction_id} marked ${decision}.`)
      void notifyTelegram({ workspace_slug: payment.workspace_slug, event: 'payment_updated', transaction_id: payment.transaction_id, status: decision })
      await load(true)
    } catch {
      setError('Could not update this payment. Check your connection and try again.')
    } finally {
      setBusyId('')
    }
  }

  async function changePlan(workspace: AdminWorkspace, plan: 'free' | 'pro') {
    if (!supabase || !window.confirm(`Change ${workspace.name} to ${plan}?`)) return
    setBusyId(workspace.id)
    setError('')
    setMessage('')
    try {
      const { error: planError } = await supabase.rpc('set_workspace_plan', {
        workspace_uuid: workspace.id,
        target_plan: plan,
      })
      if (planError) {
        setError(authorizationOrFallback(planError.message, 'Could not change the plan.'))
        return
      }
      setMessage(`${workspace.name} is now on ${plan}.`)
      await load(true)
    } catch {
      setError('Could not change the plan. Check your connection and try again.')
    } finally {
      setBusyId('')
    }
  }

  async function changeStatus(workspace: AdminWorkspace) {
    if (!supabase) return
    const target = workspace.status === 'banned' ? 'active' : 'banned'
    if (!window.confirm(`${target === 'banned' ? 'Ban' : 'Unban'} ${workspace.name}?`)) return
    setBusyId(workspace.id)
    setError('')
    setMessage('')
    try {
      const { error: statusError } = await supabase.rpc('set_workspace_status', {
        workspace_uuid: workspace.id,
        target_status: target,
      })
      if (statusError) {
        setError(authorizationOrFallback(statusError.message, 'Could not change the workspace status.'))
        return
      }
      setMessage(`${workspace.name} is now ${target}.`)
      await load(true)
    } catch {
      setError('Could not change the workspace status. Check your connection and try again.')
    } finally {
      setBusyId('')
    }
  }

  async function signOut() {
    await firebaseSignOut(firebaseAuth)
    router.replace('/')
  }

  if (loading) return <Preloader label="Loading admin dashboard…" />

  const paymentFilterOptions: { value: PaymentStatusFilter; label: string; count: number }[] = [
    { value: 'all', label: 'All', count: payments.length },
    { value: 'pending', label: 'Pending', count: payments.filter(payment => payment.status === 'pending').length },
    { value: 'approved', label: 'Approved', count: payments.filter(payment => payment.status === 'approved').length },
    { value: 'rejected', label: 'Rejected', count: payments.filter(payment => payment.status === 'rejected').length },
  ]

  return <main className="dashboard-page">
    <div className="dashboard-shell standalone-shell admin-console">
      <header className="dashboard-header admin-header">
        <Link className="brand" href="/">feedback <span>deo</span>.</Link>
        <div className="dash-actions">
          <Link className="admin-open-dashboard" href="/dashboard">Open dashboard</Link>
          <button className="icon-button" type="button" onClick={() => void load(true)} disabled={refreshing} aria-label="Refresh admin data" title="Refresh admin data">
            <RefreshCw className={refreshing ? 'spin' : ''} />
          </button>
          <button className="logout" type="button" onClick={signOut}><LogOut /> Log out</button>
        </div>
      </header>

      <div className="admin-title">
        <div>
          <p className="kicker">ADMIN CONSOLE</p>
          <h1>Operations overview</h1>
          <p>Review subscription payments and manage business workspaces.</p>
        </div>
        <ShieldCheck aria-hidden="true" />
      </div>

      {error && <p className="form-error" role="alert">{error}</p>}
      {message && <p className="form-success" role="status">{message}</p>}

      <section className="admin-summary-grid" aria-label="Business overview metrics">
        <article className="admin-metric-card">
          <span className="admin-metric-icon"><Building2 aria-hidden="true" /></span>
          <p>Total businesses</p>
          <strong>{summary.totalWorkspaces.toLocaleString()}</strong>
          <small>{summary.activeWorkspaces.toLocaleString()} active workspaces</small>
        </article>
        <article className="admin-metric-card">
          <span className="admin-metric-icon"><BadgeCheck aria-hidden="true" /></span>
          <p>Active Pro</p>
          <strong>{summary.activeProWorkspaces.toLocaleString()}</strong>
          <small>Pro plan and active status</small>
        </article>
        <article className="admin-metric-card">
          <span className="admin-metric-icon pending"><Clock3 aria-hidden="true" /></span>
          <p>Pending payments</p>
          <strong>{summary.pendingPayments.toLocaleString()}</strong>
          <small>Awaiting admin review</small>
        </article>
        <article className="admin-metric-card">
          <span className="admin-metric-icon blocked"><Ban aria-hidden="true" /></span>
          <p>Banned businesses</p>
          <strong>{summary.bannedWorkspaces.toLocaleString()}</strong>
          <small>Access currently restricted</small>
        </article>
      </section>

      <div className="admin-search-row">
        <label className="admin-search">
          <Search aria-hidden="true" />
          <input
            value={search}
            onChange={event => updateSearch(event.target.value)}
            placeholder="Search businesses, owner IDs, or transaction IDs"
            aria-label="Search businesses, owners, and payment transactions"
          />
          {search && <button type="button" onClick={() => updateSearch('')} aria-label="Clear search"><X /></button>}
        </label>
        <span className="admin-refresh-status" aria-live="polite">
          <Activity aria-hidden="true" />
          {refreshing ? 'Refreshing…' : lastRefreshedAt ? `Updated ${formatClock(lastRefreshedAt)}` : 'Live data'}
        </span>
      </div>

      <section className="admin-panel" aria-labelledby="admin-payments-heading">
        <div className="admin-panel-toolbar">
          <div className="panel-heading">
            <div>
              <h2 id="admin-payments-heading">Payment requests</h2>
              <p>{filteredPayments.length.toLocaleString()} matching request{filteredPayments.length === 1 ? '' : 's'} · pending items are prioritized</p>
            </div>
          </div>
          <div className="admin-filter-pills" role="group" aria-label="Filter payment requests by status">
            {paymentFilterOptions.map(option => <button
              type="button"
              key={option.value}
              className={`admin-filter-pill${paymentStatus === option.value ? ' active' : ''}`}
              aria-pressed={paymentStatus === option.value}
              onClick={() => { setPaymentStatus(option.value); setPaymentPage(1) }}
            >{option.label}<span>{option.count}</span></button>)}
          </div>
        </div>

        {paymentResults.total === 0 ? <div className="admin-empty">No payment requests match the current search and status filter.</div> : <>
          <div className="admin-payment-list">
            {paymentResults.items.map(payment => <article className="admin-payment" key={payment.id}>
              <div className="admin-payment-top">
                <div>
                  <strong>{payment.workspace_name}</strong>
                  <small>Business ID: {payment.workspace_slug}</small>
                  <small>Submitted by: <code>{payment.submitted_by}</code></small>
                  <small>Transaction ID: <code>{payment.transaction_id}</code></small>
                </div>
                <span className={`payment-status ${payment.status}`}>{payment.status}</span>
              </div>
              <div className="admin-payment-meta">
                <span className="admin-payment-amount">৳{payment.amount.toLocaleString('en-BD')}</span>
                <span>bKash {payment.bkash_number}</span>
                <time dateTime={payment.created_at}>Submitted {formatDate(payment.created_at)}</time>
                {payment.reviewed_at && <time dateTime={payment.reviewed_at}>Reviewed {formatDate(payment.reviewed_at)}</time>}
              </div>
              {payment.status === 'pending' && <div className="admin-review">
                <input
                  value={note[payment.id] || ''}
                  onChange={event => setNote(current => ({ ...current, [payment.id]: event.target.value }))}
                  placeholder="Optional review note"
                  aria-label={`Optional review note for ${payment.transaction_id}`}
                  disabled={busyId === payment.id}
                />
                <button className="button green" type="button" onClick={() => void review(payment, 'approved')} disabled={busyId === payment.id}>
                  <Check /> {busyId === payment.id ? 'Saving…' : 'Approve & upgrade'}
                </button>
                <button className="button reject" type="button" onClick={() => void review(payment, 'rejected')} disabled={busyId === payment.id}>
                  <X /> Reject
                </button>
              </div>}
              {payment.admin_note && <p className="admin-note">Review note: {payment.admin_note}</p>}
            </article>)}
          </div>
          <AdminPagination label="Payment requests" {...paymentResults} onPageChange={setPaymentPage} />
        </>}
      </section>

      <section className="admin-panel" aria-labelledby="admin-workspaces-heading">
        <div className="admin-panel-toolbar admin-workspace-toolbar">
          <div className="panel-heading">
            <div>
              <h2 id="admin-workspaces-heading">Business workspaces</h2>
              <p>{filteredWorkspaces.length.toLocaleString()} matching workspace{filteredWorkspaces.length === 1 ? '' : 's'} · manage plan and access</p>
            </div>
          </div>
          <div className="admin-select-filters">
            <label>
              <span>Plan</span>
              <select aria-label="Filter businesses by plan" value={workspacePlan} onChange={event => { setWorkspacePlan(event.target.value as WorkspacePlanFilter); setWorkspacePage(1) }}>
                <option value="all">All plans</option>
                <option value="free">Free</option>
                <option value="pro">Pro</option>
              </select>
            </label>
            <label>
              <span>Status</span>
              <select aria-label="Filter businesses by status" value={workspaceStatus} onChange={event => { setWorkspaceStatus(event.target.value as WorkspaceStatusFilter); setWorkspacePage(1) }}>
                <option value="all">All statuses</option>
                <option value="active">Active</option>
                <option value="banned">Banned</option>
              </select>
            </label>
          </div>
        </div>

        {workspaceResults.total === 0 ? <div className="admin-empty">No businesses match the current search and filters.</div> : <>
          <div className="admin-workspace-list">
            {workspaceResults.items.map(workspace => <article className="admin-workspace" key={workspace.id}>
              <div className="admin-workspace-identity">
                <strong>{workspace.name}</strong>
                <code>{workspace.slug}</code>
                <small>Owner ID: <code>{workspace.owner_id}</code></small>
                <small>Created {formatDate(workspace.created_at, false)}</small>
              </div>
              <div className="admin-workspace-actions">
                <span className={`payment-status ${workspace.plan}`}>{workspace.plan}</span>
                <span className={`payment-status ${workspace.status}`}>{workspace.status}</span>
                <button className="button outline" type="button" onClick={() => void changePlan(workspace, workspace.plan === 'pro' ? 'free' : 'pro')} disabled={busyId === workspace.id}>
                  {workspace.plan === 'pro' ? 'Downgrade to Free' : 'Upgrade to Pro'} {workspace.plan === 'pro' ? <ChevronDown /> : <ChevronUp />}
                </button>
                <button className={`button ${workspace.status === 'banned' ? 'outline' : 'reject'}`} type="button" onClick={() => void changeStatus(workspace)} disabled={busyId === workspace.id}>
                  {busyId === workspace.id ? 'Saving…' : workspace.status === 'banned' ? 'Unban' : 'Ban'}
                </button>
              </div>
            </article>)}
          </div>
          <AdminPagination label="Business workspaces" {...workspaceResults} onPageChange={setWorkspacePage} />
        </>}
      </section>
    </div>
  </main>
}
