'use client'

import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { UserSession } from '@/lib/auth'

type Props = {
  session: UserSession
  breadcrumb?: { label: string; href?: string }[]
}

export function Header({ session, breadcrumb }: Props) {
  const router = useRouter()
  const supabase = createClient()

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/')
    router.refresh()
  }

  const initials = session.nome
    ? session.nome.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()
    : session.email.slice(0, 2).toUpperCase()

  return (
    <header className="bg-white border-b border-gray-200 px-6 py-0">
      <div className="flex items-center justify-between h-14">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-1 text-sm text-gray-500">
          {breadcrumb && breadcrumb.length > 0 ? (
            breadcrumb.map((crumb, i) => (
              <span key={i} className="flex items-center gap-1">
                {i > 0 && <span className="text-gray-300">›</span>}
                {crumb.href ? (
                  <a href={crumb.href} className="hover:text-gray-900 transition-colors">{crumb.label}</a>
                ) : (
                  <span className="text-gray-900 font-medium">{crumb.label}</span>
                )}
              </span>
            ))
          ) : (
            <span className="text-gray-400 text-xs">{session.tenantNome}</span>
          )}
        </nav>

        {/* Usuário */}
        <div className="flex items-center gap-3">
          <div className="text-right hidden sm:block">
            <p className="text-sm font-medium text-gray-900 leading-tight">{session.nome ?? session.email}</p>
            <p className="text-xs text-gray-400">{session.role.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</p>
          </div>
          <div className="w-8 h-8 rounded-full bg-[#5B7291] flex items-center justify-center text-white text-xs font-semibold">
            {initials}
          </div>
          <button
            onClick={handleLogout}
            className="text-xs text-gray-400 hover:text-red-500 transition-colors ml-1"
            title="Sair"
          >
            Sair
          </button>
        </div>
      </div>
    </header>
  )
}
