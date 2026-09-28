import Link from 'next/link'

export const metadata = {
  title: 'Privacy Policy | Feedback Deo',
  description: 'How Feedback Deo collects, uses, protects, and deletes personal information.',
}

export default function PrivacyPage() {
  return <main className="legal-page"><div className="legal-shell">
    <Link className="legal-brand" href="/">feedback <span>deo</span>.</Link>
    <p className="kicker">LEGAL</p>
    <h1>Privacy Policy</h1>
    <p className="legal-lede">This Privacy Policy explains how Feedback Deo handles personal information when you visit our website, create an account, or use our customer-feedback tools.</p>
    <p className="legal-updated">Effective date: September 28, 2026</p>
    <section><h2>1. Information we collect</h2><p>We may collect account information such as your email address, business name, authentication identifiers, plan and billing details, and messages you send us. When you use the service, we process workspace settings, QR and feedback-point configuration, customer ratings and comments, usage events, and notification connection details. We also receive technical information such as device, browser, IP address, and log data needed for security and reliability.</p></section>
    <section><h2>2. How we use information</h2><p>We use information to provide and secure Feedback Deo, authenticate users, operate workspaces, display and analyze feedback, deliver requested notifications, process payments, provide support, prevent abuse, troubleshoot problems, measure performance, and comply with law. We do not sell personal information.</p></section>
    <section><h2>3. Customer feedback</h2><p>Businesses using Feedback Deo control the feedback they invite and may be responsible for explaining their own collection practices to customers. Feedback submitted through a public feedback link may be available to the associated business. Avoid submitting information that is not necessary for the feedback purpose, especially sensitive personal information.</p></section>
    <section><h2>4. Service providers</h2><p>We use trusted infrastructure and service providers for authentication, hosting, databases, email delivery, payment processing, analytics, AI processing when enabled, and messaging integrations. They receive only the information reasonably needed to provide their services and are expected to protect it. Some providers may process information in countries other than yours.</p></section>
    <section><h2>5. AI processing</h2><p>If you use Feedback Deo AI, relevant workspace context and feedback records may be sent to the configured AI service to generate a response. Do not include unnecessary personal or confidential information in feedback. AI output may be inaccurate and should be reviewed by a human.</p></section>
    <section><h2>6. Retention and deletion</h2><p>We retain information while your account is active and for as long as needed for the purposes described here, including security, legal, accounting, and dispute-resolution obligations. You can request permanent account deletion from the Account page. Deletion removes account-linked workspaces and associated service records where technically and legally permitted; backups and legally required records may persist for a limited period.</p></section>
    <section><h2>7. Security</h2><p>We use access controls, authenticated requests, encryption in transit, and security monitoring appropriate to the service. No online service can guarantee absolute security. Keep your password private and contact us promptly if you believe your account has been compromised.</p></section>
    <section><h2>8. Your choices and rights</h2><p>Depending on where you live, you may have rights to access, correct, export, restrict, or delete personal information, or to object to certain processing. You can update account information in the service and contact us to exercise applicable rights. We may need to verify your identity before completing a request.</p></section>
    <section><h2>9. Children</h2><p>Feedback Deo is intended for businesses and is not directed to children. We do not knowingly collect personal information from children in violation of applicable law.</p></section>
    <section><h2>10. Changes and contact</h2><p>We may update this policy as the service or legal requirements change. We will post the revised version with a new effective date. For privacy questions or requests, contact <a href="mailto:feedbackdeo@gmail.com">feedbackdeo@gmail.com</a>.</p></section>
    <div className="legal-footer"><Link href="/terms">Terms of Service</Link><Link href="/">Back to Feedback Deo</Link></div>
  </div></main>
}
