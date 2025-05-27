
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged } from 'firebase/auth';
import { clientAuth } from '@/lib/firebase/config'; // Firestore não é mais necessário aqui
import { Loader2 } from 'lucide-react';

export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(clientAuth, async (user) => {
      if (user) {
        // Usuário está logado, redireciona para o dashboard.
        // A verificação de 'isApproved' foi removida.
        router.replace('/dashboard');
      } else {
        // Nenhum usuário logado, redireciona para a página de login.
        router.replace('/login');
      }
    });

    return () => unsubscribe(); // Limpa a inscrição ao desmontar
  }, [router]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-background text-foreground">
      <Loader2 className="h-16 w-16 animate-spin text-primary mb-6" />
      <h1 className="text-2xl font-semibold mb-2">Carregando...</h1>
      <p className="text-muted-foreground">Redirecionando para a página apropriada.</p>
    </div>
  );
}
