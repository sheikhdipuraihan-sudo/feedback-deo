import type { Metadata } from 'next'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { MessageSquare, Star } from 'lucide-react'
import { getReviewWidgetLimit, getReviewWidgetTheme, verifyReviewWidgetToken } from '@/lib/embed/review-widget'
import { hasProAccess } from '@/lib/pro-access'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const revalidate = 0

export const metadata: Metadata = {
  title: 'Customer reviews',
  description: 'Recent customer feedback and ratings.',
  referrer: 'no-referrer',
  robots: { index: false, follow: false },
}

type PageProps = {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ token?: string | string[]; theme?: string | string[]; limit?: string | string[] }>
}

type FeedbackReview = { id: string; rating: number; comment: string; created_at: string }
type WidgetData = { workspaceName: string; reviews: FeedbackReview[]; totalReviews: number; average: number }

export default async function PublicReviewsEmbed({ params, searchParams }: PageProps) {
  const [{ slug }, query] = await Promise.all([params, searchParams])
  const token = typeof query.token === 'string' ? query.token : ''
  const theme = getReviewWidgetTheme(query.theme)
  const limit = getReviewWidgetLimit(query.limit)
  const signingSecret = process.env.SUPABASE_SERVICE_ROLE_KEY
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL

  if (!signingSecret || !supabaseUrl || !verifyReviewWidgetToken(slug, token, signingSecret)) {
    return <WidgetMessage theme={theme} title="Reviews unavailable" body="This reviews widget is not available." />
  }

  const widget = await loadWidgetData(slug, supabaseUrl, signingSecret, limit)
  if (!widget) return <WidgetMessage theme={theme} title="Reviews unavailable" body="Reviews could not be loaded right now." />
  const { workspaceName, reviews, totalReviews, average } = widget

  return <main className="review-embed-page" data-theme={theme}>
    <header className="review-embed-header">
      <div className="review-embed-heading">
        <p className="review-embed-eyebrow">CUSTOMER REVIEWS</p>
        <h1>{workspaceName}</h1>
        <p className="review-embed-count">{totalReviews} {totalReviews === 1 ? 'review' : 'reviews'}</p>
      </div>
      {reviews.length > 0 && <div className="review-embed-score" aria-label={`${average.toFixed(1)} out of 5 average across displayed reviews`}>
        <strong>{average.toFixed(1)}</strong>
        <div className="review-embed-stars" aria-hidden="true">{Array.from({ length: 5 }, (_, index) => <Star key={index} fill={index < Math.round(average) ? 'currentColor' : 'none'} />)}</div>
        <small>Recent average</small>
      </div>}
    </header>

    {reviews.length === 0 ? <section className="review-embed-empty"><MessageSquare /><h2>Be the first to share an experience</h2><p>There are no reviews to show yet.</p></section> : <section className="review-embed-grid" aria-label="Recent customer reviews">
      {reviews.map(review => {
        const rating = Math.max(1, Math.min(5, Math.round(Number(review.rating))))
        return <article className="review-embed-card" key={review.id}>
          <div className="review-embed-card-top">
            <div className="review-embed-stars" aria-label={`${rating} out of 5 stars`}>
              {Array.from({ length: 5 }, (_, index) => <Star key={index} fill={index < rating ? 'currentColor' : 'none'} />)}
            </div>
            <time dateTime={review.created_at}>{formatDate(review.created_at)}</time>
          </div>
          <p className="review-embed-comment">{review.comment}</p>
          <span className="review-embed-anonymous">Anonymous feedback</span>
        </article>
      })}
    </section>}
    {totalReviews > reviews.length && <p className="review-embed-footnote">Showing {reviews.length} recent reviews.</p>}
  </main>
}

async function loadWidgetData(slug: string, supabaseUrl: string, secret: string, limit: number): Promise<WidgetData | null> {
  try {
    const supabase = createSupabaseClient(supabaseUrl, secret, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
    const { data: workspace, error: workspaceError } = await supabase
      .from('workspaces')
      .select('id,name,plan,referral_pro_until,status')
      .eq('slug', slug)
      .maybeSingle()

    if (workspaceError || !workspace || !hasProAccess(workspace) || workspace.status !== 'active') return null

    const { data, count, error } = await supabase
      .from('feedback')
      .select('id,rating,comment,created_at', { count: 'exact' })
      .eq('workspace_id', workspace.id)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) {
      console.warn('public_review_widget_feedback_unavailable')
      return null
    }

    const reviews = ((data || []) as FeedbackReview[]).filter(item => Number.isFinite(Number(item.rating)) && item.comment?.trim())
    const average = reviews.length ? reviews.reduce((sum, review) => sum + Math.max(1, Math.min(5, Number(review.rating))), 0) / reviews.length : 0
    return { workspaceName: workspace.name, reviews, totalReviews: count ?? reviews.length, average }
  } catch {
    console.warn('public_review_widget_load_failed')
    return null
  }
}

function formatDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', year: 'numeric' }).format(date)
}

function WidgetMessage({ theme, title, body }: { theme: 'white' | 'dark'; title: string; body: string }) {
  return <main className="review-embed-page" data-theme={theme}>
    <section className="review-embed-unavailable"><MessageSquare /><h1>{title}</h1><p>{body}</p></section>
  </main>
}
