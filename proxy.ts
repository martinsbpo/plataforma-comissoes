import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { NextResponse, type NextRequest } from 'next/server'
import { canAccessRoute } from '@/lib/permissions'
import type { UserRole } from '@/lib/permissions'

const PUBLIC_ROUTES = ['/', '/auth', '/acesso-negado', '/selecionar-corretora']

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Rotas públicas passam direto
  if (PUBLIC_ROUTES.some(r => pathname === r || pathname.startsWith(r + '/'))) {
    return NextResponse.next()
  }

  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value)
            response.cookies.set(name, value, options)
          })
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  console.log('[proxy] pathname:', pathname, '| user:', user?.email ?? 'null')

  // Não autenticado → volta para o login
  if (!user) {
    return NextResponse.redirect(new URL('/', request.url))
  }

  // Busca o vínculo ativo usando cliente admin (bypassa RLS)
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!
  )
  const { data: link } = await admin
    .from('user_tenant_links')
    .select('role, tenant_id')
    .eq('user_id', user.id)
    .eq('status', 'ativo')
    .order('created_at', { ascending: true })
    .limit(1)
    .single()

  // Sem vínculo ativo → acesso negado
  if (!link) {
    console.log('[proxy] user_id:', user.id, '| link não encontrado')
    return NextResponse.redirect(new URL('/acesso-negado', request.url))
  }

  // Usuário com mais de um tenant vai para o seletor (exceto se já está nele)
  if (pathname !== '/selecionar-corretora') {
    const { count } = await admin
      .from('user_tenant_links')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('status', 'ativo')

    // Parceiro com múltiplos tenants e sem tenant selecionado na sessão → seletor
    if ((count ?? 0) > 1 && link.role === 'parceiro' && !request.cookies.get('tenant_id')) {
      return NextResponse.redirect(new URL('/selecionar-corretora', request.url))
    }
  }

  // Verifica permissão de rota
  if (!canAccessRoute(link.role as UserRole, pathname)) {
    return NextResponse.redirect(new URL('/acesso-negado', request.url))
  }

  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
