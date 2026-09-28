import nodemailer from 'nodemailer'

export const ACCOUNT_CONFIRMATION_BASE_URL = 'https://feedback-deo.vercel.app'

function escapeHtml(value: string) {
  return value.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll("'", '&#39;')
}

export function buildAccountConfirmationEmail(verificationLink: string, businessName?: string) {
  const safeLink = escapeHtml(verificationLink)
  const safeBusinessName = escapeHtml((businessName || '').trim())
  const greeting = safeBusinessName ? `Welcome, ${safeBusinessName}!` : 'Welcome to Feedback Deo!'
  return {
    subject: 'Confirm your Feedback Deo account',
    text: `Thanks for creating your Feedback Deo account${businessName ? ` for ${businessName}` : ''}. Confirm your email address by opening this link:\n\n${verificationLink}\n\nIf you did not create a Feedback Deo account, you can safely ignore this email.`,
    html: `<div style="margin:0;background:#f7f8f4;padding:32px 16px;font-family:Arial,sans-serif;line-height:1.6;color:#132b26"><div style="max-width:520px;margin:0 auto;background:#ffffff;border:1px solid #dfe8e2;border-radius:16px;overflow:hidden"><div style="padding:24px 28px;background:#132b26;color:#ffffff;font-size:22px;font-weight:700;letter-spacing:-.5px">feedback <span style="color:#8de0ba">deo</span><span style="color:#8de0ba">.</span></div><div style="padding:30px 28px"><div style="display:inline-block;padding:7px 10px;border-radius:999px;background:#d9f7e9;color:#1c9c6a;font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase">Account confirmation</div><h2 style="margin:18px 0 8px;font-size:26px;line-height:1.2">${greeting}</h2><p style="margin:0 0 22px;color:#64746f">Confirm your email address to finish setting up your Feedback Deo account.</p><p style="margin:0 0 22px"><a href="${safeLink}" style="display:inline-block;padding:13px 20px;border-radius:9px;background:#1c9c6a;color:#ffffff;font-size:15px;font-weight:700;text-decoration:none">Confirm my account</a></p><p style="margin:0;color:#64746f;font-size:13px">If the button does not work, copy and paste this address into your browser:<br/><a href="${safeLink}" style="color:#14784f;word-break:break-all">${safeLink}</a></p><p style="margin:18px 0 0;color:#64746f;font-size:13px">If you did not create a Feedback Deo account, you can safely ignore this email.</p></div><div style="padding:18px 28px;border-top:1px solid #dfe8e2;color:#64746f;font-size:12px">Feedback Deo · Simple customer feedback for local businesses.</div></div></div>`,
  }
}

export async function sendAccountConfirmationEmail(email: string, verificationLink: string, businessName?: string) {
  const user = process.env.GMAIL_USER || process.env.SMTP_USER
  const password = process.env.GMAIL_APP_PASSWORD || process.env.SMTP_APP_PASSWORD
  if (!user || !password) throw new Error('Gmail SMTP environment is not configured.')
  const transporter = nodemailer.createTransport({ service: 'gmail', auth: { user, pass: password } })
  await transporter.sendMail({
    from: `Feedback Deo <${user}>`,
    to: email,
    ...buildAccountConfirmationEmail(verificationLink, businessName),
  })
}
