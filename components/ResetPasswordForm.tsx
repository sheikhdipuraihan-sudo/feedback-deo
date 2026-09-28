'use client'

import { useEffect, useRef, useState, type FormEvent } from 'react'
import Link from 'next/link'
import { ArrowRight, Check, KeyRound, ShieldCheck } from 'lucide-react'

export default function ResetPasswordForm() {
  const [token, setToken] = useState('')
  const [tokenReady, setTokenReady] = useState(false)
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [busy, setBusy] = useState(false)
  const [completed, setCompleted] = useState(false)
  const [error, setError] = useState('')
  const capturedToken = useRef<string | null>(null)

  useEffect(() => {
    if (capturedToken.current === null) {
      const fragment = window.location.hash.startsWith('#') ? window.location.hash.slice(1) : window.location.hash
      capturedToken.current = new URLSearchParams(fragment).get('token') || ''
      if (capturedToken.current) {
        // Keep the bearer token out of browser history/referrer headers after capturing it.
        window.history.replaceState(null, '', window.location.pathname)
      }
    }
    // Queue the state update as a browser-location synchronization callback. The ref keeps
    // the captured token available if React Strict Mode replays this effect in development.
    const timer = window.setTimeout(() => {
      setToken(capturedToken.current || '')
      setTokenReady(true)
    }, 0)
    return () => window.clearTimeout(timer)
  }, [])

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!token) {
      setError('This reset link is missing. Request a new link and try again.')
      return
    }
    if (password !== confirmation) {
      setError('The passwords do not match.')
      return
    }
    setBusy(true)
    setError('')
    try {
      const response = await fetch('/api/auth/password-reset/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      })
      const result = await response.json().catch(() => ({})) as { error?: string; message?: string }
      if (!response.ok) throw new Error(result.error || 'We could not update your password.')
      setCompleted(true)
      setToken('')
      setPassword('')
      setConfirmation('')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'We could not update your password. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  return <main className="reset-page">
    <section className="reset-card" aria-labelledby="reset-title">
      <Link className="reset-brand" href="/" aria-label="Feedback Deo home">feedback <span>deo</span>.</Link>
      {!tokenReady ? <div className="reset-loading" role="status">Preparing your secure reset link…</div> : completed ? <>
        <div className="reset-mark success"><Check aria-hidden="true" /></div>
        <h1 id="reset-title">Password updated</h1>
        <p className="reset-description">Your password has been changed securely. You can now sign in with your new password.</p>
        <Link className="button green full reset-action" href="/">Return to sign in <ArrowRight size={16} /></Link>
      </> : !token ? <>
        <div className="reset-mark"><KeyRound aria-hidden="true" /></div>
        <h1 id="reset-title">Reset link unavailable</h1>
        <p className="reset-description">This link is missing or incomplete. Request a fresh password reset link from the sign-in screen.</p>
        <Link className="button green full reset-action" href="/">Back to Feedback Deo <ArrowRight size={16} /></Link>
      </> : <>
        <div className="reset-mark"><KeyRound aria-hidden="true" /></div>
        <h1 id="reset-title">Choose a new password</h1>
        <p className="reset-description">Set a new password for your Feedback Deo account. This link expires in 10 minutes and can only be used once.</p>
        <form className="reset-form" onSubmit={submit}>
          <label htmlFor="reset-new-password">New password
            <input id="reset-new-password" value={password} onChange={event => setPassword(event.target.value)} type="password" autoComplete="new-password" minLength={8} placeholder="At least 8 characters" required />
          </label>
          <label htmlFor="reset-confirm-password">Confirm new password
            <input id="reset-confirm-password" value={confirmation} onChange={event => setConfirmation(event.target.value)} type="password" autoComplete="new-password" minLength={8} placeholder="Enter it again" required />
          </label>
          {error && <p className="reset-error" role="alert">{error}</p>}
          <button className="button green full reset-action" type="submit" disabled={busy}>{busy ? 'Updating password…' : 'Set new password'} <ArrowRight size={16} /></button>
        </form>
        <p className="reset-security-note"><ShieldCheck aria-hidden="true" /> The link is private, expires in 10 minutes, and works once.</p>
      </>}
    </section>
  </main>
}
