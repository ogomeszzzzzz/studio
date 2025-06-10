
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2 } from 'lucide-react';

export default function HomePage() {
  const router = useRouter();
  const { currentUser, isLoading } = useAuth();

  useEffect(() => {
    console.log('[HomePage] useEffect triggered. isLoading:', isLoading, 'currentUser:', !!currentUser);
    if (!isLoading) {
      if (currentUser && currentUser.isApproved) {
        console.log('[HomePage] User is authenticated and approved. Redirecting to /dashboard...');
        router.replace('/dashboard');
      } else if (currentUser && !currentUser.isApproved && currentUser.pendingApproval) {
        console.log('[HomePage] User is authenticated but pending approval. Redirecting to /login (AppLayout should handle showing pending message)...');
        router.replace('/login'); // AppLayout will show pending message if user is logged in but not approved
      } else if (currentUser && !currentUser.isApproved && !currentUser.pendingApproval) {
        console.log('[HomePage] User is authenticated but not approved and not pending (denied). Redirecting to /login (AppLayout should show denied message)...');
        router.replace('/login'); // AppLayout will show denied message
      } else {
        console.log('[HomePage] No authenticated user or user issue. Redirecting to /login...');
        router.replace('/login');
      }
    } else {
      console.log('[HomePage] Still loading auth state...');
    }
  }, [currentUser, isLoading, router]);

  // Fallback UI while loading or before redirect is fully processed by Next.js
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-background text-foreground">
      <Loader2 className="h-16 w-16 animate-spin text-primary mb-6" />
      <h1 className="text-2xl font-semibold mb-2">Carregando Aplicação...</h1>
      <p className="text-muted-foreground">
        {isLoading ? 'Verificando sua sessão...' : 'Redirecionando...'}
      </p>
      <p className="text-xs text-muted-foreground mt-4">
        (Se esta tela persistir, verifique o console do navegador para erros.)
      </p>
    </div>
  );
}
