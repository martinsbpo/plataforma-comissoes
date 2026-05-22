'use client'

import { useState } from 'react'
import { Sidebar } from './sidebar'
import { Header } from './header'
import type { UserSession } from '@/lib/auth'
import type { NavGroup } from '@/lib/nav'

type Props = {
  session: UserSession
  nav: NavGroup[]
  tenantColor?: string | null
  logoUrl?: string | null
  breadcrumb?: { label: string; href?: string }[]
  children: React.ReactNode
}

export function AppLayout({ session, nav, tenantColor, logoUrl, breadcrumb, children }: Props) {
  const [collapsed, setCollapsed] = useState(false)

  return (
    <div className="flex h-screen bg-[#F8F9FA] overflow-hidden">
      <Sidebar
        nav={nav}
        tenantNome={session.tenantNome}
        tenantColor={tenantColor}
        logoUrl={logoUrl}
        collapsed={collapsed}
        onToggle={() => setCollapsed(c => !c)}
      />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Header session={session} breadcrumb={breadcrumb} />
        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
