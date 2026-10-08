import type { MetadataRoute } from 'next'
import { siteUrl } from '@/lib/seo'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: '*', allow: '/', disallow: ['/dashboard', '/account', '/admin', '/ai', '/qr', '/widget', '/api/'] }],
    sitemap: `${siteUrl}/sitemap.xml`,
  }
}
