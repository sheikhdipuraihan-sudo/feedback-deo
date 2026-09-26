'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { BarChart3, Check, Copy, ExternalLink, LogOut, Plus, RefreshCw, Star } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

type Workspace = { id: string; name: string; slug: string; plan: 'free' | 'pro' }
type Feedback = { id: string; rating: number; comment: string; created_at: string }
type FeedbackTable = { id: string; name: string; created_at: string }
type CachePayload = { workspace: Workspace | null; tables: FeedbackTable[]; feedback: Feedback[] }

export const dynamic = 'force-dynamic'
const CACHE_PREFIX = 'feedback-deo-dashboard:'

export default function DashboardPage() {
  const router = useRouter()
  const supabase = createClient()
  const [workspace, setWorkspace] = useState<Workspace | null>(null)
  const [tables, setTables] = useState<FeedbackTable[]>([])
  const [feedback, setFeedback] = useState<Feedback[]>([])
  const [newSpace, setNewSpace] = useState('')
  const [newTable, setNewTable] = useState('')
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [copied, setCopied] = useState('')

  const cacheKey = workspace ? `${CACHE_PREFIX}${workspace.id}` : `${CACHE_PREFIX}current`
  const saveCache = useCallback((payload: CachePayload) => {
    try { sessionStorage.setItem(`${CACHE_PREFIX}current`, JSON.stringify(payload)); sessionStorage.setItem(cacheKey, JSON.stringify(payload)) } catch {}
  }, [cacheKey])

  const hydrateCache = useCallback(() => {
    try {
      const cached = sessionStorage.getItem(`${CACHE_PREFIX}current`)
      if (!cached) return false
      const parsed = JSON.parse(cached) as CachePayload
      setWorkspace(parsed.workspace || null)
      setTables(parsed.tables || [])
      setFeedback(parsed.feedback || [])
      return true
    } catch { return false }
  }, [])

  const load = useCallback(async (background = false) => {
    if (!supabase) { setError('Supabase is not configured for this deployment.'); setLoading(false); return }
    if (background) setRefreshing(true)
    else setLoading(true)
    setError('')
    const { data: authData, error: authError } = await supabase.auth.getUser()
    if (authError || !authData.user) { router.replace('/?auth=login'); return }

    const workspaceResult = await supabase.from('workspaces').select('id,name,slug,plan').eq('owner_id', authData.user.id).order('created_at', { ascending: true }).limit(1).maybeSingle()
    if (workspaceResult.error) { setError('We could not load your workspace. Please refresh and try again.'); setLoading(false); setRefreshing(false); return }
    const nextWorkspace = workspaceResult.data as Workspace | null
    setWorkspace(nextWorkspace)
    if (!nextWorkspace) {
      setTables([]); setFeedback([]); setLoading(false); setRefreshing(false); saveCache({ workspace: null, tables: [], feedback: [] }); return
    }

    const [tablesResult, feedbackResult] = await Promise.all([
      supabase.from('tables').select('id,name,created_at').eq('workspace_id', nextWorkspace.id).order('created_at', { ascending: true }),
      supabase.from('feedback').select('id,rating,comment,created_at').eq('workspace_id', nextWorkspace.id).order('created_at', { ascending: false }).limit(100),
    ])
    if (tablesResult.error || feedbackResult.error) setError('Your workspace loaded, but some data could not be refreshed.')
    const nextTables = (tablesResult.data || []) as FeedbackTable[]
    const nextFeedback = (feedbackResult.data || []) as Feedback[]
    setTables(nextTables); setFeedback(nextFeedback)
    saveCache({ workspace: nextWorkspace, tables: nextTables, feedback: nextFeedback })
    setLoading(false); setRefreshing(false)
  }, [router, saveCache, supabase])

  useEffect(() => { void Promise.resolve().then(hydrateCache); void Promise.resolve().then(() => load(true)) }, [hydrateCache, load])

  async function createWorkspace(event: React.FormEvent) {
    event.preventDefault()
    if (!supabase || !newSpace.trim()) return
    setSaving(true); setMessage(''); setError('')
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.replace('/?auth=login'); return }
    const base = newSpace.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'feedback-space'
    const slug = `${base}-${crypto.randomUUID().slice(0, 6)}`
    const { error: insertError } = await supabase.from('workspaces').insert({ owner_id: user.id, name: newSpace.trim(), slug })
    if (insertError) setError(insertError.code === '23505' ? 'That space name is already in use. Please try another.' : 'Could not create the space. Please try again.')
    else { setNewSpace(''); setMessage('Your feedback space is ready.'); await load(true) }
    setSaving(false)
  }

  async function createTable(event: React.FormEvent) {
    event.preventDefault()
    if (!supabase || !workspace || !newTable.trim()) return
    setSaving(true); setMessage(''); setError('')
    const { error: insertError } = await supabase.from('tables').insert({ workspace_id: workspace.id, name: newTable.trim() })
    if (insertError) setError('Could not add that table. Please try again.')
    else { setNewTable(''); setMessage('Table link created.'); await load(true) }
    setSaving(false)
  }

  async function copyLink(link: string) {
    try { await navigator.clipboard.writeText(link); setCopied(link); window.setTimeout(() => setCopied(''), 1800) } catch { setError('Copy failed. You can select the link manually.') }
  }

  async function signOut() { if (supabase) await supabase.auth.signOut(); router.replace('/') }
  const average = useMemo(() => feedback.length ? (feedback.reduce((sum, item) => sum + item.rating, 0) / feedback.length).toFixed(1) : '—', [feedback])
  const monthFeedbackCount = useMemo(() => { const start = new Date(); start.setDate(1); start.setHours(0, 0, 0, 0); return feedback.filter(item => new Date(item.created_at) >= start).length }, [feedback])
  const publicLink = workspace ? `${window.location.origin}/feedback/${workspace.slug}` : ''

  if (loading && !workspace) return <main className="dashboard-page"><div className="dashboard-shell"><p>Loading your workspace…</p></div></main>
  return <main className="dashboard-page"><div className="dashboard-shell">
    <header className="dashboard-header"><Link className="brand" href="/">feedback <span>deo</span>.</Link><div className="dash-actions"><button className="icon-button" onClick={() => void load(true)} disabled={refreshing} aria-label="Refresh dashboard"><RefreshCw className={refreshing ? 'spin' : ''} /></button><button className="logout" onClick={signOut}><LogOut /> Log out</button></div></header>
    <div className="dashboard-title"><div><p className="kicker">YOUR WORKSPACE</p><h1>{workspace?.name || 'Welcome to Feedback Deo'}</h1><p>Collect honest feedback and turn it into your next best decision.</p></div></div>
    {error && <p className="form-error" role="alert">{error}</p>}
    {message && <p className="form-success" role="status">{message}</p>}
    {!workspace ? <section className="setup-card"><div className="setup-icon"><Plus /></div><h2>Create your first feedback space</h2><p>Start with your business name, then share your public feedback link with customers.</p><form onSubmit={createWorkspace}><input value={newSpace} onChange={(event) => setNewSpace(event.target.value)} placeholder="The Commons Café" required /><button className="button green" disabled={saving}>{saving ? 'Creating…' : 'Create space'} <Plus /></button></form></section> : <>
      <div className="stats-grid"><div className="stat-card"><small>AVERAGE RATING</small><strong>{average} <Star className="stat-star" fill="currentColor" /></strong><span>{workspace?.plan === 'pro' ? 'Unlimited on Pro' : `Free plan · ${monthFeedbackCount}/30 this month`}</span></div><div className="stat-card"><small>TOTAL FEEDBACK</small><strong>{feedback.length}</strong><span>Anonymous responses</span></div><div className="stat-card"><small>SPACE STATUS</small><strong className="status-live">Live</strong><span>Ready to collect</span></div></div>
      <section className="share-panel"><div><p className="kicker">YOUR PUBLIC LINK</p><h2>Start collecting feedback</h2><p>Share this link or scan the QR code with any phone camera.</p></div><div className="share-content"><div className="qr-card"><QRCodeSVG value={publicLink} size={156} bgColor="#ffffff" fgColor="#132b26" includeMargin /><strong>Scan to leave feedback</strong></div><div className="share-actions"><div className="share-row"><input readOnly value={publicLink} aria-label="Public feedback link" /><button className="button outline" onClick={() => void copyLink(publicLink)}>{copied === publicLink ? <Check /> : <Copy />} {copied === publicLink ? 'Copied' : 'Copy link'}</button><a className="button outline" href={publicLink} target="_blank" rel="noreferrer"><ExternalLink /> Open</a></div></div></div></section>
      <section className="tables-panel"><div className="panel-heading"><div><h2>Tables</h2><p>Create a unique link for each table.</p></div></div><form className="inline-form" onSubmit={createTable}><input value={newTable} onChange={event => setNewTable(event.target.value)} placeholder="Table 1" required /><button className="button green" disabled={saving}><Plus /> Add table</button></form>{tables.length > 0 && <div className="table-list">{tables.map(table => { const link = `${window.location.origin}/feedback/${workspace.slug}?table=${table.id}`; return <div className="table-row" key={table.id}><div className="table-qr"><QRCodeSVG value={link} size={72} bgColor="#ffffff" fgColor="#132b26" includeMargin /></div><strong>{table.name}</strong><input readOnly value={link} aria-label={`${table.name} feedback link`} /><button className="icon-button" onClick={() => void copyLink(link)} aria-label={`Copy ${table.name} link`}>{copied === link ? <Check /> : <Copy />}</button><a className="icon-button" href={link} target="_blank" rel="noreferrer" aria-label={`Open ${table.name} link`}><ExternalLink /></a></div> })}</div>}</section>
      <section className="feedback-panel"><div className="panel-heading"><div><h2>Recent feedback</h2><p>What your customers are saying.</p></div><button className="button outline" onClick={() => void load(true)}><RefreshCw /> Refresh</button></div>{feedback.length === 0 ? <div className="empty-feedback"><BarChart3 /><h3>No feedback yet</h3><p>Share your public link with customers to see responses here.</p></div> : <div className="feedback-list">{feedback.map(item => <article className="feedback-row" key={item.id}><div className="rating" aria-label={`${item.rating} out of 5 stars`}>{'★'.repeat(item.rating)}<span>{'★'.repeat(5 - item.rating)}</span></div><p>{item.comment}</p><time>{new Date(item.created_at).toLocaleString()}</time></article>)}</div>}</section>
    </>}
  </div></main>
}
