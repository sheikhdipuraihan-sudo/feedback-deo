import Link from 'next/link'
import { ArrowLeft, Mail } from 'lucide-react'

export const metadata = {
  title: 'Contact | Feedback Deo',
  description: 'Contact Feedback Deo at feedbackdeo@gmail.com.',
}

export default function ContactPage() {
  return <main className="legal-page"><div className="contact-card">
    <Link className="legal-brand" href="/">feedback <span>deo</span>.</Link>
    <p className="kicker">GET IN TOUCH</p>
    <h1>We’re here to help.</h1>
    <p className="legal-lede">Have a question about Feedback Deo, your account, billing, or customer feedback? Send us an email and our team will get back to you.</p>
    <a className="button green contact-email-button" href="mailto:feedbackdeo@gmail.com?subject=Feedback%20Deo%20support"><Mail size={17} /> Email feedbackdeo@gmail.com</a>
    <p className="contact-note">We aim to respond as soon as possible during business hours.</p>
    <div className="legal-footer"><Link href="/terms">Terms of Service</Link><Link href="/privacy">Privacy Policy</Link><Link href="/">Back to Feedback Deo</Link></div>
  </div></main>
}
