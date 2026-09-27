'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'

export default function RouteProgress() {
  const pathname = usePathname()
  const [active, setActive] = useState(false)

  useEffect(() => {
    const timer = window.setTimeout(() => setActive(false), 0)
    return () => window.clearTimeout(timer)
  }, [pathname])

  useEffect(() => {
    function handleClick(event: MouseEvent) {
      const target = event.target as HTMLElement | null
      const link = target?.closest('a')
      if (!link || link.target === '_blank' || link.hasAttribute('download') || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
      const href = link.getAttribute('href')
      if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) return
      try {
        const url = new URL(href, window.location.origin)
        if (url.origin === window.location.origin && url.pathname !== window.location.pathname) setActive(true)
      } catch {}
    }
    document.addEventListener('click', handleClick, true)
    return () => document.removeEventListener('click', handleClick, true)
  }, [])

  return active ? <div className="site-progress" role="progressbar" aria-label="Loading page" /> : null
}
