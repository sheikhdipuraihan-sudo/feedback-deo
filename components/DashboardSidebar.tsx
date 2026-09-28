'use client'

import { useEffect, useState } from 'react'
import { BrainCircuit, Code2, CreditCard, LayoutDashboard, LogOut, Menu, MessageCircle, QrCode, Store, X } from 'lucide-react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { signOut as firebaseSignOut } from 'firebase/auth'
import { firebaseAuth } from '@/lib/firebase/client'

export default function DashboardSidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    if (!mobileOpen) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMobileOpen(false)
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', closeOnEscape)
    }
  }, [mobileOpen])

  function closeMenu() {
    setMobileOpen(false)
  }

  async function signOut() {
    await firebaseSignOut(firebaseAuth)
    router.replace('/')
  }

  return <>
    <header className="dashboard-mobile-header">
      <Link className="dashboard-mobile-mark" href="/" aria-label="Feedback Deo home">
        feedback <b>deo</b><small>.</small>
      </Link>
      <button
        type="button"
        className="dashboard-menu-toggle"
        aria-label={mobileOpen ? 'Close dashboard menu' : 'Open dashboard menu'}
        aria-expanded={mobileOpen}
        aria-controls="dashboard-mobile-navigation"
        onClick={() => setMobileOpen(open => !open)}
      >
        {mobileOpen ? <X /> : <Menu />}
      </button>
    </header>
    {mobileOpen && <button type="button" className="dashboard-sidebar-scrim" aria-label="Close dashboard menu" onClick={closeMenu} />}
    <aside id="dashboard-mobile-navigation" className={`dashboard-sidebar${mobileOpen ? ' mobile-open' : ''}`}>
      <div className="dashboard-sidebar-header">
        <Link className="dashboard-mark" href="/" aria-label="Feedback Deo home" onClick={closeMenu}>
          <span>feedback <b>deo</b><small>.</small></span>
        </Link>
        <button type="button" className="dashboard-sidebar-close" aria-label="Close dashboard menu" onClick={closeMenu}><X /></button>
      </div>
      <nav className="dashboard-nav" aria-label="Dashboard navigation">
        <Link className={pathname === '/dashboard' ? 'active' : ''} href="/dashboard" onClick={closeMenu}><LayoutDashboard /> Overview</Link>
        <Link href="/dashboard#space" onClick={closeMenu}><Store /> Feedback space</Link>
        <Link className={pathname === '/qr' ? 'active' : ''} href="/qr" onClick={closeMenu}><QrCode /> QR &amp; Links</Link>
        <Link href="/dashboard#telegram" onClick={closeMenu}><MessageCircle /> Telegram alerts</Link>
        <Link className={pathname === '/ai' ? 'active' : ''} href="/ai" onClick={closeMenu}><BrainCircuit /> Feedback Deo AI</Link>
        <Link className={pathname === '/widget' ? 'active' : ''} href="/widget" onClick={closeMenu}><Code2 /> Website widget</Link>
        <Link className={pathname === '/payment' ? 'active' : ''} href="/payment" onClick={closeMenu}><CreditCard /> Billing <span className="nav-chevron">›</span></Link>
        <button type="button" className="sidebar-nav-logout" onClick={signOut}><LogOut /> Log out</button>
      </nav>
    </aside>
  </>
}
