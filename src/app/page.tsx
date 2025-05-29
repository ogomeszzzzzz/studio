
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2 } from 'lucide-react';

export default function HomePage() {
  const router = useRouter();
  const { currentUser, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading) {
      if (currentUser && currentUser.isApproved) {
        router.replace('/dashboard');
      } else {
        // If not loading, and no approved user, redirect to login.
        // This covers cases like: no user, user not approved, or user pending approval.
        // The login page or app layout will handle showing specific messages for pending/not approved.
        router.replace('/login');
      }
    }
  }, [currentUser, isLoading, router]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-background text-foreground">
      <Loader2 className="h-16 w-16 animate-spin text-primary mb-6" />
      <h1 className="text-2xl font-semibold mb-2">Carregando...</h1>
      <p className="text-muted-foreground">Verificando sua sessão.</p>
    </div>
  );
}
