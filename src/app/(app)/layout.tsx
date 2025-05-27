
'use client';

import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged, signOut, User as FirebaseUser } from 'firebase/auth';
import { clientAuth } from '@/lib/firebase/config'; // Firestore não é mais necessário aqui para isApproved
import { AppHeader } from '@/components/domain/AppHeader';
import { Button } from '@/components/ui/button';
import { Loader2, LogOut, LayoutDashboard, BarChartBig, UserCircle } from 'lucide-react';
import Link from 'next/link';
import { useToast } from '@/hooks/use-toast';
import type { UserProfile } from '@/types';


interface AppLayoutProps {
  children: ReactNode;
}

export default function AppLayout({ children }: AppLayoutProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(clientAuth, async (firebaseUser) => {
      if (firebaseUser) {
        // Usuário está logado via Firebase Auth.
        // Não precisamos mais verificar 'isApproved' no Firestore para este layout simplificado.
        setUserProfile({ uid: firebaseUser.uid, email: firebaseUser.email });
      } else {
        // Ninguém logado, redireciona para login.
        setUserProfile(null);
        router.push('/login');
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, [router, toast]);

  const handleSignOut = async () => {
    try {
      await signOut(clientAuth);
      toast({ title: 'Logout', description: 'Você foi desconectado.' });
      router.push('/login'); // Redireciona para login após o logout
    } catch (error) {
      console.error('Error signing out:', error);
      toast({ title: 'Erro de Logout', description: 'Não foi possível desconectar.', variant: 'destructive' });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="ml-4 text-lg text-foreground">Carregando aplicação...</p>
      </div>
    );
  }

  if (!userProfile) {
    // Este caso deve ser tratado pelo redirecionamento no useEffect,
    // mas como fallback, previne a renderização dos filhos e mostra o loader.
    return (
       <div className="flex items-center justify-center min-h-screen bg-background">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="ml-4 text-lg text-foreground">Verificando autenticação...</p>
      </div>
    );
  }
  
  const AuthenticatedHeader = () => (
    <header className="bg-card border-b border-border shadow-sm sticky top-0 z-50">
      <div className="container mx-auto px-4 md:px-6 lg:px-8 py-3 flex items-center justify-between">
        <Link href="/dashboard" className="flex items-center gap-2">
            <LayoutDashboard className="h-7 w-7 text-primary" />
            <h1 className="text-xl font-semibold text-foreground hidden sm:block">
            Painel Altenburg
            </h1>
        </Link>
        <div className="flex items-center gap-3">
          {userProfile && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <UserCircle className="h-5 w-5" />
              <span>{userProfile.email}</span>
            </div>
          )}
          <Button variant="outline" size="sm" onClick={handleSignOut}>
            <LogOut className="mr-2 h-4 w-4" />
            Sair
          </Button>
        </div>
      </div>
    </header>
  );


  return (
    <div className="flex min-h-screen">
      <nav className="w-64 bg-card border-r border-border p-4 space-y-6 hidden md:flex flex-col shadow-md">
        <div>
            <Link href="/dashboard" className="flex items-center gap-2 text-primary p-2 rounded-md hover:bg-muted">
                <LayoutDashboard className="h-6 w-6" />
                <span className="font-medium">Dashboard</span>
            </Link>
        </div>
        <div>
            <Link href="/collection-analyzer" className="flex items-center gap-2 text-foreground p-2 rounded-md hover:bg-muted">
                <BarChartBig className="h-6 w-6" />
                <span className="font-medium">Gap Analyzer</span>
            </Link>
        </div>
        {/* Add more navigation links here */}
      </nav>
      <div className="flex-1 flex flex-col bg-background">
        <AuthenticatedHeader />
        <main className="flex-grow p-4 md:p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
