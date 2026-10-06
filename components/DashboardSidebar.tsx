'use client'

import { useEffect, useState } from 'react'
import { BrainCircuit, Code2, CreditCard, Gift, LayoutDashboard, LogOut, Menu, MessageCircle, QrCode, Settings, Store, X } from 'lucide-react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { signOutCurrentUser } from '@/lib/firebase/client'
import { LanguageToggle, useLanguage } from '@/lib/i18n'

export default function DashboardSidebar() {
  const { t } = useLanguage()
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
    await signOutCurrentUser()
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
        aria-label={mobileOpen ? t('nav.closeMenu') : t('nav.openMenu')}
        aria-expanded={mobileOpen}
        aria-controls="dashboard-mobile-navigation"
        onClick={() => setMobileOpen(open => !open)}
      >
        {mobileOpen ? <X /> : <Menu />}
      </button>
    </header>
    {mobileOpen && <button type="button" className="dashboard-sidebar-scrim" aria-label={t('nav.closeMenu')} onClick={closeMenu} />}
    <aside id="dashboard-mobile-navigation" className={`dashboard-sidebar${mobileOpen ? ' mobile-open' : ''}`}>
      <div className="dashboard-sidebar-header">
        <Link className="dashboard-mark" href="/" aria-label="Feedback Deo home" onClick={closeMenu}>
          <span>feedback <b>deo</b><small>.</small></span>
        </Link>
        <button type="button" className="dashboard-sidebar-close" aria-label={t('nav.closeMenu')} onClick={closeMenu}><X /></button>
      </div>
      <div className="dashboard-sidebar-language"><LanguageToggle /></div>
      <nav className="dashboard-nav" aria-label="Dashboard navigation">
        <Link className={pathname === '/dashboard' ? 'active' : ''} href="/dashboard" onClick={closeMenu}><LayoutDashboard /> {t('nav.overview')}</Link>
        <Link href="/dashboard#space" onClick={closeMenu}><Store /> {t('nav.feedbackSpace')}</Link>
        <Link className={pathname === '/qr' ? 'active' : ''} href="/qr" onClick={closeMenu}><QrCode /> {t('nav.qrLinks')}</Link>
        <Link href="/dashboard#telegram" onClick={closeMenu}><MessageCircle /> {t('nav.telegram')}</Link>
        <Link className={pathname === '/ai' ? 'active' : ''} href="/ai" onClick={closeMenu}><BrainCircuit /> {t('nav.ai')}</Link>
        <Link className={pathname === '/widget' ? 'active' : ''} href="/widget" onClick={closeMenu}><Code2 /> {t('nav.widget')}</Link>
        <Link className={pathname === '/referrals' ? 'active' : ''} href="/referrals" onClick={closeMenu}><Gift /> {t('nav.referrals')}</Link>
        <Link className={pathname === '/payment' ? 'active' : ''} href="/payment" onClick={closeMenu}><CreditCard /> {t('nav.billing')} <span className="nav-chevron">›</span></Link>
        <Link className={pathname === '/account' ? 'active' : ''} href="/account" onClick={closeMenu}><Settings /> {t('nav.account')}</Link>
        <button type="button" className="sidebar-nav-logout" onClick={signOut}><LogOut /> {t('nav.logout')}</button>
      </nav>
    </aside>
  </>
}
