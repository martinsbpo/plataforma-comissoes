'use client'

import { useRouter } from 'next/navigation'

type TenantData = {
  id: string
  nome: string
  nome_fantasia: string | null
  logo_url: string | null
}

type Tenant = {
  tenant_id: string
  role: string
  tenants: TenantData | TenantData[] | null
}

function getTenant(t: Tenant): TenantData | null {
  if (!t.tenants) return null
  return Array.isArray(t.tenants) ? t.tenants[0] ?? null : t.tenants
}

export function SelecionarCorretoraForm({ tenants }: { tenants: Tenant[] }) {
  const router = useRouter()

  async function selecionar(tenantId: string) {
    await fetch('/api/selecionar-corretora', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tenantId }),
    })
    router.push('/dashboard')
    router.refresh()
  }

  return (
    <div className="flex flex-col gap-3">
      {tenants.map((t) => (
        <button
          key={t.tenant_id}
          onClick={() => selecionar(t.tenant_id)}
          className="w-full text-left px-4 py-3 rounded-xl border border-gray-200 hover:border-blue-500 hover:bg-blue-50 transition-colors"
        >
          <p className="font-medium text-gray-900 text-sm">
            {getTenant(t)?.nome_fantasia ?? getTenant(t)?.nome ?? 'Corretora'}
          </p>
          <p className="text-xs text-gray-400 capitalize">{t.role.replace('_', ' ')}</p>
        </button>
      ))}
    </div>
  )
}
