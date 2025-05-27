
'use server';

// As funções registerUser e approveUserByToken foram removidas
// pois o sistema de registro e aprovação foi desabilitado.
// O login agora é direto com credenciais pré-definidas.

// Se você precisar de outras ações do servidor relacionadas à autenticação no futuro,
// elas podem ser adicionadas aqui.

// Exemplo de uma ação de login do servidor (atualmente não usada diretamente pela página de login,
// já que o login é primariamente client-side com Firebase SDK)
export async function loginUserServerAction(prevState: any, formData: FormData) {
  const email = formData.get('email') as string;
  const password = formData.get('password') as string;

  if (!email || !password) {
    return { message: 'Email e senha são obrigatórios.', status: 'error' };
  }
  // Simulação de uma verificação do lado do servidor, se necessário.
  // Para o login atual, a lógica principal está no cliente.
  console.log(`[Server Action] Tentativa de login para: ${email}`);
  return { message: 'Processando login...', status: 'pending' };
}
