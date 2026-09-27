'use client'

import { BrainCircuit, CreditCard, LayoutDashboard, LogOut, MessageCircle, QrCode, Store } from 'lucide-react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { signOut as firebaseSignOut } from 'firebase/auth'
import { firebaseAuth } from '@/lib/firebase/client'

export default function DashboardSidebar() {
  const pathname = usePathname()
  const router = useRouter()

  async function signOut() {
    await firebaseSignOut(firebaseAuth)
    router.replace('/')
  }

  return <aside className="dashboard-sidebar">
    <Link className="dashboard-mark" href="/" aria-label="Feedback Deo home"><span>feedback <b>deo</b><small>.</small></span></Link>
    <nav className="dashboard-nav" aria-label="Dashboard navigation">
      <Link className={pathname === '/dashboard' ? 'active' : ''} href="/dashboard"><LayoutDashboard /> Overview</Link>
      <Link href="/dashboard#space"><Store /> Feedback space</Link>
      <Link className={pathname === '/qr' ? 'active' : ''} href="/qr"><QrCode /> QR &amp; Links</Link>
      <Link href="/dashboard#telegram"><MessageCircle /> Telegram alerts</Link>
      <Link className={pathname === '/ai' ? 'active' : ''} href="/ai"><BrainCircuit /> Feedback Deo AI</Link>
      <Link className={pathname === '/payment' ? 'active' : ''} href="/payment"><CreditCard /> Billing <span className="nav-chevron">›</span></Link>
      <button type="button" className="sidebar-nav-logout" onClick={signOut}><LogOut /> Log out</button>
    </nav>
  </aside>
}
