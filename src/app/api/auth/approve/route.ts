// Esta rota da API foi removida pois o sistema de aprovação de usuários foi desabilitado.
// Se você precisar reativar a aprovação de usuários no futuro, esta rota
// e a lógica associada precisarão ser recriadas.

import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json(
    { message: 'Funcionalidade de aprovação de usuário desabilitada.' },
    { status: 404 }
  );
}
