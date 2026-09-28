import { createHmac, randomBytes } from 'node:crypto'
import nodemailer from 'nodemailer'
import { createClient } from '@supabase/supabase-js'

export const RESET_LINK_TTL_MINUTES = 10
export const PASSWORD_RESET_BASE_URL = 'https://feedback-deo.vercel.app'
const RESET_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/

export function normalizeResetEmail(email: string) {
  return email.trim().toLowerCase()
}

export function createResetToken() {
  return randomBytes(32).toString('base64url')
}

export function hashResetToken(token: string) {
  const secret = process.env.PASSWORD_RESET_TOKEN_SECRET || process.env.PASSWORD_RESET_OTP_SECRET
  if (!secret) throw new Error('Password reset token secret is not configured.')
  return createHmac('sha256', secret).update(token).digest('hex')
}

export function createResetLink(token: string) {
  if (!RESET_TOKEN_PATTERN.test(token)) throw new Error('Password reset token is malformed.')
  const url = new URL('/reset-password', PASSWORD_RESET_BASE_URL)
  // Keep the bearer token in the URL fragment so it is not sent in HTTP requests or referrer headers.
  url.hash = new URLSearchParams({ token }).toString()
  return url.toString()
}

function escapeHtml(value: string) {
  return value.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll("'", '&#39;')
}

export function buildResetEmail(resetLink: string) {
  const safeLink = escapeHtml(resetLink)
  return {
    subject: 'Reset your Feedback Deo password',
    text: `Use this one-time link to choose a new Feedback Deo password:\n\n${resetLink}\n\nThe link expires in ${RESET_LINK_TTL_MINUTES} minutes and can only be used once. If you did not request a password reset, you can safely ignore this email.`,
    html: `<div style="margin:0;background:#f7f8f4;padding:32px 16px;font-family:Arial,sans-serif;line-height:1.6;color:#132b26"><div style="max-width:520px;margin:0 auto;background:#ffffff;border:1px solid #dfe8e2;border-radius:16px;overflow:hidden"><div style="padding:24px 28px;background:#132b26;color:#ffffff;font-size:22px;font-weight:700;letter-spacing:-.5px">feedback <span style="color:#8de0ba">deo</span><span style="color:#8de0ba">.</span></div><div style="padding:30px 28px"><div style="display:inline-block;padding:7px 10px;border-radius:999px;background:#d9f7e9;color:#1c9c6a;font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase">Password reset</div><h2 style="margin:18px 0 8px;font-size:26px;line-height:1.2">Choose a new password</h2><p style="margin:0 0 22px;color:#64746f">Use the secure button below to set a new password for your Feedback Deo account.</p><p style="margin:0 0 22px"><a href="${safeLink}" style="display:inline-block;padding:13px 20px;border-radius:9px;background:#1c9c6a;color:#ffffff;font-size:15px;font-weight:700;text-decoration:none">Reset password</a></p><p style="margin:0;color:#64746f;font-size:13px">This one-time link expires in ${RESET_LINK_TTL_MINUTES} minutes and can only be used once. If the button does not work, copy and paste this address into your browser:<br/><a href="${safeLink}" style="color:#14784f;word-break:break-all">${safeLink}</a></p><p style="margin:18px 0 0;color:#64746f;font-size:13px">Didn’t request a reset? You can safely ignore this email; your password will not change.</p></div><div style="padding:18px 28px;border-top:1px solid #dfe8e2;color:#64746f;font-size:12px">Feedback Deo · Simple customer feedback for local businesses.</div></div></div>`,
  }
}

export function getPasswordResetAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) throw new Error('Supabase service-role environment is not configured.')
  return createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } })
}

export async function sendResetLink(email: string, resetLink: string) {
  const user = process.env.GMAIL_USER || process.env.SMTP_USER
  const password = process.env.GMAIL_APP_PASSWORD || process.env.SMTP_APP_PASSWORD
  if (!user || !password) throw new Error('Gmail SMTP environment is not configured.')
  const transporter = nodemailer.createTransport({ service: 'gmail', auth: { user, pass: password } })
  await transporter.sendMail({
    from: `Feedback Deo <${user}>`,
    to: email,
    ...buildResetEmail(resetLink),
  })
}
