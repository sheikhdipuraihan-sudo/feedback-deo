import type { ReactNode } from 'react'
import DashboardSidebar from '@/components/DashboardSidebar'

type DashboardPageFrameProps = {
  children: ReactNode
  mainClassName?: string
}

export default function DashboardPageFrame({ children, mainClassName = '' }: DashboardPageFrameProps) {
  const mainClasses = ['dashboard-main', mainClassName].filter(Boolean).join(' ')

  return <main className="dashboard-page"><div className="dashboard-shell">
    <DashboardSidebar />
    <div className={mainClasses}>{children}</div>
  </div></main>
}
