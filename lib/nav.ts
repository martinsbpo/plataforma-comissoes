import type { UserRole } from '@/lib/permissions'

export type NavItem = {
  label: string
  href: string
  icon: string
}

export type NavGroup = {
  label?: string
  items: NavItem[]
}

const ALL_NAV: NavGroup[] = [
  {
    items: [
      { label: 'Dashboard', href: '/dashboard', icon: '📊' },
    ],
  },
  {
    label: 'Importação',
    items: [
      { label: 'Relatórios de Seguradoras', href: '/seguradoras', icon: '📥' },
      { label: 'Extrato Bancário', href: '/banco/upload', icon: '🏦' },
    ],
  },
  {
    label: 'Produção',
    items: [
      { label: 'Lançamentos', href: '/producao', icon: '📋' },
      { label: 'Parceiros', href: '/parceiros', icon: '🤝' },
    ],
  },
  {
    label: 'Financeiro',
    items: [
      { label: 'Apuração', href: '/financeiro', icon: '💰' },
      { label: 'Repasse', href: '/financeiro/repasse', icon: '💸' },
      { label: 'Conciliação', href: '/banco/conciliacao', icon: '🔄' },
    ],
  },
  {
    label: 'Fechamento',
    items: [
      { label: 'Fechamento', href: '/fechamento', icon: '🔒' },
    ],
  },
  {
    label: 'Administração',
    items: [
      { label: 'Usuários', href: '/admin/usuarios', icon: '👥' },
      { label: 'Configurações', href: '/admin/configuracoes', icon: '⚙️' },
    ],
  },
]

const ROUTE_ROLES: Record<string, UserRole[]> = {
  '/seguradoras':       ['bpo_admin', 'bpo_operador'],
  '/banco/upload':      ['bpo_admin', 'bpo_operador'],
  '/banco/conciliacao': ['bpo_admin', 'bpo_operador'],
  '/producao':          ['bpo_admin', 'bpo_operador', 'corretora_gestor', 'corretora_operador'],
  '/parceiros':         ['bpo_admin', 'bpo_operador', 'corretora_gestor', 'corretora_operador'],
  '/financeiro':        ['bpo_admin', 'bpo_operador', 'bpo_visualizador', 'corretora_gestor', 'parceiro'],
  '/financeiro/repasse':['bpo_admin', 'bpo_operador', 'bpo_visualizador', 'corretora_gestor', 'parceiro'],
  '/fechamento':        ['bpo_admin', 'bpo_operador'],
  '/admin/usuarios':    ['bpo_admin', 'corretora_gestor'],
  '/admin/configuracoes':['bpo_admin'],
}

export function getNavForRole(role: UserRole): NavGroup[] {
  return ALL_NAV.map(group => ({
    ...group,
    items: group.items.filter(item => {
      const allowed = ROUTE_ROLES[item.href]
      return !allowed || allowed.includes(role)
    }),
  })).filter(group => group.items.length > 0)
}
