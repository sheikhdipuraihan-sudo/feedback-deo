import type { MetadataRoute } from 'next'
import { siteUrl } from '@/lib/seo'

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = '2026-10-08'
  return [
    { url: siteUrl, lastModified, changeFrequency: 'daily', priority: 1 },
    { url: `${siteUrl}/contact`, lastModified, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${siteUrl}/privacy`, lastModified, changeFrequency: 'yearly', priority: 0.2 },
    { url: `${siteUrl}/terms`, lastModified, changeFrequency: 'yearly', priority: 0.2 },
  ]
}
