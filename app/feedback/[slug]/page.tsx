'use client'

import { useEffect, useMemo, useState } from 'react'
import { CheckCircle2, MessageSquare, ShieldCheck, Star } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import Preloader from '@/components/Preloader'

type Workspace = { id: string; name: string; slug: string }

type Props = { params: Promise<{ slug: string }> }

export default function PublicFeedbackPage({ params }: Props) {
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
      if (lookupError || !found) setError('This feedback link is not available.')
      else setWorkspace(found as Workspace)
      setLoading(false)
    }
    loadWorkspace()
    return () => { active = false }
  }, [slug, supabase])

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
    else setSubmitted(true)
    setSubmitting(false)
  }

  if (!supabase) return <PageMessage title="Feedback Deo is not configured" body="The feedback form is temporarily unavailable." />
  if (loading) return <main className="public-feedback-page"><section className="public-feedback-card message-card soft-shadow"><div className="feedback-brand">feedback <span>deo</span>.</div><Preloader label="Loading feedback form…" /></section></main>
  if (error && !workspace) return <PageMessage title="Feedback link unavailable" body={error} />
  if (submitted && workspace) return <PageMessage icon={<CheckCircle2 />} title="Thank you for your feedback" body={`Your response was sent anonymously to ${workspace.name}.`} />

  return <main className="public-feedback-page">
    <section className="public-feedback-card soft-shadow">
      <div className="feedback-brand">feedback <span>deo</span>.</div>
      <div className="feedback-icon"><MessageSquare /></div>
      <p className="kicker">{workspace?.name}</p>
      <h1>How was your experience?</h1>
      <p className="feedback-intro">Your honest feedback helps this business get better. No account required.</p>
      <form className="public-feedback-form" onSubmit={submit}>
        <fieldset>
          <legend>Rate your experience</legend>
          <div className="rating-picker" aria-label="Choose a rating">
            {stars.map(value => <button key={value} type="button" className={value <= rating ? 'selected' : ''} onClick={() => setRating(value)} aria-label={`${value} star${value === 1 ? '' : 's'}`}><Star fill="currentColor" /></button>)}
          </div>
        </fieldset>
        <label htmlFor="feedback-comment">What should we know?</label>
        <textarea id="feedback-comment" value={comment} onChange={event => setComment(event.target.value)} maxLength={2000} minLength={1} required placeholder="Tell us what went well or what we can improve…" />
        {error && <p className="form-error" role="alert">{error}</p>}
        <button className="button green full" disabled={submitting || rating === 0}>{submitting ? 'Sending…' : 'Send feedback'}</button>
      </form>
      <p className="anonymous"><ShieldCheck size={15} /> Anonymous by default</p>
    </section>
  </main>
}

function PageMessage({ title, body, icon }: { title: string; body: string; icon?: React.ReactNode }) {
  return <main className="public-feedback-page"><section className="public-feedback-card message-card soft-shadow"><div className="feedback-brand">feedback <span>deo</span>.</div><div className="feedback-icon">{icon || <MessageSquare />}</div><h1>{title}</h1><p className="feedback-intro">{body}</p></section></main>
}
