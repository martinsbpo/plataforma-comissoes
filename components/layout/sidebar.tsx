'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { NavGroup } from '@/lib/nav'

type Props = {
  nav: NavGroup[]
  tenantNome: string
  tenantColor?: string | null
  logoUrl?: string | null
  collapsed: boolean
  onToggle: () => void
}

export function Sidebar({ nav, tenantNome, tenantColor, logoUrl, collapsed, onToggle }: Props) {
  const pathname = usePathname()
  const color = tenantColor ?? '#5B7291'

  return (
    <aside
      className={`flex flex-col h-screen sticky top-0 transition-all duration-200 ${collapsed ? 'w-16' : 'w-64'}`}
      style={{ backgroundColor: color }}
    >
      {/* Logo / Nome */}
      <div className="flex items-center gap-3 px-4 py-5 border-b border-white/10">
        {logoUrl && (
          <img src={logoUrl} alt={tenantNome} className="w-8 h-8 rounded object-contain bg-white p-0.5 shrink-0" />
        )}
        {!collapsed && (
          <span className="text-white font-semibold text-sm leading-tight truncate">{tenantNome}</span>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-3 px-2 flex flex-col gap-4">
        {nav.map((group, gi) => (
          <div key={gi}>
            {group.label && !collapsed && (
              <p className="text-white/40 text-[10px] font-medium uppercase tracking-wider px-2 mb-1">
                {group.label}
              </p>
            )}
            {group.label && collapsed && gi > 0 && (
              <div className="border-t border-white/10 my-2" />
            )}
            {group.items.map(item => {
              const active = pathname === item.href || pathname.startsWith(item.href + '/')
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  title={collapsed ? item.label : undefined}
                  className={`flex items-center gap-3 px-2 py-1.5 rounded-lg text-xs transition-colors ${
                    active
                      ? 'bg-white/20 text-white font-medium'
                      : 'text-white/70 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  <span className="text-base shrink-0">{item.icon}</span>
                  {!collapsed && <span className="truncate">{item.label}</span>}
                </Link>
              )
            })}
          </div>
        ))}
      </nav>

      {/* Toggle */}
      <button
        onClick={onToggle}
        className="flex items-center justify-center py-4 border-t border-white/10 text-white/50 hover:text-white transition-colors"
        title={collapsed ? 'Expandir menu' : 'Recolher menu'}
      >
        <span className="text-lg">{collapsed ? '→' : '←'}</span>
      </button>
    </aside>
  )
}
