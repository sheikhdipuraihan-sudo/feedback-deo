'use client'

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react'
import { ArrowRight, BrainCircuit, Send, Sparkles, UserRound } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { waitForFirebaseUser } from '@/lib/firebase/client'
import Preloader from '@/components/Preloader'
import DashboardPageFrame from '@/components/DashboardPageFrame'
import { getBusinessTypeLabel } from '@/lib/business-types'
import { chooseFinalChatText } from '@/lib/ai/chat-stream'

type Workspace = { id: string; name: string; status: 'active' | 'banned'; business_type?: string }
type ChatMessage = { role: 'user' | 'assistant'; content: string; streaming?: boolean }
type ChatStreamEvent = { type?: string; code?: string; text?: string }
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

async function consumeChatStream(response: Response, onEvent: (event: ChatStreamEvent) => void) {
  if (!response.body) throw new Error('missing_stream')
  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let dataLines: string[] = []
  const dispatch = () => {
    if (!dataLines.length) return
    const raw = dataLines.join('\n')
    dataLines = []
    if (!raw.trim() || raw.trim() === '[DONE]') return
    onEvent(JSON.parse(raw) as ChatStreamEvent)
  }
  const processLine = (line: string) => {
    if (line.startsWith(':')) return
    if (line.startsWith('data:')) { dataLines.push(line.slice(5).replace(/^ /, '')); return }
    if (line === '') dispatch()
  }

  while (true) {
    const { value, done } = await reader.read()
    buffer += decoder.decode(value || new Uint8Array(), { stream: !done })
    if (done) buffer += decoder.decode()
    const lines = buffer.split(/\r?\n/)
    buffer = done ? '' : (lines.pop() || '')
    if (done && buffer) lines.push(buffer)
    for (const line of lines) processLine(line)
    if (done) { dispatch(); return }
  }
}

function chatErrorForStatus(status: number) {
  if (status === 401) return 'Please sign in again to continue chatting with Feedback Deo AI.'
  if (status === 403) return 'Feedback Deo AI is unavailable for this workspace.'
  if (status === 400) return 'Try asking a question about your workspace or customer feedback.'
  if (status === 404) return 'Your workspace could not be found. Refresh the dashboard and try again.'
  return "I'm Feedback Deo AI. I couldn't complete that response just now. Please try again in a moment."
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
  const [error, setError] = useState('')
  const parsed = useMemo(() => parseAnalysis(analysis), [analysis])

  const loadWorkspace = useCallback(async () => {
    if (!supabase) { setError('Supabase is not configured for this deployment.'); setLoading(false); return }
    const user = await waitForFirebaseUser()
    if (!user) { router.replace('/?auth=login'); return }
    const result = await supabase.from('workspaces').select('id,name,status,business_type').eq('owner_id', user.uid).order('created_at', { ascending: true }).limit(1).maybeSingle()
    if (result.error) setError('We could not load your workspace. Please try again.')
    setWorkspace(result.data as Workspace | null)
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
    if (!workspace) return
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

  async function sendChat(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const message = chatInput.trim()
    if (!workspace || !message || chatLoading) return

    setChatInput('')
    setError('')
    const history = [...chat, { role: 'user' as const, content: message }].slice(-8)
    const nextChat: ChatMessage[] = [...chat, { role: 'user', content: message }, { role: 'assistant', content: '', streaming: true }]
    const assistantIndex = nextChat.length - 1
    setChat(nextChat)
    setChatLoading(true)
    let accumulated = ''
    let eventCompleted = false
    const updateAssistant = (content: string, streaming = false) => {
      setChat(current => current.map((item, index) => index === assistantIndex ? { ...item, content, streaming } : item))
    }

    try {
      const token = await getToken()
      if (!token) { updateAssistant('Please sign in again to continue chatting with Feedback Deo AI.'); return }
      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspace_id: workspace.id, message, history }),
      })
      if (!response.ok) { updateAssistant(chatErrorForStatus(response.status)); return }

      await consumeChatStream(response, event => {
        if (event.type === 'delta' && typeof event.text === 'string') {
          accumulated += event.text
          updateAssistant(accumulated, true)
        } else if (event.type === 'done') {
          // Keep whichever contains more of the completed answer. This both
          // recovers chunks missed by the browser parser and avoids replacing
          // a longer stream with a provider's truncated final value.
          accumulated = chooseFinalChatText(accumulated, typeof event.text === 'string' ? event.text : '')
          eventCompleted = true
          updateAssistant(accumulated || "I'm Feedback Deo AI. I couldn't prepare a useful answer just now. Please try again.")
        } else if (event.type === 'error') {
          const messageText = event.text || "I'm Feedback Deo AI. I couldn't complete that response just now. Please try again."
          accumulated = event.code === 'refused' || !accumulated.trim() ? messageText : `${accumulated.trimEnd()}\n\n${messageText}`
          eventCompleted = true
          updateAssistant(accumulated)
        }
      })

      if (!eventCompleted) {
        if (!accumulated.trim()) accumulated = "I'm Feedback Deo AI. I couldn't prepare a useful answer just now. Please try again."
        updateAssistant(accumulated)
      }
    } catch {
      const fallback = accumulated.trim()
        ? `${accumulated.trimEnd()}\n\nThe connection was interrupted. Please try again.`
        : "I'm Feedback Deo AI. I couldn't complete that response just now. Please try again in a moment."
      updateAssistant(fallback)
    } finally {
      setChatLoading(false)
    }
  }

  if (loading) return <Preloader label="Loading Feedback Deo AI…" />
  if (!workspace) return <DashboardPageFrame mainClassName="ai-page-shell"><section className="payment-card"><div className="payment-icon"><BrainCircuit /></div><h1>Create your business workspace first</h1><p className="payment-lead">Feedback Deo AI works for restaurants, salons, shops, hotels, clinics, gyms, schools, service businesses, and more.</p><Link className="button green" href="/dashboard">Open dashboard <ArrowRight /></Link></section></DashboardPageFrame>
  if (workspace.status === 'banned') return <DashboardPageFrame mainClassName="ai-page-shell"><section className="payment-card"><h1>Workspace suspended</h1><p className="payment-lead">Feedback Deo AI is unavailable while this workspace is suspended.</p><Link className="button outline" href="/dashboard">Back to dashboard</Link></section></DashboardPageFrame>

  return <DashboardPageFrame mainClassName="ai-page-shell">
    <section className="ai-page-intro"><div><p className="kicker">FEEDBACK DEO AI</p><h1>Business feedback, made clear.</h1><p>Understand customer patterns and find practical next steps for your {getBusinessTypeLabel(workspace.business_type).toLowerCase()}.</p></div><div className="ai-intro-icon"><Sparkles /></div></section>
    {error && <p className="form-error" role="alert">{error}</p>}
    <>
      <section className="ai-report-card"><div className="ai-card-heading"><div><p className="kicker">LATEST ANALYSIS</p><h2>Feedback report</h2><p>Clear themes and practical actions from your latest responses.</p></div><button className="button green" onClick={() => void runAnalysis()} disabled={analysisLoading}>{analysisLoading ? 'Analyzing…' : analysis ? 'Run again' : 'Analyze feedback'} <BrainCircuit /></button></div>{analysis ? <div className="ai-report"><div className="ai-summary"><span className="ai-summary-label">Summary</span><p>{parsed.summary}</p></div><div className="ai-section-grid">{parsed.sections.map(section => <article className="ai-section" key={section.title}><h3>{section.title}</h3><ul>{section.items.map((item, index) => <li key={`${section.title}-${index}`}>{item}</li>)}</ul></article>)}</div></div> : <div className="ai-empty"><BrainCircuit /><h3>Ready when you are</h3><p>Run an analysis to turn the latest customer responses into a clear report for your business.</p></div>}</section>
      <section className="ai-chat-card"><div className="ai-card-heading"><div><p className="kicker">ASK FEEDBACK DEO AI</p><h2>Chat about your business</h2><p>Ask about customer feedback, workspace insights, or how to use Feedback Deo.</p></div><div className="ai-chat-badge"><Sparkles /> Feedback Deo AI</div></div><div className="ai-chat-window" aria-label="Feedback Deo AI conversation">{chat.length === 0 && <div className="ai-chat-welcome"><div className="ai-chat-avatar"><BrainCircuit /></div><div><strong>Hi, I’m Feedback Deo AI.</strong><p>I know your business type, feedback points, QR branding, and recent customer responses. Ask me a question to get started.</p></div></div>}{chat.map((item, index) => <div className={`ai-message ${item.role}`} key={`${item.role}-${index}`}><div className="ai-message-avatar">{item.role === 'assistant' ? <BrainCircuit /> : <UserRound />}</div><div className="ai-message-bubble" aria-live={item.role === 'assistant' && !item.streaming ? 'polite' : undefined}>{item.content || (item.streaming ? <span className="ai-chat-placeholder">Feedback Deo AI is responding</span> : '')}{item.streaming && <span className="ai-stream-caret" aria-hidden="true" />}</div></div>)}</div><form className="ai-chat-form" onSubmit={sendChat}><input value={chatInput} onChange={event => setChatInput(event.target.value)} placeholder="Ask about your feedback or workspace…" aria-label="Ask Feedback Deo AI" maxLength={500} /><button className="button green" disabled={chatLoading || !chatInput.trim()} aria-label="Send message"><Send /></button></form></section>
    </>
  </DashboardPageFrame>
}
