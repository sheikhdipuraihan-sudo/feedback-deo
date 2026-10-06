import type { Metadata, Viewport } from "next"
import "./globals.css"
import "./referrals.css"
import RouteProgress from "@/components/RouteProgress"
import { LanguageProvider } from "@/lib/i18n"

export const metadata: Metadata = {
  title: "feedback deo — Know what your customers really think",
  description: "QR feedback, customer insights, and AI tools for restaurants, retailers, salons, clinics, schools, and businesses of every kind.",
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#f7f8f4",
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body><LanguageProvider><RouteProgress />{children}</LanguageProvider></body></html>
}
