'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { EmailAuthProvider, reauthenticateWithCredential, signOut } from 'firebase/auth'
import { AlertTriangle, ArrowLeft, Check, LoaderCircle, ShieldCheck } from 'lucide-react'
import { firebaseAuth, waitForFirebaseUser } from '@/lib/firebase/client'
import { ACCOUNT_DELETION_PHRASE } from '@/lib/account-deletion'

export default function AccountPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [phrase, setPhrase] = useState('')
  const [acknowledged, setAcknowledged] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  async function deleteAccount(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true); setError('')
    try {
      const user = await waitForFirebaseUser()
      if (!user || !user.email) throw new Error('Please log in again before deleting your account.')
      const credential = EmailAuthProvider.credential(user.email, password)
      await reauthenticateWithCredential(user, credential)
      const token = await user.getIdToken(true)
      const response = await fetch('/api/auth/delete-account', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ email, password, confirmationPhrase: phrase, acknowledged }) })
      const result = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(result.error || 'We could not delete your account.')
      await signOut(firebaseAuth)
      setSuccess(true)
      window.setTimeout(() => router.replace('/'), 1800)
    } catch (caught) {
      const reason = caught instanceof Error ? caught.message.toLowerCase() : ''
      setError(reason.includes('wrong-password') || reason.includes('invalid-credential') || reason.includes('auth/invalid-credential') ? 'The current password is incorrect.' : caught instanceof Error ? caught.message : 'We could not delete your account. Please try again.')
    } finally { setBusy(false) }
  }

  if (success) return <main className="dashboard-page"><div className="account-card success-state"><div className="success-mark"><Check size={22} /></div><h1>Account deleted</h1><p>Your Feedback Deo account and associated workspace data have been permanently deleted.</p></div></main>
  return <main className="dashboard-page"><div className="account-shell"><Link className="account-back" href="/dashboard"><ArrowLeft size={16} /> Back to dashboard</Link><div className="account-card"><div className="account-icon"><ShieldCheck /></div><p className="kicker">ACCOUNT SETTINGS</p><h1>Delete your account</h1><p className="account-lede">This permanently deletes your Feedback Deo account, workspaces, feedback, QR settings, notification connections, and related service records. This action cannot be undone.</p><div className="danger-notice"><AlertTriangle size={18} /><span><strong>Warning:</strong> this is permanent. All workspaces, reviews, feedback, QR settings, Telegram connections, billing records, and account information will be deleted. Export anything you need before continuing.</span></div><div className="danger-notice danger-notice-secondary"><AlertTriangle size={18} /><span><strong>Pro warning:</strong> deleting a Pro account ends access immediately. Pro payments are not refundable because of account deletion.</span></div><form className="modal-form" onSubmit={deleteAccount} noValidate><p className="deletion-step-warning"><strong>Step 1 — Verify ownership.</strong> Enter the current password for this account. Your password is checked by Firebase and is never stored by Feedback Deo.</p><label>Current password<input type="password" value={password} onChange={event => setPassword(event.target.value)} placeholder="Enter your current password" autoComplete="current-password" required /></label><p className="deletion-step-warning"><strong>Step 2 — Match your account.</strong> Enter the complete email address associated with this account. A mismatch stops deletion.</p><label>Account email<input type="email" value={email} onChange={event => setEmail(event.target.value)} placeholder="Enter the exact account email" autoComplete="email" required /></label><p className="deletion-step-warning"><strong>Step 3 — Confirm the permanent action.</strong> Type the exact phrase below. This cannot be undone.</p><label>Type <code>{ACCOUNT_DELETION_PHRASE}</code><input value={phrase} onChange={event => setPhrase(event.target.value)} placeholder={ACCOUNT_DELETION_PHRASE} required /></label><label className="checkbox-row"><input type="checkbox" checked={acknowledged} onChange={event => setAcknowledged(event.target.checked)} required /><span><strong>Final warning:</strong> I understand that account deletion is permanent, cannot be reversed, and that Pro payments are not refundable.</span></label>{error && <small className="form-error" role="alert">{error}</small>}<button className="button danger full" type="submit" disabled={busy || !acknowledged}>{busy ? <><LoaderCircle className="spin" size={16} /> Deleting account…</> : 'Permanently delete account'}</button></form><p className="account-support">Need help first? <a href="mailto:feedbackdeo@gmail.com">Contact feedbackdeo@gmail.com</a>.</p></div></div></main>
}
