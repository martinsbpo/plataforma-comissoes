import { redirect } from 'next/navigation'
import { getUserTenants } from '@/lib/auth'
import { SelecionarCorretoraForm } from './form'

export default async function SelecionarCorretoraPage() {
  const tenants = await getUserTenants()

  if (tenants.length === 0) redirect('/acesso-negado')
  if (tenants.length === 1) redirect('/dashboard')

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-10 w-full max-w-sm flex flex-col gap-6">
        <div className="flex flex-col gap-1">
          <h1 className="text-xl font-semibold text-gray-900">Selecionar corretora</h1>
          <p className="text-sm text-gray-500">
            Você está vinculado a mais de uma corretora. Escolha com qual deseja trabalhar agora.
          </p>
        </div>
        <SelecionarCorretoraForm tenants={tenants} />
      </div>
    </div>
  )
}
