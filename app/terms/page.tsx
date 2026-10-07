import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Terms of Service | Feedback Deo',
  description: 'The terms that govern use of Feedback Deo customer-feedback tools.',
  alternates: { canonical: '/terms' },
}

export default function TermsPage() {
  return <main className="legal-page"><div className="legal-shell">
    <Link className="legal-brand" href="/">feedback <span>deo</span>.</Link>
    <p className="kicker">LEGAL</p>
    <h1>Terms of Service</h1>
    <p className="legal-lede">These Terms of Service govern your access to and use of Feedback Deo. By creating an account or using the service, you agree to these terms.</p>
    <p className="legal-updated">Effective date: October 6, 2026</p>
    <section><h2>1. The service</h2><p>Feedback Deo provides tools that help businesses collect, organize, and understand customer feedback, including feedback links, QR codes, dashboards, analytics, notifications, and optional AI-assisted summaries. Features may vary by plan and may change as the service develops.</p></section>
    <section><h2>2. Accounts and eligibility</h2><p>You must provide accurate information, keep your credentials confidential, and promptly notify us of suspected unauthorized access. You are responsible for activity conducted through your account and for ensuring that your use of the service complies with applicable law. You may not create an account for a person or business you are not authorized to represent.</p></section>
    <section><h2>3. Acceptable use</h2><p>You may not misuse the service, interfere with its operation, bypass security or plan limits, upload malicious code, infringe another person’s rights, or use Feedback Deo to collect unlawful, fraudulent, or abusive content. You are responsible for the feedback you invite, collect, and act on.</p></section>
    <section><h2>4. Your content and privacy responsibilities</h2><p>You retain ownership of content you submit or collect through the service. You grant Feedback Deo the limited rights needed to host, process, display, secure, and improve the service at your direction. You must provide appropriate notices and obtain any permissions required before collecting personal information from your customers. Do not submit sensitive personal information unless the feature and your legal basis for doing so support it.</p></section>
    <section><h2>5. AI-assisted features</h2><p>AI summaries and suggestions are provided for convenience, may be incomplete or inaccurate, and are not professional, legal, financial, medical, or compliance advice. Review outputs before relying on them, and do not use them as the sole basis for consequential decisions.</p></section>
    <section><h2>6. Plans, payments, and changes</h2><p>Paid features, prices, billing terms, and applicable taxes are shown in your account. The optional Refer &amp; Earn program awards one point only when a genuinely new invitee verifies an email address and creates an active workspace. Five qualified points may be redeemed for one calendar month of complimentary Pro access; there is no fixed lifetime redemption cap. Points are non-transferable, have no cash value, and are not paid-plan credits. One account and one signed browser/device token may each be attributed once; self-referrals, duplicate or fabricated accounts, and other manipulation do not qualify. We may withhold or reverse rewards tied to abuse. We may suspend or limit access when payment is not received, when these terms are violated, or when needed to protect the service or users. We may modify features or these terms; material changes will be communicated through the service or to the account email when appropriate.</p></section>
    <section><h2>7. Intellectual property</h2><p>Feedback Deo and its software, branding, designs, and documentation are owned by Feedback Deo or its licensors. Except for the limited right to use the service under these terms, no intellectual-property rights are transferred to you.</p></section>
    <section><h2>8. Disclaimers</h2><p>The service is provided on an “as available” basis. To the fullest extent permitted by law, Feedback Deo disclaims warranties not expressly stated in these terms, including implied warranties of merchantability, fitness for a particular purpose, and non-infringement. We do not guarantee uninterrupted, error-free, or lossless operation.</p></section>
    <section><h2>9. Limitation of liability</h2><p>To the fullest extent permitted by law, Feedback Deo and its contributors will not be liable for indirect, incidental, special, consequential, exemplary, or punitive damages, or for loss of profits, revenue, data, goodwill, or business opportunities arising from use of the service. Our aggregate liability for claims relating to the service will not exceed the amount you paid us for the service during the twelve months before the event giving rise to the claim, or 100 USD if you paid nothing.</p></section>
    <section><h2>10. Termination and deletion</h2><p>You may stop using the service and delete your account from the Account page. Account deletion is permanent and may remove workspaces, feedback, settings, and related records. We may retain limited information where required by law, for legitimate security or accounting purposes, or to resolve disputes.</p></section>
    <section><h2>11. Contact</h2><p>Questions about these terms can be sent to <a href="mailto:feedbackdeo@gmail.com">feedbackdeo@gmail.com</a>.</p></section>
    <div className="legal-footer"><Link href="/privacy">Privacy Policy</Link><Link href="/">Back to Feedback Deo</Link></div>
  </div></main>
}
