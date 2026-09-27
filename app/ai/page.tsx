'use client'

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react'
import { ArrowRight, BrainCircuit, Copy, Lightbulb, MessageSquare, Send, Sparkles, UserRound } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { waitForFirebaseUser } from '@/lib/firebase/client'
import Preloader from '@/components/Preloader'
import DashboardPageFrame from '@/components/DashboardPageFrame'
import { getBusinessTypeLabel } from '@/lib/business-types'

type Workspace = { id: string; name: string; plan: 'free' | 'pro'; status: 'active' | 'banned'; business_type?: string }
type AiFeedback = { id: string; rating: number; comment: string; created_at: string }
type ChatMessage = { role: 'user' | 'assistant'; content: string }
type AnalysisSection = { title: string; items: string[]; summary?: string }
const SECTION_TITLES = ['What customers love', 'What needs attention', 'Recommended actions', 'Confidence and limits']

function cleanText(value: string) {
  return value.replace(/^\s*[-*]\s*/, '').replace(/\*\*/g, '').replace(/`/g, '').trim()
}

function parseAnalysis(raw: string): { summary: string; sections: AnalysisSection[] } {
  const lines = raw.replace(/\r/g, '').split('\n').map(line => line.trim()).filter(Boolean)
  let summary = ''
  const sections: AnalysisSection[] = []
  let current: AnalysisSection | null = null
  for (const line of lines) {
    const heading = line.replace(/^#{1,6}\s*/, '').replace(/^\*+|\*+$/g, '').replace(/:$/, '').trim()
    if (/^feedback deo ai summary$/i.test(heading)) { current = null; continue }
    const matched = SECTION_TITLES.find(title => title.toLowerCase() === heading.toLowerCase())
    if (matched) { current = { title: matched, items: [] }; sections.push(current); continue }
    const text = cleanText(line)
    if (!text) continue
    if (current) current.items.push(text)
    else summary = summary ? `${summary} ${text}` : text
  }
  return { summary: summary || 'Feedback Deo AI has prepared an overview of your customer feedback.', sections }
}

export default function FeedbackDeoAiPage() {
  const router = useRouter()
  const supabase = createClient()
  const [workspace, setWorkspace] = useState<Workspace | null>(null)
  const [loading, setLoading] = useState(true)
  const [analysis, setAnalysis] = useState('')
  const [analysisLoading, setAnalysisLoading] = useState(false)
  const [chatInput, setChatInput] = useState('')
  const [chatLoading, setChatLoading] = useState(false)
  const [chat, setChat] = useState<ChatMessage[]>([])
  const [feedbackItems, setFeedbackItems] = useState<AiFeedback[]>([])
  const [replyFeedbackId, setReplyFeedbackId] = useState('')
  const [replyTone, setReplyTone] = useState<'warm' | 'professional' | 'concise'>('warm')
  const [replyDraft, setReplyDraft] = useState('')
  const [replyLoading, setReplyLoading] = useState(false)
  const [improvementPlan, setImprovementPlan] = useState('')
  const [planLoading, setPlanLoading] = useState(false)
  const [error, setError] = useState('')
  const parsed = useMemo(() => parseAnalysis(analysis), [analysis])

  const loadWorkspace = useCallback(async () => {
    if (!supabase) { setError('Supabase is not configured for this deployment.'); setLoading(false); return }
    const user = await waitForFirebaseUser()
    if (!user) { router.replace('/?auth=login'); return }
    const result = await supabase.from('workspaces').select('id,name,plan,status,business_type').eq('owner_id', user.uid).order('created_at', { ascending: true }).limit(1).maybeSingle()
    if (result.error) setError('We could not load your workspace. Please try again.')
    const loadedWorkspace = result.data as Workspace | null
    setWorkspace(loadedWorkspace)
    if (loadedWorkspace) {
      const feedbackResult = await supabase.from('feedback').select('id,rating,comment,created_at').eq('workspace_id', loadedWorkspace.id).order('created_at', { ascending: false }).limit(100)
      if (feedbackResult.error) setError('Your business loaded, but feedback could not be refreshed.')
      const items = (feedbackResult.data || []) as AiFeedback[]
      setFeedbackItems(items)
      setReplyFeedbackId(items[0]?.id || '')
    }
    setLoading(false)
  }, [router, supabase])

  useEffect(() => { void Promise.resolve().then(loadWorkspace) }, [loadWorkspace])

  async function getToken() {
    const user = await waitForFirebaseUser()
    const token = user ? await user.getIdToken() : null
    if (!token) { router.replace('/?auth=login'); return null }
    return token
  }

  async function runAnalysis() {
    if (!workspace || workspace.plan !== 'pro') return
    setAnalysisLoading(true); setError('')
    try {
      const token = await getToken()
      if (!token) return
      const response = await fetch('/api/ai/analyze', { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ workspace_id: workspace.id }) })
      const result = await response.json().catch(() => ({})) as { analysis?: string; error?: string }
      if (!response.ok) setError(result.error || 'Feedback Deo AI could not complete the analysis.')
      else setAnalysis(result.analysis || '')
    } catch { setError('Feedback Deo AI could not connect. Please try again.') }
    finally { setAnalysisLoading(false) }
  }

  async function runTool(mode: 'reply' | 'plan') {
    if (!workspace || workspace.plan !== 'pro') return
    if (mode === 'reply' && !replyFeedbackId) { setError('Choose a feedback response first.'); return }
    setError('')
    if (mode === 'reply') setReplyLoading(true); else setPlanLoading(true)
    try {
      const token = await getToken()
      if (!token) return
      const response = await fetch('/api/ai/chat', { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ workspace_id: workspace.id, mode, feedback_id: mode === 'reply' ? replyFeedbackId : undefined, tone: replyTone }) })
      const result = await response.json().catch(() => ({})) as { reply?: string; plan?: string; error?: string }
      if (!response.ok) setError(result.error || 'Feedback Deo AI could not complete that tool.')
      else if (mode === 'reply') setReplyDraft(result.reply || '')
      else setImprovementPlan(result.plan || '')
    } catch { setError('Feedback Deo AI could not connect. Please try again.') }
    finally { if (mode === 'reply') setReplyLoading(false); else setPlanLoading(false) }
  }

  async function copyReplyDraft() {
    try { await navigator.clipboard.writeText(replyDraft) }
    catch { setError('Could not copy the draft. You can select and copy it manually.') }
  }

  async function sendChat(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const message = chatInput.trim()
    if (!workspace || workspace.plan !== 'pro' || !message || chatLoading) return
    setChatInput(''); setError('')
    const nextChat = [...chat, { role: 'user' as const, content: message }]
    setChat(nextChat); setChatLoading(true)
    try {
      const token = await getToken()
      if (!token) return
      const response = await fetch('/api/ai/chat', { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ workspace_id: workspace.id, message, history: nextChat.slice(-8) }) })
      const result = await response.json().catch(() => ({})) as { reply?: string; error?: string }
      if (!response.ok) setError(result.error || 'Feedback Deo AI could not answer that question.')
      else setChat(current => [...current, { role: 'assistant', content: result.reply || 'I could not find a useful answer. Try asking about a specific theme or action.' }])
    } catch { setError('Feedback Deo AI could not connect. Please try again.') }
    finally { setChatLoading(false) }
  }

  if (loading) return <DashboardPageFrame mainClassName="ai-page-shell"><Preloader label="Loading Feedback Deo AI…" /></DashboardPageFrame>
  if (!workspace) return <DashboardPageFrame mainClassName="ai-page-shell"><section className="payment-card"><div className="payment-icon"><BrainCircuit /></div><h1>Create your business workspace first</h1><p className="payment-lead">Feedback Deo AI works for restaurants, salons, shops, hotels, clinics, gyms, schools, service businesses, and more.</p><Link className="button green" href="/dashboard">Open dashboard <ArrowRight /></Link></section></DashboardPageFrame>
  if (workspace.status === 'banned') return <DashboardPageFrame mainClassName="ai-page-shell"><section className="payment-card"><h1>Workspace suspended</h1><p className="payment-lead">Feedback Deo AI is unavailable while this workspace is suspended.</p><Link className="button outline" href="/dashboard">Back to dashboard</Link></section></DashboardPageFrame>

  return <DashboardPageFrame mainClassName="ai-page-shell">
    <section className="ai-page-intro"><div><p className="kicker">FEEDBACK DEO AI</p><h1>Business feedback, made clear.</h1><p>Ask questions, find patterns, draft thoughtful replies, and plan improvements for your {getBusinessTypeLabel(workspace?.business_type).toLowerCase()}.</p></div><div className="ai-intro-icon"><Sparkles /></div></section>
    {error && <p className="form-error" role="alert">{error}</p>}
    {workspace.plan !== 'pro' ? <section className="ai-upgrade-card"><div className="ai-panel-icon"><BrainCircuit /></div><div><p className="kicker">PRO FEATURE</p><h2>Unlock your feedback assistant</h2><p>Get feedback analysis, tailored reply drafts, a 30-day improvement plan, and follow-up chat tailored to your type of business.</p></div><Link className="button green" href="/payment">Unlock with Pro <ArrowRight /></Link></section> : <>
      <section className="ai-tools-grid" aria-label="Feedback Deo AI tools"><article className="ai-tool-card"><div className="ai-tool-title"><div className="ai-panel-icon"><MessageSquare /></div><div><p className="kicker">REPLY WRITER</p><h2>Draft a customer reply</h2><p>Choose a real response and let AI prepare a business-appropriate draft.</p></div></div><label className="ai-tool-label">Feedback to answer<select className="ai-tool-select" value={replyFeedbackId} onChange={event => { setReplyFeedbackId(event.target.value); setReplyDraft('') }} disabled={!feedbackItems.length}><option value="">{feedbackItems.length ? 'Choose feedback' : 'No feedback available'}</option>{feedbackItems.map(item => <option key={item.id} value={item.id}>{item.rating}/5 · {item.comment.slice(0, 88)}{item.comment.length > 88 ? '…' : ''}</option>)}</select></label><label className="ai-tool-label">Reply tone<select className="ai-tool-select" value={replyTone} onChange={event => setReplyTone(event.target.value as 'warm' | 'professional' | 'concise')}><option value="warm">Warm and appreciative</option><option value="professional">Professional</option><option value="concise">Short and direct</option></select></label><button className="button green" onClick={() => void runTool('reply')} disabled={replyLoading || !replyFeedbackId}>{replyLoading ? 'Drafting…' : 'Draft reply'} <Sparkles /></button>{replyDraft && <div className="ai-tool-output"><p>{replyDraft}</p><button className="button outline" onClick={() => void copyReplyDraft()}><Copy /> Copy draft</button></div>}</article><article className="ai-tool-card"><div className="ai-tool-title"><div className="ai-panel-icon"><Lightbulb /></div><div><p className="kicker">30-DAY PLAN</p><h2>Build an improvement plan</h2><p>Turn real customer themes into a focused four-week plan for {getBusinessTypeLabel(workspace.business_type).toLowerCase()}.</p></div></div><p className="ai-tool-description">The plan separates clear feedback themes from hypotheses and suggests simple ways to track progress.</p><button className="button green" onClick={() => void runTool('plan')} disabled={planLoading || !feedbackItems.length}>{planLoading ? 'Building plan…' : improvementPlan ? 'Build a new plan' : 'Create 30-day plan'} <Sparkles /></button>{improvementPlan && <div className="ai-tool-output ai-plan-output"><pre>{improvementPlan}</pre></div>}</article></section><section className="ai-report-card"><div className="ai-card-heading"><div><p className="kicker">LATEST ANALYSIS</p><h2>Feedback report</h2><p>Clear themes and practical actions from your latest responses.</p></div><button className="button green" onClick={() => void runAnalysis()} disabled={analysisLoading}>{analysisLoading ? 'Analyzing…' : analysis ? 'Run again' : 'Analyze feedback'} <BrainCircuit /></button></div>{analysis ? <div className="ai-report"><div className="ai-summary"><span className="ai-summary-label">Summary</span><p>{parsed.summary}</p></div><div className="ai-section-grid">{parsed.sections.map(section => <article className="ai-section" key={section.title}><h3>{section.title}</h3><ul>{section.items.map((item, index) => <li key={`${section.title}-${index}`}>{item}</li>)}</ul></article>)}</div></div> : <div className="ai-empty"><BrainCircuit /><h3>Ready when you are</h3><p>Run an analysis to turn the latest customer responses into a clear report for your business.</p></div>}</section>
      <section className="ai-chat-card"><div className="ai-card-heading"><div><p className="kicker">ASK FEEDBACK DEO AI</p><h2>Chat about your feedback</h2><p>Ask things like “What should we improve first?” or “Which themes are most common?”</p></div><div className="ai-chat-badge"><Sparkles /> AI assistant</div></div><div className="ai-chat-window">{chat.length === 0 && <div className="ai-chat-welcome"><div className="ai-chat-avatar"><BrainCircuit /></div><div><strong>Hi, I’m Feedback Deo AI.</strong><p>I can help you understand patterns in your customer feedback and suggest practical next steps.</p></div></div>}{chat.map((item, index) => <div className={`ai-message ${item.role}`} key={`${item.role}-${index}`}><div className="ai-message-avatar">{item.role === 'assistant' ? <BrainCircuit /> : <UserRound />}</div><div className="ai-message-bubble">{item.content}</div></div>)}{chatLoading && <div className="ai-message assistant"><div className="ai-message-avatar"><BrainCircuit /></div><div className="ai-message-bubble ai-typing">Thinking…</div></div>}</div><form className="ai-chat-form" onSubmit={sendChat}><input value={chatInput} onChange={event => setChatInput(event.target.value)} placeholder="Ask about your customer feedback…" aria-label="Ask Feedback Deo AI" maxLength={500} /><button className="button green" disabled={chatLoading || !chatInput.trim()} aria-label="Send message"><Send /></button></form></section>
    </>}
  </DashboardPageFrame>
}
