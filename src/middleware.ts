
import { NextResponse, type NextRequest } from 'next/server';

// O middleware será simplificado para não interferir na lógica de autenticação
// do Firebase SDK no lado do cliente, que é gerenciada pelos layouts e páginas.

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // A página raiz (app/page.tsx) já lida com o redirecionamento inicial
  // para /login ou /dashboard baseado no estado de autenticação.
  // Se o usuário tentar acessar uma rota protegida diretamente sem estar logado,
  // o (app)/layout.tsx tratará do redirecionamento para /login.
  // Se o usuário tentar acessar /login já logado, login/page.tsx tratará disso.

  if (pathname.startsWith('/api/auth/approve')) {
    // Permitir acesso à rota de aprovação (se ainda existir, embora tenha sido removida na lógica de login padrão)
    return NextResponse.next();
  }

  // Para a maioria das outras rotas, apenas permitir que prossigam.
  // A proteção de rotas (/dashboard, /collection-analyzer) é feita no (app)/layout.tsx.
  // A lógica para redirecionar de /login se já autenticado está em login/page.tsx.
  // A página raiz (app/page.tsx) redireciona para /login ou /dashboard.

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - assets (any other static assets)
     * - Excluímos explicitamente a api/auth/approve para o caso de ser reativada,
     *   mas atualmente ela não existe mais com o login padrão.
     * A regra original já excluía a maioria dos assets estáticos.
     */
    '/((?!_next/static|_next/image|favicon.ico|assets).*)',
  ],
};
