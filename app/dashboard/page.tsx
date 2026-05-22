import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { getNavForRole } from '@/lib/nav'
import { AppLayout } from '@/components/layout/app-layout'

const QUICK_ACTIONS: Record<string, { label: string; href: string; icon: string }[]> = {
  bpo_admin: [
    { label: 'Importar Relatório', href: '/seguradoras', icon: '📥' },
    { label: 'Ver Pendências', href: '/producao', icon: '⚠️' },
    { label: 'Fechar Período', href: '/fechamento', icon: '🔒' },
  ],
  bpo_operador: [
    { label: 'Importar Relatório', href: '/seguradoras', icon: '📥' },
    { label: 'Ver Pendências', href: '/producao', icon: '⚠️' },
    { label: 'Fechar Período', href: '/fechamento', icon: '🔒' },
  ],
  bpo_visualizador: [
    { label: 'Ver Apuração', href: '/financeiro', icon: '💰' },
    { label: 'Relatórios', href: '/relatorios', icon: '📊' },
  ],
  corretora_gestor: [
    { label: 'Lançar Produção', href: '/producao', icon: '📋' },
    { label: 'Ver Repasse', href: '/financeiro/repasse', icon: '💸' },
    { label: 'Cadastrar Parceiro', href: '/parceiros', icon: '🤝' },
  ],
  corretora_operador: [
    { label: 'Lançar Produção', href: '/producao', icon: '📋' },
    { label: 'Cadastrar Parceiro', href: '/parceiros', icon: '🤝' },
  ],
  parceiro: [
    { label: 'Ver Minha Produção', href: '/producao', icon: '📋' },
    { label: 'Ver Meus Recebimentos', href: '/financeiro', icon: '💰' },
  ],
}

export default async function DashboardPage() {
  const session = await getSession()
  if (!session) redirect('/')

  const nav = getNavForRole(session.role)
  const actions = QUICK_ACTIONS[session.role] ?? []

  return (
    <AppLayout session={session} nav={nav} breadcrumb={[{ label: 'Dashboard' }]}>
      <div className="flex flex-col gap-6 max-w-4xl">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">
            Olá, {session.nome?.split(' ')[0] ?? 'bem-vindo(a)'}!
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {session.tenantNome} · <span className="capitalize">{session.role.replace(/_/g, ' ')}</span>
          </p>
        </div>

        {/* Ações rápidas */}
        <div>
          <h2 className="text-sm font-medium text-gray-500 mb-3">Acesso rápido</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {actions.map(action => (
              <a
                key={action.href}
                href={action.href}
                className="bg-white border border-gray-200 rounded-xl p-4 flex items-center gap-3 hover:border-[#5B7291] hover:shadow-sm transition-all"
              >
                <span className="text-2xl">{action.icon}</span>
                <span className="text-sm font-medium text-gray-800">{action.label}</span>
              </a>
            ))}
          </div>
        </div>

        {/* Resumo do período */}
        <div>
          <h2 className="text-sm font-medium text-gray-500 mb-3">Período atual</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              { label: 'Status', value: 'Aberto', color: 'text-amber-600 bg-amber-50' },
              { label: 'Comissões recebidas', value: '—', color: 'text-gray-700 bg-gray-50' },
              { label: 'Repasses calculados', value: '—', color: 'text-gray-700 bg-gray-50' },
            ].map(card => (
              <div key={card.label} className="bg-white border border-gray-200 rounded-xl p-4">
                <p className="text-xs text-gray-400 mb-1">{card.label}</p>
                <p className={`text-sm font-semibold px-2 py-0.5 rounded-full inline-block ${card.color}`}>
                  {card.value}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </AppLayout>
  )
}
