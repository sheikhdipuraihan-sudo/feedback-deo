import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Feedback Deo',
    short_name: 'Feedback Deo',
    description: 'Start free with QR customer feedback for local businesses.',
    start_url: '/',
    display: 'standalone',
    background_color: '#f7f8f4',
    theme_color: '#164333',
    icons: [{ src: '/favicon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' }, { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }],
  }
}
