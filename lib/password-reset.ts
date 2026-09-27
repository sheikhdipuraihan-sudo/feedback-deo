import { createHash, randomInt } from 'node:crypto'
import nodemailer from 'nodemailer'
import { createClient } from '@supabase/supabase-js'

export function normalizeResetEmail(email: string) {
  return email.trim().toLowerCase()
}

export function createResetCode() {
  return String(randomInt(100000, 1000000))
}

export function hashResetCode(email: string, code: string) {
  const secret = process.env.PASSWORD_RESET_OTP_SECRET
  if (!secret) throw new Error('PASSWORD_RESET_OTP_SECRET is not configured.')
  return createHash('sha256').update(`${secret}:${normalizeResetEmail(email)}:${code}`).digest('hex')
}

export function getPasswordResetAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) throw new Error('Supabase service-role environment is not configured.')
  return createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } })
}

export async function sendResetCode(email: string, code: string) {
  const user = process.env.GMAIL_USER || process.env.SMTP_USER
  const password = process.env.GMAIL_APP_PASSWORD || process.env.SMTP_APP_PASSWORD
  if (!user || !password) throw new Error('Gmail SMTP environment is not configured.')
  const transporter = nodemailer.createTransport({ service: 'gmail', auth: { user, pass: password } })
  await transporter.sendMail({
    from: `Feedback Deo <${user}>`,
    to: email,
    subject: 'Your Feedback Deo password reset code',
    text: `Your Feedback Deo password reset code is ${code}. It expires in 10 minutes. If you did not request this, you can ignore this email.`,
    html: `<div style="margin:0;background:#f7f8f4;padding:32px 16px;font-family:Arial,sans-serif;line-height:1.6;color:#132b26"><div style="max-width:520px;margin:0 auto;background:#ffffff;border:1px solid #dfe8e2;border-radius:16px;overflow:hidden"><div style="padding:24px 28px;background:#132b26;color:#ffffff;font-size:22px;font-weight:700;letter-spacing:-.5px">feedback <span style="color:#8de0ba">deo</span><span style="color:#8de0ba">.</span></div><div style="padding:30px 28px"><div style="display:inline-block;padding:7px 10px;border-radius:999px;background:#d9f7e9;color:#1c9c6a;font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase">Password reset</div><h2 style="margin:18px 0 8px;font-size:26px;line-height:1.2">Your secure reset code</h2><p style="margin:0 0 20px;color:#64746f">Use this one-time code to choose a new Feedback Deo password:</p><div style="padding:18px;text-align:center;background:#edf9f3;border:1px solid #cfeadd;border-radius:12px"><span style="font-size:36px;font-weight:700;letter-spacing:10px;color:#1c9c6a">${code}</span><br/><a href="#" onclick="try{navigator.clipboard.writeText('${code}')}catch(e){};return false;" style="display:inline-block;margin-top:16px;padding:10px 16px;border-radius:8px;background:#1c9c6a;color:#ffffff;text-decoration:none;font-size:13px;font-weight:700">Copy code</a></div><p style="margin:20px 0 0;color:#64746f;font-size:13px">This code expires in 10 minutes and can only be used once. If the button is unavailable, press and hold the code to copy it.</p><p style="margin:18px 0 0;color:#64746f;font-size:13px">Didn’t see this email? Check your spam or junk folder. If you did not request a reset, you can safely ignore this email.</p></div><div style="padding:18px 28px;border-top:1px solid #dfe8e2;color:#64746f;font-size:12px">Feedback Deo · Simple customer feedback for local businesses.</div></div></div>`,
  })
}
