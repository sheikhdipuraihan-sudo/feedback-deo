'use client'

import { QRCodeSVG } from 'qrcode.react'
import Image from 'next/image'

type QrTheme = 'default' | 'modern' | 'minimal' | 'gradient' | 'neon' | 'dark' | 'elegant' | 'business' | 'glass' | 'premium' | 'rounded' | 'soft' | 'luxury' | 'vibrant' | 'custom-brand'

const themes: QrTheme[] = ['default', 'modern', 'minimal', 'gradient', 'neon', 'dark', 'elegant', 'business', 'glass', 'premium', 'rounded', 'soft', 'luxury', 'vibrant', 'custom-brand']

function safeTheme(value?: string | null): QrTheme {
  return themes.includes(value as QrTheme) ? value as QrTheme : 'default'
}

function safeInk(value?: string | null) {
  if (!value || !/^#[\da-f]{6}$/i.test(value)) return '#132b26'
  const channels = value.slice(1).match(/[\da-f]{2}/gi)?.map(part => parseInt(part, 16) / 255) || [0.07, 0.17, 0.15]
  const linear = channels.map(channel => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4)
  const luminance = 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2]
  return luminance > 0.35 ? '#132b26' : value
}

export type BrandedQrProps = {
  value: string
  businessName: string
  logo?: string | null
  brandText?: string | null
  brandColor?: string | null
  theme?: string | null
  layout?: string | null
  compact?: boolean
}

export default function BrandedQr({ value, businessName, logo, brandText, brandColor, theme, layout, compact = false }: BrandedQrProps) {
  const activeTheme = safeTheme(theme)
  const ink = safeInk(brandColor)
  const activeLayout = ['stacked', 'compact', 'centered'].includes(layout || '') ? layout : 'stacked'
  return <div className={`qr-artwork qr-theme-${activeTheme} qr-layout-${activeLayout}${compact ? ' is-compact' : ''}`} data-qr-artwork style={{ '--qr-ink': ink } as React.CSSProperties}>
    <div className="qr-customer-brand">
      {logo && <Image className="qr-customer-logo" src={logo} alt={`${businessName || 'Business'} logo`} width={320} height={320} unoptimized loading="eager" />}
      <strong>{businessName || 'Your business'}</strong>
      {brandText?.trim() && <span className="qr-brand-text">{brandText.trim()}</span>}
    </div>
    <div className="qr-code-wrap"><QRCodeSVG value={value} size={compact ? 96 : 144} bgColor="#ffffff" fgColor={ink} level="H" marginSize={4} title={`Feedback QR code for ${businessName || 'your business'}`} /></div>
    <div className="qr-powered">Powered by <strong>Feedback <span>Deo</span></strong></div>
  </div>
}
