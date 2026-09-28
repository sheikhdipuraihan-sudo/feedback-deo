import type { Metadata } from 'next'
import ResetPasswordForm from '@/components/ResetPasswordForm'

export const metadata: Metadata = {
  title: 'Reset your password | Feedback Deo',
  description: 'Set a new password securely for your Feedback Deo account.',
  referrer: 'no-referrer',
  robots: { index: false, follow: false },
}

export default function ResetPasswordPage() {
  return <ResetPasswordForm />
}
