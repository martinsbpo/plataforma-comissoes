import { LoginButton } from "@/components/auth/login-button";

export default function Home() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-10 w-full max-w-sm flex flex-col items-center gap-8">
        <div className="flex flex-col items-center gap-2 text-center">
          <h1 className="text-2xl font-semibold text-gray-900">
            Plataforma de Comissões
          </h1>
          <p className="text-sm text-gray-500">
            Martins BPO Financeiro
          </p>
        </div>
        <LoginButton />
        <p className="text-xs text-gray-400 text-center">
          Acesso exclusivo para colaboradores da Martins BPO
        </p>
      </div>
    </div>
  );
}
