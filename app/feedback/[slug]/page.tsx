'use client'

import { useEffect, useMemo, useState } from 'react'
import { CheckCircle2, MessageSquare, ShieldCheck, Star } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import Preloader from '@/components/Preloader'
import { notifyTelegram } from '@/lib/telegram'
import { useLanguage } from '@/lib/i18n'

type Workspace = { id: string; name: string; slug: string }

type Props = { params: Promise<{ slug: string }> }

export default function PublicFeedbackPage({ params }: Props) {
  const { t } = useLanguage()
  const supabase = createClient()
  const [slug, setSlug] = useState('')
  const [workspace, setWorkspace] = useState<Workspace | null>(null)
  const [rating, setRating] = useState(0)
  const [comment, setComment] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    params.then(({ slug: routeSlug }) => setSlug(routeSlug))
  }, [params])

  useEffect(() => {
    if (!supabase || !slug) return
    const client = supabase
    let active = true
    async function loadWorkspace() {
      setLoading(true)
      const { data, error: lookupError } = await client.rpc('get_public_workspace', { workspace_slug: slug })
      if (!active) return
      const found = Array.isArray(data) ? data[0] : data
      if (lookupError || !found) setError(t('public.unavailableBody'))
      else setWorkspace(found as Workspace)
      setLoading(false)
    }
    loadWorkspace()
    return () => { active = false }
  }, [slug, supabase, t])

  const stars = useMemo(() => [1, 2, 3, 4, 5], [])

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!supabase || !workspace || rating === 0 || comment.trim().length < 1) return
    setSubmitting(true)
    setError('')
    const { error: submitError } = await supabase.rpc('submit_public_feedback', {
      workspace_slug: workspace.slug,
      feedback_rating: rating,
      feedback_comment: comment.trim(),
      feedback_table_id: new URLSearchParams(window.location.search).get('table') || null,
    })
    if (submitError) setError(submitError.message.includes('free monthly feedback limit') ? 'This workspace has reached its 30-feedback monthly limit.' : 'We could not send that feedback. Please try again.')
    else {
      setSubmitted(true)
      void notifyTelegram({ workspace_slug: workspace.slug, event: 'feedback', rating, comment: comment.trim() })
    }
    setSubmitting(false)
  }

  if (!supabase) return <PageMessage title="Feedback Deo is not configured" body="The feedback form is temporarily unavailable." />
  if (loading) return <Preloader label={t('public.loading')} />
  if (error && !workspace) return <PageMessage title={t('public.unavailableTitle')} body={error} />
  if (submitted && workspace) return <PageMessage icon={<CheckCircle2 />} title={t('public.thanks')} body={t('public.sent', { name: workspace.name })} />

  return <main className="public-feedback-page">
    <section className="public-feedback-card soft-shadow">
      <div className="feedback-brand">feedback <span>deo</span>.</div>
      <div className="feedback-icon"><MessageSquare /></div>
      <p className="kicker">{workspace?.name}</p>
      <h1>{t('public.question')}</h1>
      <p className="feedback-intro">{t('public.intro')}</p>
      <form className="public-feedback-form" onSubmit={submit}>
        <fieldset>
          <legend>{t('public.rate')}</legend>
          <div className="rating-picker" aria-label="Choose a rating">
            {stars.map(value => <button key={value} type="button" className={value <= rating ? 'selected' : ''} onClick={() => setRating(value)} aria-label={`${value} star${value === 1 ? '' : 's'}`}><Star fill="currentColor" /></button>)}
          </div>
        </fieldset>
        <label htmlFor="feedback-comment">{t('public.commentLabel')}</label>
        <textarea id="feedback-comment" value={comment} onChange={event => setComment(event.target.value)} maxLength={2000} minLength={1} required placeholder={t('public.commentPlaceholder')} />
        {error && <p className="form-error" role="alert">{error}</p>}
        <button className="button green full" disabled={submitting || rating === 0}>{submitting ? t('public.sending') : t('public.send')}</button>
      </form>
      <p className="anonymous"><ShieldCheck size={15} /> {t('public.anonymous')}</p>
    </section>
  </main>
}

function PageMessage({ title, body, icon }: { title: string; body: string; icon?: React.ReactNode }) {
  return <main className="public-feedback-page"><section className="public-feedback-card message-card soft-shadow"><div className="feedback-brand">feedback <span>deo</span>.</div><div className="feedback-icon">{icon || <MessageSquare />}</div><h1>{title}</h1><p className="feedback-intro">{body}</p></section></main>
}
