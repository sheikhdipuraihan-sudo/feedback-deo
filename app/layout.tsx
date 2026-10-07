import type { Metadata, Viewport } from 'next'
import './globals.css'
import './referrals.css'
import RouteProgress from '@/components/RouteProgress'
import { LanguageProvider } from '@/lib/i18n'
import { siteDescription, siteName, siteUrl } from '@/lib/seo'

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: 'Feedback Deo | QR Customer Feedback for Local Businesses',
    template: '%s | Feedback Deo',
  },
  description: siteDescription,
  keywords: ['customer feedback', 'QR feedback', 'customer reviews', 'feedback form', 'business feedback', 'customer experience'],
  applicationName: siteName,
  authors: [{ name: siteName, url: siteUrl }],
  creator: siteName,
  publisher: siteName,
  verification: { google: 'QYfyN7diScd1vh0SCDK0f62v-ob46iFFriWX3lSo-4Y' },
  alternates: { canonical: siteUrl },
  openGraph: {
    type: 'website',
    url: siteUrl,
    siteName,
    title: 'Feedback Deo | QR Customer Feedback for Local Businesses',
    description: siteDescription,
    locale: 'en_US',
    images: [{ url: '/og-image.png', width: 1200, height: 630, alt: 'Feedback Deo customer feedback platform' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Feedback Deo | QR Customer Feedback for Local Businesses',
    description: siteDescription,
    images: ['/og-image.png'],
  },
  robots: { index: true, follow: true, googleBot: { index: true, follow: true, 'max-image-preview': 'large', 'max-snippet': -1, 'max-video-preview': -1 } },
  icons: { icon: [{ url: '/favicon-32x32.png', type: 'image/png', sizes: '32x32' }, { url: '/icon.svg', type: 'image/svg+xml' }], apple: '/apple-touch-icon.png' },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#f7f8f4',
}

const structuredData = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'Organization',
      '@id': `${siteUrl}/#organization`,
      name: siteName,
      url: siteUrl,
      logo: `${siteUrl}/icon.svg`,
      email: 'feedbackdeo@gmail.com',
    },
    {
      '@type': 'SoftwareApplication',
      '@id': `${siteUrl}/#software`,
      name: siteName,
      url: siteUrl,
      applicationCategory: 'BusinessApplication',
      operatingSystem: 'Web',
      description: siteDescription,
      provider: { '@id': `${siteUrl}/#organization` },
    },
  ],
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body><LanguageProvider><RouteProgress />{children}</LanguageProvider><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} /></body></html>
}
