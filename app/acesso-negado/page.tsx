import Link from 'next/link'

export default function AcessoNegadoPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-10 w-full max-w-sm flex flex-col items-center gap-6 text-center">
        <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center text-red-600 text-2xl">
          🚫
        </div>
        <div className="flex flex-col gap-2">
          <h1 className="text-xl font-semibold text-gray-900">Acesso negado</h1>
          <p className="text-sm text-gray-500">
            Você não tem permissão para acessar esta página.
            Entre em contato com o administrador da plataforma.
          </p>
        </div>
        <Link
          href="/dashboard"
          className="text-sm text-blue-600 hover:underline"
        >
          Voltar para o início
        </Link>
      </div>
    </div>
  )
}
