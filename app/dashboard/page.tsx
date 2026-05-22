import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/");
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-10 w-full max-w-md flex flex-col gap-4">
        <h1 className="text-xl font-semibold text-gray-900">Dashboard</h1>
        <p className="text-sm text-gray-600">
          Bem-vindo(a), <span className="font-medium">{user.email}</span>
        </p>
        <p className="text-xs text-gray-400">
          Login realizado com sucesso via Microsoft.
        </p>
      </div>
    </div>
  );
}
