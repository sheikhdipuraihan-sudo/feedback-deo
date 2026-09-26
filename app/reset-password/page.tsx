'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowRight, CheckCircle2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

export default function ResetPasswordPage() {
  const router = useRouter()
  const supabase = createClient()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)
  const [busy, setBusy] = useState(false)

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!supabase) { setError('This deployment is missing its Supabase configuration.'); return }
    if (password !== confirm) { setError('Passwords do not match.'); return }
    setBusy(true); setError('')
    const { error: updateError } = await supabase.auth.updateUser({ password })
    if (updateError) setError('This reset link is invalid or expired. Please request a new one.')
    else setSaved(true)
    setBusy(false)
  }

  if (saved) return <main className="public-feedback-page"><section className="public-feedback-card message-card soft-shadow"><div className="feedback-brand">feedback <span>deo</span>.</div><div className="feedback-icon"><CheckCircle2 /></div><h1>Password updated</h1><p className="feedback-intro">Your password has been changed securely.</p><button className="button green full" onClick={() => router.push('/?auth=login')}>Log in <ArrowRight size={15} /></button></section></main>

  return <main className="public-feedback-page"><section className="public-feedback-card soft-shadow"><div className="feedback-brand">feedback <span>deo</span>.</div><div className="feedback-icon"><CheckCircle2 /></div><h1>Choose a new password</h1><p className="feedback-intro">Use at least 8 characters. No phone number required.</p><form className="modal-form" onSubmit={submit}><label>New password<input type="password" minLength={8} required value={password} onChange={e=>setPassword(e.target.value)} /></label><label>Confirm password<input type="password" minLength={8} required value={confirm} onChange={e=>setConfirm(e.target.value)} /></label>{error&&<small className="form-error">{error}</small>}<button className="button green full" disabled={busy}>{busy ? 'Updating…' : 'Update password'} <ArrowRight size={15} /></button></form></section></main>
}
