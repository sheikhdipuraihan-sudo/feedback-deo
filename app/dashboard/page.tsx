'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { ArrowRight, BarChart3, Bell, Check, Copy, MessageCircle, Pencil, Plus, RefreshCw, Search, Settings2, Star } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { waitForFirebaseUser } from '@/lib/firebase/client'
import Preloader from '@/components/Preloader'
import DashboardPageFrame from '@/components/DashboardPageFrame'
import { BUSINESS_TYPES, getBusinessTypeLabel, type BusinessType } from '@/lib/business-types'
import { hasProAccess } from '@/lib/pro-access'
import { useLanguage } from '@/lib/i18n'

type Workspace = { id: string; name: string; slug: string; plan: 'free' | 'pro'; referral_pro_until?: string | null; status: 'active' | 'banned'; business_type?: BusinessType }
type Feedback = { id: string; rating: number; comment: string; created_at: string }
type CachePayload = { workspace: Workspace | null; feedback: Feedback[] }
type TelegramConnection = { connected: boolean; telegram_username: string | null; connected_at: string | null }

export const dynamic = 'force-dynamic'
const CACHE_PREFIX = 'feedback-deo-dashboard:'
export default function DashboardPage() {
  const { t } = useLanguage()
  const router = useRouter()
  const supabase = createClient()
  const [workspace, setWorkspace] = useState<Workspace | null>(null)
  const [feedback, setFeedback] = useState<Feedback[]>([])
  const [newSpace, setNewSpace] = useState('')
  const [newBusinessType, setNewBusinessType] = useState<BusinessType>('restaurant')
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
  const [telegramUpgradeOpen, setTelegramUpgradeOpen] = useState(false)
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

    const workspaceResult = await supabase.from('workspaces').select('id,name,slug,plan,referral_pro_until,status,business_type').eq('owner_id', user.uid).order('created_at', { ascending: true }).limit(1).maybeSingle()
    if (workspaceResult.error) { setError('We could not load your workspace. Please refresh and try again.'); setLoading(false); setRefreshing(false); return }
    const nextWorkspace = workspaceResult.data as Workspace | null
    setWorkspace(nextWorkspace)
    if (!nextWorkspace) {
      setFeedback([]); setTelegramConnection(null); setLoading(false); setRefreshing(false); saveCache({ workspace: null, feedback: [] }); return
    }
    if (hasProAccess(nextWorkspace)) {
      const telegramResult = await supabase.rpc('get_telegram_connection')
      const telegramData = Array.isArray(telegramResult.data) ? telegramResult.data[0] : telegramResult.data
      setTelegramConnection((telegramData || { connected: false, telegram_username: null, connected_at: null }) as TelegramConnection)
    } else setTelegramConnection(null)

    const feedbackResult = await supabase.from('feedback').select('id,rating,comment,created_at').eq('workspace_id', nextWorkspace.id).order('created_at', { ascending: false }).limit(100)
    if (feedbackResult.error) setError('Your workspace loaded, but some data could not be refreshed.')
    const nextFeedback = (feedbackResult.data || []) as Feedback[]
    setFeedback(nextFeedback)
    saveCache({ workspace: nextWorkspace, feedback: nextFeedback })
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
    const { error: insertError } = await supabase.from('workspaces').insert({ owner_id: user.uid, name: newSpace.trim(), slug, business_type: newBusinessType })
    if (insertError) setError(insertError.code === '23505' ? 'That space name is already in use. Please try another.' : 'Could not create the space. Please try again.')
    else { setNewSpace(''); setMessage('Your feedback space is ready.'); await load(true) }
    setSaving(false)
  }


  async function renameWorkspace(event: React.FormEvent) {
    event.preventDefault()
    if (!supabase || !workspace || !workspaceName.trim()) return
    setSaving(true); setMessage(''); setError('')
    const { error: updateError } = await supabase.from('workspaces').update({ name: workspaceName.trim() }).eq('id', workspace.id)
    if (updateError) setError('Could not update the business name. Please try again.')
    else { setEditingName(false); setMessage('Business name updated.'); await load(true) }
    setSaving(false)
  }

  async function changeBusinessType(nextType: BusinessType) {
    if (!supabase || !workspace || nextType === workspace.business_type) return
    const previousWorkspace = workspace
    const nextWorkspace = { ...workspace, business_type: nextType }
    setWorkspace(nextWorkspace); setSaving(true); setError(''); setMessage('')
    const { error: updateError } = await supabase.from('workspaces').update({ business_type: nextType }).eq('id', workspace.id)
    if (updateError) {
      setWorkspace(previousWorkspace)
      setError('Could not update your business type. Please refresh and try again.')
    } else {
      setMessage(`Business type updated to ${getBusinessTypeLabel(nextType)}.`)
      saveCache({ workspace: nextWorkspace, feedback })
    }
    setSaving(false)
  }

  async function connectTelegram() {
    if (!hasProAccess(workspace)) { setTelegramUpgradeOpen(true); return }
    if (!supabase) return
    setTelegramLoading(true); setError(''); setMessage('')
    const { data, error: tokenError } = await supabase.rpc('create_telegram_link_token')
    if (tokenError || !data) setError(tokenError?.message.includes('pro') ? 'Telegram notifications are available on Pro.' : 'Could not create a Telegram connection link.')
    else setTelegramLink(`https://t.me/feedbackdeoBoT?start=${data}`)
    setTelegramLoading(false)
  }

  async function copyLink(link: string) {
    try { await navigator.clipboard.writeText(link); setCopied(link); window.setTimeout(() => setCopied(''), 1800) } catch { setError('Copy failed. You can select the link manually.') }
  }

  const average = useMemo(() => feedback.length ? (feedback.reduce((sum, item) => sum + item.rating, 0) / feedback.length).toFixed(1) : '—', [feedback])
  const monthFeedbackCount = useMemo(() => { const start = new Date(); start.setDate(1); start.setHours(0, 0, 0, 0); return feedback.filter(item => new Date(item.created_at) >= start).length }, [feedback])
  const filteredFeedback = useMemo(() => { const query = feedbackQuery.trim().toLowerCase(); return query ? feedback.filter(item => item.comment.toLowerCase().includes(query) || String(item.rating).includes(query)) : feedback }, [feedback, feedbackQuery])
  const workspaceHasPro = hasProAccess(workspace)

  if (loading && !workspace) return <Preloader label="Loading your workspace…" />
  if (workspace?.status === 'banned') return <DashboardPageFrame><section className="suspended-card"><h1>Workspace suspended</h1><p>This business workspace has been paused by the Feedback Deo admin team. Public feedback and plan changes are disabled.</p></section></DashboardPageFrame>
  return <DashboardPageFrame>


    <div className="dashboard-title" id="overview"><div>{editingName ? <form className="name-edit-form" onSubmit={renameWorkspace}><input value={workspaceName} onChange={event => setWorkspaceName(event.target.value)} aria-label="Business name" autoFocus required /><button className="button green" disabled={saving}>{t('common.save')}</button><button type="button" className="button outline" onClick={() => setEditingName(false)}>{t('common.cancel')}</button></form> : <div className="title-copy"><p className="kicker">{t('dashboard.workspace')}</p><h1>Welcome, {workspace?.name || 'there'} {workspace ? <button className="title-edit" onClick={() => { setWorkspaceName(workspace.name); setEditingName(true) }} aria-label="Edit business name"><Pencil /></button> : null}</h1>{workspace && <p className="workspace-uid">UID <code>{workspace.slug}</code><span>Permanent workspace identifier</span></p>}</div>}<p>{t('dashboard.tagline')}</p></div><div className="title-settings"><Settings2 /> <span className={workspaceHasPro ? 'pro-badge' : ''}>{workspaceHasPro ? 'PRO MEMBER' : 'Free workspace'}</span>{workspace && <label className="business-type-control"><span>{t('dashboard.businessType')}</span><select className="business-type-select" value={workspace.business_type || 'restaurant'} onChange={event => void changeBusinessType(event.target.value as BusinessType)} disabled={saving} aria-label="Business type">{BUSINESS_TYPES.map(type => <option key={type.id} value={type.id}>{type.label}</option>)}</select></label>}</div></div>
    {error && <p className="form-error" role="alert">{error}</p>}
    {message && <p className="form-success" role="status">{message}</p>}
    {!workspace ? <section className="setup-card"><div className="setup-icon"><Plus /></div><h2>{t('dashboard.createTitle')}</h2><p>{t('dashboard.createBody')}</p><form className="business-setup-form" onSubmit={createWorkspace}><input value={newSpace} onChange={(event) => setNewSpace(event.target.value)} placeholder={t('dashboard.businessName')} aria-label={t('dashboard.businessName')} required /><select value={newBusinessType} onChange={event => setNewBusinessType(event.target.value as BusinessType)} aria-label={t('dashboard.businessType')}>{BUSINESS_TYPES.map(type => <option key={type.id} value={type.id}>{type.label}</option>)}</select><button className="button green" disabled={saving}>{saving ? t('dashboard.creating') : t('dashboard.create')} <Plus /></button></form></section> : <>
      <div className="stats-grid" id="space"><div className="stat-card"><small>{t('dashboard.averageRating')}</small><strong>{average} <Star className="stat-star" fill="currentColor" /></strong><span>{workspaceHasPro ? 'Unlimited on Pro' : `Free plan · ${monthFeedbackCount}/30 this month`}</span></div><div className="stat-card"><small>{t('dashboard.totalFeedback')}</small><strong>{feedback.length}</strong><span>{t('dashboard.anonymousResponses')}</span></div><div className="stat-card"><small>{t('dashboard.spaceStatus')}</small><strong className="status-live">{t('dashboard.live')}</strong><span>{t('dashboard.readyToCollect')}</span></div></div>
      {!workspaceHasPro && <section className="plan-banner"><div><p className="kicker">YOUR PLAN</p><h2>{Math.max(0, 30 - monthFeedbackCount)} feedback left this month</h2><p>Free spaces include 30 feedback submissions each calendar month.</p></div><Link className="button green" href="/payment">Upgrade to Pro <ArrowRight /></Link></section>}
      <section className="telegram-panel" id="telegram"><div className="telegram-panel-icon"><MessageCircle /></div><div className="telegram-panel-copy"><p className="kicker">TELEGRAM ALERTS</p><h2>{telegramConnection?.connected ? 'Telegram is connected' : 'Get alerts in Telegram'}</h2><p>{telegramConnection?.connected ? `Connected${telegramConnection.telegram_username ? ` to @${telegramConnection.telegram_username}` : ''}. You will receive feedback and subscription alerts here.` : 'Pro spaces can receive new feedback, payment updates, and 1–2 star alerts in one Telegram chat.'}</p>{telegramLink && <div className="telegram-link-row"><input readOnly value={telegramLink} aria-label="Telegram connection link" /><a className="button green" href={telegramLink} target="_blank" rel="noreferrer">Open Telegram</a><button className="button outline" onClick={() => void copyLink(telegramLink)}>Copy link</button></div>}</div>{!telegramLink && <button className="button outline telegram-connect" onClick={() => void connectTelegram()} disabled={telegramLoading}>{telegramLoading ? 'Creating link…' : telegramConnection?.connected ? 'Reconnect Telegram' : 'Connect Telegram'} <Bell /></button>}</section>
      <section className="feedback-panel" id="feedback"><div className="panel-heading"><div><h2>{t('dashboard.recentFeedback')}</h2><p>{feedbackQuery ? `Showing matches for “${feedbackQuery}”.` : t('dashboard.customerSaying')}</p></div><div className="feedback-heading-actions"><div className="feedback-search"><Search /><input value={feedbackQuery} onChange={event => setFeedbackQuery(event.target.value)} placeholder={t('dashboard.search')} aria-label={t('dashboard.search')} /></div><button className="button outline" onClick={() => void load(true)} disabled={refreshing}><RefreshCw className={refreshing ? 'spin' : ''} /> {t('dashboard.refresh')}</button></div></div>{feedback.length === 0 ? <div className="empty-feedback"><BarChart3 /><h3>{t('dashboard.noFeedback')}</h3><p>{t('dashboard.shareLink')}</p></div> : filteredFeedback.length === 0 ? <div className="empty-feedback"><Search /><h3>{t('dashboard.noMatches')}</h3><p>{t('dashboard.tryAnother')}</p></div> : <div className="feedback-list">{filteredFeedback.map(item => <article className="feedback-row" key={item.id}><div className="rating" aria-label={`${item.rating} out of 5 stars`}>{Array.from({ length: 5 }, (_, index) => <Star key={index} className="rating-star" fill={index < item.rating ? 'currentColor' : 'none'} stroke={index < item.rating ? 'currentColor' : 'var(--line)'} />)}</div><p>{item.comment}</p><time>{new Date(item.created_at).toLocaleString()}</time></article>)}</div>}</section>
    </>}
    {telegramUpgradeOpen && <div className="modal-backdrop qr-upgrade-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setTelegramUpgradeOpen(false) }}><section className="modal qr-upgrade-modal" role="dialog" aria-modal="true" aria-labelledby="telegram-upgrade-title"><button className="modal-close" onClick={() => setTelegramUpgradeOpen(false)} aria-label="Close Telegram upgrade prompt">×</button><p className="kicker">PRO FEATURE</p><h2 id="telegram-upgrade-title">Upgrade to Pro to connect Telegram</h2><p>Telegram alerts are included with Pro. Upgrade to get new feedback, subscription updates, and low-rating alerts sent to your Telegram chat.</p><Link className="button green full" href="/payment" onClick={() => setTelegramUpgradeOpen(false)}>Upgrade to Pro <ArrowRight /></Link></section></div>}
  </DashboardPageFrame>
}
