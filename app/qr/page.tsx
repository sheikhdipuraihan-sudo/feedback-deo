'use client'

import { useCallback, useEffect, useState } from 'react'
import { ArrowLeft, ArrowRight, Check, Copy, Download, ExternalLink, LockKeyhole, Plus, QrCode, Trash2, Upload } from 'lucide-react'
import { toPng } from 'html-to-image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { signOut as firebaseSignOut } from 'firebase/auth'
import { createClient } from '@/lib/supabase/client'
import { firebaseAuth, waitForFirebaseUser } from '@/lib/firebase/client'
import BrandedQr from '@/components/BrandedQr'
import Preloader from '@/components/Preloader'

type Workspace = {
  id: string
  name: string
  slug: string
  plan: 'free' | 'pro'
  status: 'active' | 'banned'
  qr_theme: string | null
  qr_logo: string | null
  qr_business_name: string | null
  qr_brand_color: string | null
  qr_layout: string | null
  qr_brand_text: string | null
}
type FeedbackTable = { id: string; name: string; created_at: string }
type QrSettings = Pick<Workspace, 'qr_theme' | 'qr_logo' | 'qr_business_name' | 'qr_brand_color' | 'qr_layout' | 'qr_brand_text'>

const QR_THEMES = [
  { id: 'default', name: 'Default', detail: 'Clean & scannable' },
  { id: 'modern', name: 'Modern', detail: 'Fresh, crisp frame' },
  { id: 'minimal', name: 'Minimal', detail: 'Quiet and simple' },
  { id: 'gradient', name: 'Gradient', detail: 'Colorful outer frame' },
  { id: 'neon', name: 'Neon', detail: 'Night-time contrast' },
  { id: 'dark', name: 'Dark', detail: 'Deep green canvas' },
  { id: 'elegant', name: 'Elegant', detail: 'Warm, refined' },
  { id: 'business', name: 'Business', detail: 'Professional teal' },
  { id: 'glass', name: 'Glass', detail: 'Soft translucent look' },
  { id: 'premium', name: 'Premium', detail: 'Green & gold' },
  { id: 'rounded', name: 'Rounded', detail: 'Soft-edged card' },
  { id: 'soft', name: 'Soft', detail: 'Gentle pastel' },
  { id: 'luxury', name: 'Luxury', detail: 'Ink and champagne' },
  { id: 'vibrant', name: 'Vibrant', detail: 'Bright brand frame' },
  { id: 'custom-brand', name: 'Custom Brand', detail: 'Your Pro brand color' },
] as const

async function optimizeQrLogo(file: File) {
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) throw new Error('Choose a PNG, JPG, or WebP image.')
  if (file.size > 5 * 1024 * 1024) throw new Error('Logo must be smaller than 5 MB.')
  const source = URL.createObjectURL(file)
  try {
    const image = new Image()
    await new Promise<void>((resolve, reject) => { image.onload = () => resolve(); image.onerror = () => reject(new Error('Could not read that image.')); image.src = source })
    const scale = Math.min(1, 320 / Math.max(image.naturalWidth, image.naturalHeight))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale))
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale))
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Could not process that image.')
    context.drawImage(image, 0, 0, canvas.width, canvas.height)
    const result = canvas.toDataURL('image/webp', 0.82)
    if (result.length > 180_000) throw new Error('That logo is too detailed. Please choose a smaller image.')
    return result
  } finally { URL.revokeObjectURL(source) }
}

export default function QrLinksPage() {
  const router = useRouter()
  const supabase = createClient()
  const [workspace, setWorkspace] = useState<Workspace | null>(null)
  const [tables, setTables] = useState<FeedbackTable[]>([])
  const [newTable, setNewTable] = useState('')
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [copied, setCopied] = useState('')
  const [upgradeOpen, setUpgradeOpen] = useState(false)

  const load = useCallback(async (background = false) => {
    if (!supabase) { setError('Supabase is not configured for this deployment.'); setLoading(false); return }
    if (background) setRefreshing(true)
    else setLoading(true)
    setError('')
    const user = await waitForFirebaseUser()
    if (!user) { router.replace('/?auth=login'); return }
    const result = await supabase.from('workspaces').select('id,name,slug,plan,status,qr_theme,qr_logo,qr_business_name,qr_brand_color,qr_layout,qr_brand_text').eq('owner_id', user.uid).order('created_at', { ascending: true }).limit(1).maybeSingle()
    if (result.error) {
      const missingQrSchema = result.error.message.toLowerCase().includes('qr_')
      setError(missingQrSchema ? 'QR settings are not available in the database yet. Apply the QR branding migration, then refresh.' : 'We could not load your workspace. Please try again.')
      setLoading(false); setRefreshing(false); return
    }
    const nextWorkspace = result.data as Workspace | null
    setWorkspace(nextWorkspace)
    if (!nextWorkspace) { setTables([]); setLoading(false); setRefreshing(false); return }
    const tablesResult = await supabase.from('tables').select('id,name,created_at').eq('workspace_id', nextWorkspace.id).order('created_at', { ascending: true })
    if (tablesResult.error) setError('Your workspace loaded, but feedback point links could not be refreshed.')
    setTables((tablesResult.data || []) as FeedbackTable[])
    setLoading(false); setRefreshing(false)
  }, [router, supabase])

  useEffect(() => { void Promise.resolve().then(() => load()) }, [load])

  async function saveQrSettings(patch: Partial<QrSettings>) {
    if (!supabase || !workspace) return
    if (workspace.plan !== 'pro' && ((patch.qr_theme && patch.qr_theme !== 'default') || (patch.qr_brand_color && patch.qr_brand_color !== '#132b26') || (patch.qr_layout && patch.qr_layout !== 'stacked'))) { setUpgradeOpen(true); return }
    const previousWorkspace = workspace
    const nextWorkspace = { ...workspace, ...patch }
    setWorkspace(nextWorkspace)
    setSaving(true); setError(''); setMessage('')
    const { error: updateError } = await supabase.from('workspaces').update(patch).eq('id', workspace.id)
    if (updateError) {
      setWorkspace(previousWorkspace)
      const missingQrSchema = updateError.message.toLowerCase().includes('qr_')
      setError(missingQrSchema ? 'QR settings are not available in the database yet. Apply the QR branding migration, then try again.' : updateError.message.toLowerCase().includes('premium qr themes') ? 'Premium QR themes and advanced styling are available on Pro.' : 'Could not save your QR branding. Please try again.')
      setSaving(false); return
    }
    setMessage('Saved. Your QR preview has been updated.')
    setSaving(false)
  }

  async function uploadLogo(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    try { await saveQrSettings({ qr_logo: await optimizeQrLogo(file) }) }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'Could not process that image.') }
  }

  async function copyLink(value: string) {
    try { await navigator.clipboard.writeText(value); setCopied(value); window.setTimeout(() => setCopied(''), 1800) }
    catch { setError('Copy failed. You can select the link manually.') }
  }

  async function downloadQr(id: string, filename: string) {
    const artwork = document.querySelector(`[data-qr-id="${id}"] [data-qr-artwork]`) as HTMLElement | null
    if (!artwork) { setError('QR code is not ready yet. Please try again.'); return }
    try {
      const dataUrl = await toPng(artwork, { pixelRatio: 4, cacheBust: true, backgroundColor: '#ffffff', skipFonts: true })
      const link = document.createElement('a')
      link.href = dataUrl; link.download = `${filename}.png`; link.click()
    } catch { setError('Could not download this QR code. Please try again.') }
  }

  async function createTable(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!supabase || !workspace || !newTable.trim()) return
    setSaving(true); setError(''); setMessage('')
    const { error: insertError } = await supabase.from('tables').insert({ workspace_id: workspace.id, name: newTable.trim() })
    if (insertError) setError('Could not add that feedback point. Please try again.')
    else { setNewTable(''); setMessage('Feedback point link created.'); await load(true) }
    setSaving(false)
  }

  async function deleteTable(table: FeedbackTable) {
    if (!supabase || !workspace || !window.confirm(`Delete ${table.name}? Its QR link will stop working.`)) return
    setSaving(true); setError(''); setMessage('')
    const { error: deleteError } = await supabase.from('tables').delete().eq('id', table.id).eq('workspace_id', workspace.id)
    if (deleteError) setError('Could not delete that feedback point. Existing feedback may be linked to it.')
    else { setMessage(`${table.name} deleted.`); await load(true) }
    setSaving(false)
  }

  async function signOut() { await firebaseSignOut(firebaseAuth); router.replace('/') }

  const origin = typeof window === 'undefined' ? '' : window.location.origin
  const publicLink = workspace && origin ? `${origin}/feedback/${workspace.slug}` : ''
  const qrTheme = workspace?.plan === 'pro' ? workspace.qr_theme || 'default' : 'default'
  const qrColor = workspace?.plan === 'pro' ? workspace.qr_brand_color || '#132b26' : '#132b26'
  const qrLayout = workspace?.plan === 'pro' ? workspace.qr_layout || 'stacked' : 'stacked'

  if (loading) return <main className="dashboard-page"><div className="dashboard-shell standalone-shell"><Preloader label="Loading QR & links…" /></div></main>
  if (workspace?.status === 'banned') return <main className="dashboard-page"><div className="dashboard-shell standalone-shell"><section className="payment-card"><h1>Workspace suspended</h1><p className="payment-lead">QR and link management is unavailable while this workspace is suspended.</p><Link className="button outline" href="/dashboard">Back to dashboard</Link></section></div></main>
  if (!workspace) return <main className="dashboard-page"><div className="dashboard-shell standalone-shell"><section className="payment-card"><div className="payment-icon"><QrCode /></div><h1>Create your feedback space first</h1><p className="payment-lead">Your workspace’s QR code and public links will appear here.</p><Link className="button green" href="/dashboard">Open dashboard <ArrowRight /></Link></section></div></main>

  return <main className="dashboard-page"><div className="dashboard-shell standalone-shell ai-page-shell qr-page-shell">
    <header className="ai-page-header"><Link className="back-link" href="/dashboard"><ArrowLeft /> Back to dashboard</Link><Link className="dashboard-mark ai-brand" href="/"><span>feedback <b>deo</b><small>.</small></span></Link><button className="logout" onClick={signOut}>Log out</button></header>
    <section className="ai-page-intro qr-page-intro"><div><p className="kicker">QR &amp; LINKS</p><h1>Your QR codes and share links.</h1><p>This page is separate from your dashboard home. Your QR opens the public feedback link; create a named feedback point for each counter, room, stylist, class, table, or service area.</p></div><div className="ai-intro-icon"><QrCode /></div></section>
    {error && <p className="form-error" role="alert">{error}</p>}
    {message && <p className="form-success" role="status">{message}</p>}
    <section className="qr-link-card"><div><p className="kicker">PUBLIC FEEDBACK LINK</p><h2>One link for your whole space</h2><p>Share this address directly, or use the workspace QR code below.</p></div><div className="qr-link-actions"><input readOnly value={publicLink || `/feedback/${workspace.slug}`} aria-label="Public feedback link" /><button type="button" className="button outline" onClick={() => void copyLink(publicLink)}>{copied === publicLink ? <Check /> : <Copy />} {copied === publicLink ? 'Copied' : 'Copy link'}</button><a className="button outline" href={publicLink || `/feedback/${workspace.slug}`} target="_blank" rel="noreferrer"><ExternalLink /> Open</a></div></section>
    <section className="qr-branding-panel"><div className="panel-heading"><div><p className="kicker">QR BRANDING</p><h2>Make it yours</h2><p>Choose a style and download a print-ready QR. The feedback destination stays the same.</p></div><span className={`qr-plan-chip ${workspace.plan}`}>{workspace.plan === 'pro' ? 'PRO THEMES UNLOCKED' : 'FREE · DEFAULT THEME'}</span></div>
      <div className="qr-branding-grid"><div className="qr-branding-controls"><div className="qr-theme-heading"><strong>Choose a theme</strong><small>{workspace.plan === 'pro' ? 'Choose any Pro design. The live preview updates as soon as you select one.' : 'Default is included. Upgrade to Pro to unlock all 15 themes.'}</small></div><div className="qr-theme-grid">{QR_THEMES.map(theme => { const locked = workspace.plan !== 'pro' && theme.id !== 'default'; const selected = qrTheme === theme.id; return <button type="button" className={`qr-theme-option${selected ? ' selected' : ''}${locked ? ' locked' : ''}`} key={theme.id} onClick={() => locked ? setUpgradeOpen(true) : void saveQrSettings({ qr_theme: theme.id })} aria-pressed={selected} aria-label={`${theme.name}${locked ? ', Pro theme locked' : ''}`}><span className={`qr-theme-swatch swatch-${theme.id}`}><i /></span><span className="qr-theme-copy"><strong>{theme.name}</strong><small>{theme.detail}</small></span>{locked ? <span className="qr-lock"><LockKeyhole /> PRO</span> : selected ? <Check className="qr-theme-check" /> : null}</button> })}</div>
        <div className="qr-branding-fields"><label><span>Business name</span><input maxLength={80} value={workspace.qr_business_name ?? workspace.name} onChange={event => setWorkspace(current => current ? { ...current, qr_business_name: event.target.value.slice(0, 80) } : current)} onBlur={event => { const value = event.target.value.trim(); if (value !== (workspace.qr_business_name ?? workspace.name)) void saveQrSettings({ qr_business_name: value }) }} placeholder="Your business name" /></label><label><span>Short brand text <small>Optional</small></span><input maxLength={60} value={workspace.qr_brand_text || ''} onChange={event => setWorkspace(current => current ? { ...current, qr_brand_text: event.target.value.slice(0, 60) } : current)} onBlur={event => { const value = event.target.value.trim(); if (value !== (workspace.qr_brand_text || '')) void saveQrSettings({ qr_brand_text: value }) }} placeholder="e.g. Scan to share your feedback" /></label><div className="qr-branding-field"><span>Logo <small>PNG, JPG, or WebP · max 5 MB</small></span><div className="qr-logo-actions"><label className="button outline qr-upload-button"><Upload /> {workspace.qr_logo ? 'Replace logo' : 'Upload logo'}<input type="file" accept="image/png,image/jpeg,image/webp" onChange={event => void uploadLogo(event)} aria-label="Upload business logo" /></label>{workspace.qr_logo && <button className="button outline" type="button" onClick={() => void saveQrSettings({ qr_logo: null })}>Remove</button>}</div></div><div className="qr-branding-field"><span>Brand color</span>{workspace.plan === 'pro' ? <input className="qr-color-picker" type="color" value={workspace.qr_brand_color || '#132b26'} onChange={event => setWorkspace(current => current ? { ...current, qr_brand_color: event.target.value } : current)} onBlur={event => void saveQrSettings({ qr_brand_color: event.target.value })} aria-label="Choose QR brand color" /> : <button type="button" className="qr-locked-control" onClick={() => setUpgradeOpen(true)}><LockKeyhole /> Custom color</button>}</div><div className="qr-branding-field"><span>Layout <small>Pro customization</small></span>{workspace.plan === 'pro' ? <select className="qr-layout-select" value={workspace.qr_layout || 'stacked'} onChange={event => void saveQrSettings({ qr_layout: event.target.value })} aria-label="Choose QR layout"><option value="stacked">Stacked branding</option><option value="compact">Compact logo row</option><option value="centered">QR first</option></select> : <button type="button" className="qr-locked-control" onClick={() => setUpgradeOpen(true)}><LockKeyhole /> Premium layouts</button>}</div>{saving && <small className="qr-save-status">Saving…</small>}</div>
      </div><div className="qr-preview-panel"><p className="kicker">LIVE PREVIEW</p><div className="qr-preview-frame" data-qr-id="workspace-qr"><BrandedQr value={publicLink || `/feedback/${workspace.slug}`} businessName={workspace.qr_business_name ?? workspace.name} logo={workspace.qr_logo} brandText={workspace.qr_brand_text} brandColor={qrColor} theme={qrTheme} layout={qrLayout} /></div><button className="button green qr-download" onClick={() => void downloadQr('workspace-qr', `${workspace.slug}-feedback-qr`)}><Download /> Download high-resolution PNG</button><small className="qr-print-note">Print-ready · square modules · generous quiet zone</small></div></div>
    </section>
    <section className="tables-panel qr-tables-panel"><div className="panel-heading"><div><p className="kicker">FEEDBACK POINTS</p><h2>Give each point its own QR and link</h2><p>These links are different from your general public feedback link.</p></div><button className="button outline" type="button" onClick={() => void load(true)} disabled={refreshing}>{refreshing ? 'Refreshing…' : 'Refresh links'}</button></div><form className="inline-form" onSubmit={createTable}><input value={newTable} onChange={event => setNewTable(event.target.value)} placeholder="e.g. Checkout, stylist, classroom" required /><button className="button green" disabled={saving}><Plus /> Add feedback point</button></form>{tables.length === 0 ? <div className="qr-tables-empty"><QrCode /><strong>No feedback points yet</strong><p>Add a point to create its own share link and downloadable QR code.</p></div> : <div className="table-list">{tables.map(table => { const link = `${origin}/feedback/${workspace.slug}?table=${table.id}`; const tableQrId = `table-qr-${table.id}`; return <div className="table-row" key={table.id}><div className="table-qr" data-qr-id={tableQrId}><BrandedQr compact value={link} businessName={workspace.qr_business_name ?? workspace.name} logo={workspace.qr_logo} brandText={workspace.qr_brand_text} brandColor={qrColor} theme={qrTheme} layout={qrLayout} /><button className="qr-icon-download" type="button" onClick={() => void downloadQr(tableQrId, `${table.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-feedback-qr`)} aria-label={`Download ${table.name} QR`}><Download /></button></div><strong>{table.name}</strong><input readOnly value={link} aria-label={`${table.name} feedback link`} /><button className="icon-button" type="button" onClick={() => void copyLink(link)} aria-label={`Copy ${table.name} link`}>{copied === link ? <Check /> : <Copy />}</button><a className="icon-button" href={link} target="_blank" rel="noreferrer" aria-label={`Open ${table.name} link`}><ExternalLink /></a><button className="icon-button danger-button" type="button" onClick={() => void deleteTable(table)} aria-label={`Delete ${table.name}`} disabled={saving}><Trash2 /></button></div> })}</div>}</section>
    {upgradeOpen && <div className="modal-backdrop qr-upgrade-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setUpgradeOpen(false) }}><section className="modal qr-upgrade-modal" role="dialog" aria-modal="true" aria-labelledby="qr-upgrade-title"><button className="modal-close" onClick={() => setUpgradeOpen(false)} aria-label="Close upgrade prompt">×</button><p className="kicker">PRO QR THEMES</p><h2 id="qr-upgrade-title">Unlock premium QR styles</h2><p>Upgrade to Pro to use all 15 QR themes, custom brand colors, and advanced layouts. The Free plan keeps the standard scannable QR.</p><ul><li>15 professional, scan-friendly designs</li><li>Advanced branding and custom colors</li><li>Premium layouts for your business</li></ul><Link className="button green full" href="/payment">Upgrade to Pro <ArrowRight /></Link></section></div>}
  </div></main>
}
