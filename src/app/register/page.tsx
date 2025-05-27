// Esta página foi removida pois o sistema de registro foi desabilitado.
// Se você precisar reativar o registro no futuro, este arquivo precisará ser recriado
// com a lógica de registro e, possivelmente, o sistema de aprovação.

// Para manter a estrutura de arquivos e evitar erros de importação caso este arquivo
// seja referenciado em algum lugar (embora eu tenha tentado remover as referências),
// vou deixar um componente placeholder simples que redireciona para o login.

'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

export default function RegisterPageRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/login');
  }, [router]);

  return (
     <div className="flex flex-col items-center justify-center min-h-screen bg-background text-foreground">
      <Loader2 className="h-16 w-16 animate-spin text-primary mb-6" />
      <h1 className="text-2xl font-semibold mb-2">Registro Desabilitado</h1>
      <p className="text-muted-foreground">Redirecionando para a página de login...</p>
    </div>
  );
}
