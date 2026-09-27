'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { ArrowRight, BarChart3, Bell, Check, Copy, CreditCard, Download, ExternalLink, HelpCircle, LayoutDashboard, LogOut, MessageCircle, Pencil, Plus, RefreshCw, Search, Settings2, Star, Store, Trash2, Users } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { signOut as firebaseSignOut } from 'firebase/auth'
import { createClient } from '@/lib/supabase/client'
import { firebaseAuth, waitForFirebaseUser } from '@/lib/firebase/client'
import Preloader from '@/components/Preloader'

type Workspace = { id: string; name: string; slug: string; plan: 'free' | 'pro'; status: 'active' | 'banned' }
type Feedback = { id: string; rating: number; comment: string; created_at: string }
type FeedbackTable = { id: string; name: string; created_at: string }
type CachePayload = { workspace: Workspace | null; tables: FeedbackTable[]; feedback: Feedback[] }
type TelegramConnection = { connected: boolean; telegram_username: string | null; connected_at: string | null }

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
  const [editingName, setEditingName] = useState(false)
  const [workspaceName, setWorkspaceName] = useState('')
  const [telegramConnection, setTelegramConnection] = useState<TelegramConnection | null>(null)
  const [telegramLink, setTelegramLink] = useState('')
  const [telegramLoading, setTelegramLoading] = useState(false)
  const [feedbackQuery, setFeedbackQuery] = useState('')

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
    const user = await waitForFirebaseUser()
    if (!user) { router.replace('/?auth=login'); return }

    const workspaceResult = await supabase.from('workspaces').select('id,name,slug,plan,status').eq('owner_id', user.uid).order('created_at', { ascending: true }).limit(1).maybeSingle()
    if (workspaceResult.error) { setError('We could not load your workspace. Please refresh and try again.'); setLoading(false); setRefreshing(false); return }
    const nextWorkspace = workspaceResult.data as Workspace | null
    setWorkspace(nextWorkspace)
    if (!nextWorkspace) {
      setTables([]); setFeedback([]); setTelegramConnection(null); setLoading(false); setRefreshing(false); saveCache({ workspace: null, tables: [], feedback: [] }); return
    }
    if (nextWorkspace.plan === 'pro') {
      const telegramResult = await supabase.rpc('get_telegram_connection')
      const telegramData = Array.isArray(telegramResult.data) ? telegramResult.data[0] : telegramResult.data
      setTelegramConnection((telegramData || { connected: false, telegram_username: null, connected_at: null }) as TelegramConnection)
    } else setTelegramConnection(null)

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
    const user = await waitForFirebaseUser()
    if (!user) { router.replace('/?auth=login'); return }
    const base = newSpace.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'feedback-space'
    const slug = `${base}-${crypto.randomUUID().slice(0, 6)}`
    const { error: insertError } = await supabase.from('workspaces').insert({ owner_id: user.uid, name: newSpace.trim(), slug })
    if (insertError) setError(insertError.code === '23505' ? 'That space name is already in use. Please try another.' : 'Could not create the space. Please try again.')
    else { setNewSpace(''); setMessage('Your feedback space is ready.'); await load(true) }
    setSaving(false)
  }


  async function renameWorkspace(event: React.FormEvent) {
    event.preventDefault()
    if (!supabase || !workspace || !workspaceName.trim()) return
    setSaving(true); setMessage(''); setError('')
    const { error: updateError } = await supabase.from('workspaces').update({ name: workspaceName.trim() }).eq('id', workspace.id)
    if (updateError) setError('Could not update the café name. Please try again.')
    else { setEditingName(false); setMessage('Café name updated.'); await load(true) }
    setSaving(false)
  }

  async function deleteTable(table: FeedbackTable) {
    if (!supabase || !workspace || !window.confirm(`Delete ${table.name}? Its QR link will stop working.`)) return
    setSaving(true); setMessage(''); setError('')
    const { error: deleteError } = await supabase.from('tables').delete().eq('id', table.id).eq('workspace_id', workspace.id)
    if (deleteError) setError('Could not delete that table. Existing feedback may be linked to it.')
    else { setMessage(`${table.name} deleted.`); await load(true) }
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

  async function connectTelegram() {
    if (!supabase || workspace?.plan !== 'pro') return
    setTelegramLoading(true); setError(''); setMessage('')
    const { data, error: tokenError } = await supabase.rpc('create_telegram_link_token')
    if (tokenError || !data) setError(tokenError?.message.includes('pro') ? 'Telegram notifications are available on Pro.' : 'Could not create a Telegram connection link.')
    else setTelegramLink(`https://t.me/feedbackdeoBoT?start=${data}`)
    setTelegramLoading(false)
  }

  async function copyLink(link: string) {
    try { await navigator.clipboard.writeText(link); setCopied(link); window.setTimeout(() => setCopied(''), 1800) } catch { setError('Copy failed. You can select the link manually.') }
  }

  async function downloadQr(id: string, filename: string) {
    const svg = document.querySelector(`[data-qr-id="${id}"] svg`) as SVGSVGElement | null
    if (!svg) { setError('QR code is not ready yet. Please try again.'); return }
    const source = new XMLSerializer().serializeToString(svg)
    const image = new Image()
    const imageUrl = URL.createObjectURL(new Blob([source], { type: 'image/svg+xml;charset=utf-8' }))
    image.onload = () => {
      const canvas = document.createElement('canvas')
      const size = 1024
      canvas.width = size; canvas.height = size
      const context = canvas.getContext('2d')
      if (!context) return
      context.fillStyle = '#ffffff'; context.fillRect(0, 0, size, size)
      context.drawImage(image, 0, 0, size, size)
      URL.revokeObjectURL(imageUrl)
      canvas.toBlob(blob => {
        if (!blob) return
        const link = document.createElement('a')
        link.href = URL.createObjectURL(blob); link.download = `${filename}.png`; link.click()
        URL.revokeObjectURL(link.href)
      }, 'image/png')
    }
    image.onerror = () => { URL.revokeObjectURL(imageUrl); setError('Could not download this QR code. Please try again.') }
    image.src = imageUrl
  }

  async function signOut() { await firebaseSignOut(firebaseAuth); router.replace('/') }
  const average = useMemo(() => feedback.length ? (feedback.reduce((sum, item) => sum + item.rating, 0) / feedback.length).toFixed(1) : '—', [feedback])
  const monthFeedbackCount = useMemo(() => { const start = new Date(); start.setDate(1); start.setHours(0, 0, 0, 0); return feedback.filter(item => new Date(item.created_at) >= start).length }, [feedback])
  const filteredFeedback = useMemo(() => { const query = feedbackQuery.trim().toLowerCase(); return query ? feedback.filter(item => item.comment.toLowerCase().includes(query) || String(item.rating).includes(query)) : feedback }, [feedback, feedbackQuery])
  const publicLink = workspace ? `${window.location.origin}/feedback/${workspace.slug}` : ''

  if (loading && !workspace) return <main className="dashboard-page"><div className="dashboard-shell standalone-shell"><Preloader label="Loading your workspace…" /></div></main>
  if (workspace?.status === 'banned') return <main className="dashboard-page"><div className="dashboard-shell standalone-shell"><header className="dashboard-header"><Link className="brand" href="/">feedback <span>deo</span>.</Link><button className="logout" onClick={signOut}><LogOut /> Log out</button></header><section className="suspended-card"><h1>Workspace suspended</h1><p>This café workspace has been paused by the Feedback Deo admin team. Public feedback and plan changes are disabled.</p><button className="button outline" onClick={signOut}>Log out</button></section></div></main>
  return <main className="dashboard-page"><div className="dashboard-shell">
    <aside className="dashboard-sidebar"><Link className="dashboard-mark" href="/"><span>feedback <b>deo</b><small>.</small></span></Link><nav className="dashboard-nav" aria-label="Dashboard navigation"><a className="active" href="#overview"><LayoutDashboard /> Overview</a><a href="#space"><Store /> Feedback space</a><a href="#tables"><Users /> Tables</a><a href="#telegram"><MessageCircle /> Telegram alerts</a><a href="/payment"><CreditCard /> Billing <span className="nav-chevron">›</span></a></nav><div className="sidebar-footer"><a href="#help"><HelpCircle /> Help <span className="nav-chevron">›</span></a><button onClick={signOut}><LogOut /> Log out</button></div></aside>
    <div className="dashboard-main">
    <header className="dashboard-header"><div className="mobile-brand"><Link className="brand" href="/">feedback <span>deo</span>.</Link></div><div className="dash-search"><Search /><input value={feedbackQuery} onChange={event => setFeedbackQuery(event.target.value)} placeholder="Search feedback" aria-label="Search feedback" /></div><div className="dash-actions"><button className="icon-button" onClick={() => void load(true)} disabled={refreshing} aria-label="Refresh dashboard"><RefreshCw className={refreshing ? 'spin' : ''} /></button><button className="logout" onClick={signOut}><LogOut /> Log out</button></div></header>
    <div className="dashboard-title" id="overview"><div>{editingName ? <form className="name-edit-form" onSubmit={renameWorkspace}><input value={workspaceName} onChange={event => setWorkspaceName(event.target.value)} aria-label="Café name" autoFocus required /><button className="button green" disabled={saving}>Save</button><button type="button" className="button outline" onClick={() => setEditingName(false)}>Cancel</button></form> : <div className="title-copy"><p className="kicker">YOUR WORKSPACE</p><h1>Hello {workspace?.name || 'there'} <span className="wave">👋</span> {workspace ? <button className="title-edit" onClick={() => { setWorkspaceName(workspace.name); setEditingName(true) }} aria-label="Edit café name"><Pencil /></button> : null}</h1>{workspace && <p className="workspace-uid">UID <code>{workspace.slug}</code><span>Permanent workspace identifier</span></p>}</div>}<p>Collect honest feedback and turn it into your next best decision.</p></div><div className="title-settings"><Settings2 /> <span>{workspace?.plan === 'pro' ? 'Pro workspace' : 'Free workspace'}</span></div></div>
    {error && <p className="form-error" role="alert">{error}</p>}
    {message && <p className="form-success" role="status">{message}</p>}
    {!workspace ? <section className="setup-card"><div className="setup-icon"><Plus /></div><h2>Create your first feedback space</h2><p>Start with your business name, then share your public feedback link with customers.</p><form onSubmit={createWorkspace}><input value={newSpace} onChange={(event) => setNewSpace(event.target.value)} placeholder="The Commons Café" required /><button className="button green" disabled={saving}>{saving ? 'Creating…' : 'Create space'} <Plus /></button></form></section> : <>
      <div className="stats-grid"><div className="stat-card"><small>AVERAGE RATING</small><strong>{average} <Star className="stat-star" fill="currentColor" /></strong><span>{workspace?.plan === 'pro' ? 'Unlimited on Pro' : `Free plan · ${monthFeedbackCount}/30 this month`}</span></div><div className="stat-card"><small>TOTAL FEEDBACK</small><strong>{feedback.length}</strong><span>Anonymous responses</span></div><div className="stat-card"><small>SPACE STATUS</small><strong className="status-live">Live</strong><span>Ready to collect</span></div></div>
      <section className="plan-banner" id="space"><div><p className="kicker">YOUR PLAN</p><h2>{workspace?.plan === 'pro' ? 'Pro · unlimited feedback' : `${Math.max(0, 30 - monthFeedbackCount)} feedback left this month`}</h2><p>{workspace?.plan === 'pro' ? 'Your space can collect as much feedback as you need.' : 'Free spaces include 30 feedback submissions each calendar month.'}</p></div>{workspace?.plan !== 'pro' && <Link className="button green" href="/payment">Upgrade to Pro <ArrowRight /></Link>}</section>
      <section className="telegram-panel" id="telegram"><div className="telegram-panel-icon"><MessageCircle /></div><div className="telegram-panel-copy"><p className="kicker">TELEGRAM ALERTS</p><h2>{telegramConnection?.connected ? 'Telegram is connected' : 'Get alerts in Telegram'}</h2><p>{telegramConnection?.connected ? `Connected${telegramConnection.telegram_username ? ` to @${telegramConnection.telegram_username}` : ''}. You will receive feedback and subscription alerts here.` : 'Pro spaces can receive new feedback, payment updates, and 1–2 star alerts in one Telegram chat.'}</p>{telegramLink && <div className="telegram-link-row"><input readOnly value={telegramLink} aria-label="Telegram connection link" /><a className="button green" href={telegramLink} target="_blank" rel="noreferrer">Open Telegram</a><button className="button outline" onClick={() => void copyLink(telegramLink)}>Copy link</button></div>}</div>{!telegramLink && <button className="button outline telegram-connect" onClick={() => void connectTelegram()} disabled={telegramLoading}>{telegramLoading ? 'Creating link…' : telegramConnection?.connected ? 'Reconnect Telegram' : 'Connect Telegram'} <Bell /></button>}</section>
      <section className="share-panel"><div><p className="kicker">YOUR PUBLIC LINK</p><h2>Start collecting feedback</h2><p>Share this link or scan the QR code with any phone camera.</p></div><div className="share-content"><div className="qr-card" data-qr-id={`workspace-qr-${workspace.id}`}><QRCodeSVG value={publicLink} size={156} bgColor="#ffffff" fgColor="#132b26" includeMargin /><strong>Scan to leave feedback</strong><button className="button outline qr-download" onClick={() => void downloadQr(`workspace-qr-${workspace.id}`, `${workspace.slug}-feedback-qr`)}><Download /> Download QR</button></div><div className="share-actions"><div className="share-row"><input readOnly value={publicLink} aria-label="Public feedback link" /><button className="button outline" onClick={() => void copyLink(publicLink)}>{copied === publicLink ? <Check /> : <Copy />} {copied === publicLink ? 'Copied' : 'Copy link'}</button><a className="button outline" href={publicLink} target="_blank" rel="noreferrer"><ExternalLink /> Open</a></div></div></div></section>
      <section className="tables-panel" id="tables"><div className="panel-heading"><div><h2>Tables</h2><p>Create a unique link for each table.</p></div></div><form className="inline-form" onSubmit={createTable}><input value={newTable} onChange={event => setNewTable(event.target.value)} placeholder="Table 1" required /><button className="button green" disabled={saving}><Plus /> Add table</button></form>{tables.length > 0 && <div className="table-list">{tables.map(table => { const link = `${window.location.origin}/feedback/${workspace.slug}?table=${table.id}`; return <div className="table-row" key={table.id}><div className="table-qr" data-qr-id={`table-qr-${table.id}`}><QRCodeSVG value={link} size={72} bgColor="#ffffff" fgColor="#132b26" includeMargin /><button className="qr-icon-download" onClick={() => void downloadQr(`table-qr-${table.id}`, `${table.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-feedback-qr`)} aria-label={`Download ${table.name} QR`}><Download /></button></div><strong>{table.name}</strong><input readOnly value={link} aria-label={`${table.name} feedback link`} /><button className="icon-button" onClick={() => void copyLink(link)} aria-label={`Copy ${table.name} link`}>{copied === link ? <Check /> : <Copy />}</button><a className="icon-button" href={link} target="_blank" rel="noreferrer" aria-label={`Open ${table.name} link`}><ExternalLink /></a><button className="icon-button danger-button" onClick={() => void deleteTable(table)} aria-label={`Delete ${table.name}`} disabled={saving}><Trash2 /></button></div> })}</div>}</section>
      <section className="feedback-panel" id="help"><div className="panel-heading"><div><h2>Recent feedback</h2><p>{feedbackQuery ? `Showing matches for “${feedbackQuery}”.` : 'What your customers are saying.'}</p></div><button className="button outline" onClick={() => void load(true)}><RefreshCw /> Refresh</button></div>{feedback.length === 0 ? <div className="empty-feedback"><BarChart3 /><h3>No feedback yet</h3><p>Share your public link with customers to see responses here.</p></div> : filteredFeedback.length === 0 ? <div className="empty-feedback"><Search /><h3>No matching feedback</h3><p>Try another search term.</p></div> : <div className="feedback-list">{filteredFeedback.map(item => <article className="feedback-row" key={item.id}><div className="rating" aria-label={`${item.rating} out of 5 stars`}>{'★'.repeat(item.rating)}<span>{'★'.repeat(5 - item.rating)}</span></div><p>{item.comment}</p><time>{new Date(item.created_at).toLocaleString()}</time></article>)}</div>}</section>
    </>}
    </div>
  </div></main>
}
