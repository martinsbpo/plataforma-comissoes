export type UserRole =
  | 'bpo_admin'
  | 'bpo_operador'
  | 'bpo_visualizador'
  | 'corretora_gestor'
  | 'corretora_operador'
  | 'parceiro'

export type Permission =
  | 'cadastrar_parceiros'
  | 'inputar_producao'
  | 'ver_financeiro'
  | 'fechar_periodo'
  | 'reabrir_periodo'
  | 'upload_relatorio_seguradora'
  | 'config_layouts_seguradora'
  | 'upload_extrato_bancario'
  | 'conciliacao_bancaria'
  | 'ver_dashboards'
  | 'convidar_usuarios'
  | 'configuracoes_globais'

const PERMISSIONS: Record<Permission, UserRole[]> = {
  cadastrar_parceiros:        ['bpo_admin', 'bpo_operador', 'corretora_gestor', 'corretora_operador'],
  inputar_producao:           ['bpo_admin', 'bpo_operador', 'corretora_gestor', 'corretora_operador'],
  ver_financeiro:             ['bpo_admin', 'bpo_operador', 'bpo_visualizador', 'corretora_gestor', 'parceiro'],
  fechar_periodo:             ['bpo_admin', 'bpo_operador'],
  reabrir_periodo:            ['bpo_admin'],
  upload_relatorio_seguradora:['bpo_admin', 'bpo_operador'],
  config_layouts_seguradora:  ['bpo_admin'],
  upload_extrato_bancario:    ['bpo_admin', 'bpo_operador'],
  conciliacao_bancaria:       ['bpo_admin', 'bpo_operador'],
  ver_dashboards:             ['bpo_admin', 'bpo_operador', 'bpo_visualizador', 'corretora_gestor'],
  convidar_usuarios:          ['bpo_admin', 'corretora_gestor'],
  configuracoes_globais:      ['bpo_admin'],
}

// Rotas protegidas → perfis mínimos permitidos
export const ROUTE_PERMISSIONS: Record<string, UserRole[]> = {
  '/dashboard':               ['bpo_admin', 'bpo_operador', 'bpo_visualizador', 'corretora_gestor', 'corretora_operador', 'parceiro'],
  '/parceiros':               ['bpo_admin', 'bpo_operador', 'bpo_visualizador', 'corretora_gestor', 'corretora_operador'],
  '/producao':                ['bpo_admin', 'bpo_operador', 'corretora_gestor', 'corretora_operador'],
  '/financeiro':              ['bpo_admin', 'bpo_operador', 'bpo_visualizador', 'corretora_gestor', 'parceiro'],
  '/relatorios':              ['bpo_admin', 'bpo_operador', 'bpo_visualizador', 'corretora_gestor'],
  '/fechamento':              ['bpo_admin', 'bpo_operador'],
  '/seguradoras':             ['bpo_admin', 'bpo_operador'],
  '/banco':                   ['bpo_admin', 'bpo_operador'],
  '/admin/corretoras':        ['bpo_admin'],
  '/admin/seguradoras':       ['bpo_admin'],
  '/admin/produtos':          ['bpo_admin'],
  '/admin/aliquotas':         ['bpo_admin', 'bpo_operador'],
  '/admin/usuarios':          ['bpo_admin', 'corretora_gestor'],
  '/admin/configuracoes':     ['bpo_admin'],
  '/admin/layouts':           ['bpo_admin'],
}

export function hasPermission(role: UserRole, permission: Permission): boolean {
  return PERMISSIONS[permission].includes(role)
}

export function canAccessRoute(role: UserRole, pathname: string): boolean {
  const match = Object.keys(ROUTE_PERMISSIONS)
    .sort((a, b) => b.length - a.length) // match mais específico primeiro
    .find(route => pathname === route || pathname.startsWith(route + '/'))

  if (!match) return true // rota não listada = pública
  return ROUTE_PERMISSIONS[match].includes(role)
}
