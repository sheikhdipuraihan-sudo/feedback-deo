'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { ArrowRight, Check, Code2, Copy, ExternalLink, LockKeyhole, Moon, Star, Sun } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { waitForFirebaseUser } from '@/lib/firebase/client'
import Preloader from '@/components/Preloader'
import DashboardPageFrame from '@/components/DashboardPageFrame'

type Workspace = { id: string; name: string; slug: string; plan: 'free' | 'pro'; status: 'active' | 'banned' }
type Theme = 'white' | 'dark'

const sampleReviews = [
  { rating: 5, comment: 'A wonderful experience. The service was thoughtful and everything felt easy from start to finish.', date: 'Today' },
  { rating: 5, comment: 'Friendly, professional, and exactly what I needed. I will definitely come back.', date: 'Yesterday' },
]

export default function WebsiteWidgetPage() {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const [workspace, setWorkspace] = useState<Workspace | null>(null)
  const [loading, setLoading] = useState(true)
  const [theme, setTheme] = useState<Theme>('white')
  const [limit, setLimit] = useState(8)
  const [token, setToken] = useState('')
  const [generating, setGenerating] = useState(false)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const loadWorkspace = useCallback(async () => {
    if (!supabase) { setError('Supabase is not configured for this deployment.'); setLoading(false); return }
    const user = await waitForFirebaseUser()
    if (!user) { router.replace('/?auth=login'); return }
    const { data, error: queryError } = await supabase
      .from('workspaces')
      .select('id,name,slug,plan,status')
      .eq('owner_id', user.uid)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle()
    if (queryError) setError('We could not load your workspace. Please refresh and try again.')
    else setWorkspace(data as Workspace | null)
    setLoading(false)
  }, [router, supabase])

  useEffect(() => { void Promise.resolve().then(() => loadWorkspace()) }, [loadWorkspace])

  async function generateCode() {
    if (!workspace || workspace.plan !== 'pro') return
    setGenerating(true); setError(''); setMessage('')
    try {
      const user = await waitForFirebaseUser()
      if (!user) { router.replace('/?auth=login'); return }
      const response = await fetch('/api/widget-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await user.getIdToken()}` },
        body: JSON.stringify({ workspace_id: workspace.id }),
      })
      const result = await response.json().catch(() => ({})) as { token?: string; error?: string }
      if (!response.ok || !result.token) throw new Error(result.error || 'Could not generate your embed code.')
      setToken(result.token)
      setMessage('Your secure embed code is ready. Copy it into your website editor.')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not generate your embed code. Please try again.')
    } finally { setGenerating(false) }
  }

  const embedUrl = workspace && token
    ? `https://feedback-deo.vercel.app/embed/reviews/${encodeURIComponent(workspace.slug)}?token=${encodeURIComponent(token)}&theme=${theme}&limit=${limit}`
    : ''
  const iframeCode = embedUrl && workspace
    ? `<iframe\n  src="${escapeAttribute(embedUrl)}"\n  title="${escapeAttribute(`${workspace.name} customer reviews`)}"\n  loading="lazy"\n  referrerpolicy="no-referrer"\n  style="width:100%;max-width:960px;height:560px;border:0;border-radius:18px"\n></iframe>`
    : ''

  async function copyCode() {
    if (!iframeCode) return
    try { await navigator.clipboard.writeText(iframeCode); setCopied(true); setMessage('Embed code copied. Paste it into your website.'); window.setTimeout(() => setCopied(false), 1800) }
    catch { setError('Copy failed. Select the code and copy it manually.') }
  }

  if (loading) return <Preloader label="Loading website widget…" />
  if (!workspace) return <DashboardPageFrame mainClassName="ai-page-shell website-widget-shell"><section className="widget-upgrade-card"><div className="widget-lock-icon"><Code2 /></div><p className="kicker">WEBSITE WIDGET</p><h1>Create your feedback space first</h1><p>Your website review widget will be available after you create a business workspace.</p><Link className="button green" href="/dashboard">Open dashboard <ArrowRight /></Link></section></DashboardPageFrame>
  if (workspace.status === 'banned') return <DashboardPageFrame mainClassName="ai-page-shell website-widget-shell"><section className="widget-upgrade-card"><div className="widget-lock-icon"><LockKeyhole /></div><p className="kicker">WORKSPACE SUSPENDED</p><h1>Website widget unavailable</h1><p>This workspace is suspended, so its website review widget cannot be used.</p></section></DashboardPageFrame>
  if (workspace.plan !== 'pro') return <DashboardPageFrame mainClassName="ai-page-shell website-widget-shell"><section className="widget-upgrade-card"><div className="widget-lock-icon"><LockKeyhole /></div><p className="kicker">PRO FEATURE</p><h1>Show your feedback on your website.</h1><p>Embed a clean, responsive customer review widget on your own website. Choose a light or dark theme and display recent ratings and comments—without platform branding.</p><ul><li><Check /> Two themes: White and Dark</li><li><Check /> Copy-and-paste iframe code</li><li><Check /> Reviews stay in sync with new feedback</li></ul><Link className="button green" href="/payment">Upgrade to Pro <ArrowRight /></Link></section></DashboardPageFrame>

  return <DashboardPageFrame mainClassName="ai-page-shell website-widget-shell">
    <section className="ai-page-intro widget-page-intro"><div><p className="kicker">PRO · WEBSITE WIDGET</p><h1>Bring customer feedback to your website.</h1><p>Copy one iframe into your website editor. It shows recent ratings and comments, updates with new feedback, and carries no Feedback Deo branding.</p></div><div className="ai-intro-icon"><Code2 /></div></section>
    {error && <p className="form-error" role="alert">{error}</p>}
    {message && <p className="form-success" role="status">{message}</p>}

    <div className="widget-builder-grid">
      <section className="widget-controls-card">
        <div className="widget-section-heading"><div><p className="kicker">YOUR EMBED</p><h2>Customize it</h2><p>Choose the look and how many recent reviews to display.</p></div></div>
        <fieldset className="widget-theme-fieldset"><legend>Theme</legend><div className="widget-theme-options">
          <button type="button" className={`widget-theme-choice white${theme === 'white' ? ' selected' : ''}`} onClick={() => setTheme('white')} aria-pressed={theme === 'white'}><Sun /><span><strong>White</strong><small>Clean and bright</small></span>{theme === 'white' && <Check className="widget-theme-check" />}</button>
          <button type="button" className={`widget-theme-choice dark${theme === 'dark' ? ' selected' : ''}`} onClick={() => setTheme('dark')} aria-pressed={theme === 'dark'}><Moon /><span><strong>Dark</strong><small>Deep, low-glare</small></span>{theme === 'dark' && <Check className="widget-theme-check" />}</button>
        </div></fieldset>
        <label className="widget-limit-field">Recent reviews to show<select value={limit} onChange={event => setLimit(Number(event.target.value))}><option value={4}>4 reviews</option><option value={8}>8 reviews</option><option value={12}>12 reviews</option><option value={24}>24 reviews</option></select><small>Shows the newest reviews first. The widget also displays the total review count.</small></label>
        <div className="widget-public-note"><LockKeyhole /><p>Only ratings and comment text are displayed; separate account details are not. Embedded comments are public on your website, so use this widget for feedback you want to share publicly.</p></div>
        <button type="button" className="button green full" onClick={() => void generateCode()} disabled={generating}>{generating ? 'Preparing code…' : token ? 'Refresh embed code' : 'Generate embed code'} <Code2 /></button>
        {iframeCode && <div className="widget-code-block"><div className="widget-code-heading"><strong>Paste into your website</strong><button type="button" className="button outline small" onClick={() => void copyCode()}>{copied ? <Check /> : <Copy />}{copied ? 'Copied' : 'Copy code'}</button></div><textarea readOnly value={iframeCode} aria-label="Website review widget iframe code" onFocus={event => event.currentTarget.select()} />{embedUrl && <a className="widget-open-link" href={embedUrl} target="_blank" rel="noreferrer"><ExternalLink /> Open widget preview in a new tab</a>}</div>}
      </section>

      <section className="widget-preview-card"><div className="widget-preview-heading"><div><p className="kicker">LIVE PREVIEW</p><h2>{workspace.name}</h2></div><span className={`widget-preview-badge ${theme}`}>{theme === 'dark' ? 'DARK' : 'WHITE'}</span></div>
        <div className="widget-preview-window" data-theme={theme}>
          <div className="review-embed-header"><div className="review-embed-heading"><p className="review-embed-eyebrow">CUSTOMER REVIEWS</p><h1>{workspace.name}</h1><p className="review-embed-count">24 reviews</p></div><div className="review-embed-score"><strong>4.9</strong><div className="review-embed-stars" aria-hidden="true">{Array.from({ length: 5 }, (_, index) => <Star key={index} fill="currentColor" />)}</div><small>Recent average</small></div></div>
          <div className="review-embed-grid">{sampleReviews.slice(0, Math.min(2, limit)).map((review, index) => <article className="review-embed-card" key={index}><div className="review-embed-card-top"><div className="review-embed-stars" aria-label={`${review.rating} out of 5 stars`}>{Array.from({ length: 5 }, (_, star) => <Star key={star} fill={star < review.rating ? 'currentColor' : 'none'} />)}</div><time>{review.date}</time></div><p className="review-embed-comment">{review.comment}</p><span className="review-embed-anonymous">Anonymous feedback</span></article>)}</div>
        </div>
        <p className="widget-preview-caption">Example preview. Your live widget displays real feedback from your workspace.</p>
      </section>
    </div>
  </DashboardPageFrame>
}

function escapeAttribute(value: string) {
  return value.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
}
