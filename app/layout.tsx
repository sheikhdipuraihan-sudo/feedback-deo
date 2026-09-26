import type { Metadata } from "next"
import "./globals.css"

export const metadata: Metadata = {
  title: "feedback deo — Know what your customers really think",
  description: "Simple QR feedback for restaurants and local businesses in Bangladesh.",
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>
}
