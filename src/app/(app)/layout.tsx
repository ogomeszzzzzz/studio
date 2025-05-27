
'use client';

import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged, signOut, User as FirebaseUser } from 'firebase/auth';
import { clientAuth, firestore } from '@/lib/firebase/config';
import { doc, getDoc } from 'firebase/firestore';
import { AppHeader } from '@/components/domain/AppHeader'; // Assuming you might reuse or adapt this
import { Button } from '@/components/ui/button';
import { Loader2, LogOut, LayoutDashboard, BarChartBig, UserCircle } from 'lucide-react';
import Link from 'next/link';
import { useToast } from '@/hooks/use-toast';

interface AppLayoutProps {
  children: ReactNode;
}

export default function AppLayout({ children }: AppLayoutProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [isApproved, setIsApproved] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(clientAuth, async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        // Check approval status
        if (!firestore) {
            toast({ title: 'Erro', description: 'Serviço de banco de dados não disponível.', variant: 'destructive'});
            await handleSignOut();
            setLoading(false);
            return;
        }
        const userDocRef = doc(firestore, 'users', currentUser.uid);
        const userDocSnap = await getDoc(userDocRef);
        if (userDocSnap.exists() && userDocSnap.data().isApproved) {
          setIsApproved(true);
        } else {
          setIsApproved(false);
          toast({ title: 'Acesso Negado', description: 'Sua conta não está aprovada ou não foi encontrada.', variant: 'destructive' });
          await handleSignOut(); // Log out if not approved or data missing
        }
      } else {
        setUser(null);
        setIsApproved(false);
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
      router.push('/login');
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

  if (!user || !isApproved) {
    // This case should ideally be handled by the redirect in useEffect,
    // but as a fallback, prevent rendering children.
    return (
       <div className="flex items-center justify-center min-h-screen bg-background">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="ml-4 text-lg text-foreground">Verificando autenticação...</p>
      </div>
    );
  }
  
  // A simple header for the authenticated area
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
          {user && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <UserCircle className="h-5 w-5" />
              <span>{user.email}</span>
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
