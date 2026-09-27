import type { Metadata, Viewport } from "next"
import "./globals.css"
import RouteProgress from "@/components/RouteProgress"

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
  return <html lang="en"><body><RouteProgress />{children}</body></html>
}
