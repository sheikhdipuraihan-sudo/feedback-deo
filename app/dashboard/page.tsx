'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { BarChart3, LogOut, Plus, RefreshCw, Star } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

type Workspace = { id: string; name: string; slug: string }
type Feedback = { id: string; rating: number; comment: string; created_at: string }

export const dynamic = 'force-dynamic'

export default function DashboardPage() {
  const router = useRouter()
  const supabase = createClient()
  const [workspace, setWorkspace] = useState<Workspace | null>(null)
  const [feedback, setFeedback] = useState<Feedback[]>([])
  const [name, setName] = useState('')
  const [newSpace, setNewSpace] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  async function load() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.replace('/?auth=login'); return }
    const { data } = await supabase.from('workspaces').select('id,name,slug').order('created_at').limit(1).maybeSingle()
    setWorkspace(data)
    if (data) {
      const result = await supabase.from('feedback').select('id,rating,comment,created_at').eq('workspace_id', data.id).order('created_at', { ascending: false })
      setFeedback(result.data || [])
    }
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  async function createWorkspace(event: React.FormEvent) {
    event.preventDefault(); if (!newSpace.trim()) return
    setSaving(true); setMessage('')
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const slug = `${newSpace.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')}-${Math.random().toString(36).slice(2, 7)}`
    const { error } = await supabase.from('workspaces').insert({ owner_id: user.id, name: newSpace.trim(), slug })
    if (error) setMessage('Could not create the space. Please try again.')
    else { setNewSpace(''); setMessage('Your feedback space is ready.'); await load() }
    setSaving(false)
  }

  async function signOut() { await supabase.auth.signOut(); router.replace('/') }
  const average = feedback.length ? (feedback.reduce((sum, item) => sum + item.rating, 0) / feedback.length).toFixed(1) : '—'

  if (loading) return <main className="dashboard-page"><div className="dashboard-shell"><p>Loading your workspace…</p></div></main>
  return <main className="dashboard-page"><div className="dashboard-shell">
    <header className="dashboard-header"><a className="brand" href="/">feedback <span>deo</span>.</a><div className="dash-actions"><button className="icon-button" onClick={load} aria-label="Refresh dashboard"><RefreshCw /></button><button className="logout" onClick={signOut}><LogOut /> Log out</button></div></header>
    <div className="dashboard-title"><div><p className="kicker">YOUR WORKSPACE</p><h1>{workspace?.name || 'Welcome to Feedback Deo'}</h1><p>Collect honest feedback and turn it into your next best decision.</p></div></div>
    {!workspace ? <section className="setup-card"><div className="setup-icon"><Plus /></div><h2>Create your first feedback space</h2><p>Start with your business name. You can add tables and feedback links next.</p><form onSubmit={createWorkspace}><input value={newSpace} onChange={(e) => setNewSpace(e.target.value)} placeholder="The Commons Café" required /><button className="button green" disabled={saving}>{saving ? 'Creating…' : 'Create space'} <Plus /></button></form>{message && <small>{message}</small>}</section> : <>
      <div className="stats-grid"><div className="stat-card"><small>AVERAGE RATING</small><strong>{average} <Star className="stat-star" fill="currentColor" /></strong><span>Across all feedback</span></div><div className="stat-card"><small>TOTAL FEEDBACK</small><strong>{feedback.length}</strong><span>Anonymous responses</span></div><div className="stat-card"><small>SPACE STATUS</small><strong className="status-live">Live</strong><span>Ready to collect</span></div></div>
      <section className="feedback-panel"><div className="panel-heading"><div><h2>Recent feedback</h2><p>What your customers are saying.</p></div><button className="button outline" onClick={load}><RefreshCw /> Refresh</button></div>{feedback.length === 0 ? <div className="empty-feedback"><BarChart3 /><h3>No feedback yet</h3><p>Share your feedback link with customers to see responses here.</p></div> : <div className="feedback-list">{feedback.map(item => <article className="feedback-row" key={item.id}><div className="rating">{'★'.repeat(item.rating)}<span>{'★'.repeat(5 - item.rating)}</span></div><p>{item.comment}</p><time>{new Date(item.created_at).toLocaleString()}</time></article>)}</div>}</section>
    </>}
  </div></main>
}
