
'use client';

import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { clientAuth } from '@/lib/firebase/config';
import { Button } from '@/components/ui/button';
import { Loader2, LogOut, LayoutDashboard, UserCircle, PackageSearch, BedDouble, Store, Building, ChevronDown } from 'lucide-react';
import Link from 'next/link';
import { useToast } from '@/hooks/use-toast';
import type { UserProfile } from '@/types';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { cn } from '@/lib/utils';


interface AppLayoutProps {
  children: ReactNode;
}

export default function AppLayout({ children }: AppLayoutProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeAccordionItem, setActiveAccordionItem] = useState<string | undefined>(undefined);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(clientAuth, async (firebaseUser) => {
      if (firebaseUser) {
        setUserProfile({ uid: firebaseUser.uid, email: firebaseUser.email });
      } else {
        setUserProfile(null);
        router.replace('/login');
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, [router]);

  useEffect(() => {
    // Automatically open the "E-Commerce" accordion if a sub-link is active
    // This is a simple check, can be made more robust if needed
    if (router.pathname?.startsWith('/dashboard') || router.pathname?.startsWith('/restock-opportunities') || router.pathname?.startsWith('/pillow-stock')) {
      setActiveAccordionItem("ecommerce-category");
    } else {
      // Optionally close or set to another default if Varejo items are added
      // setActiveAccordionItem(undefined); 
    }
  }, [router.pathname]);

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

  if (!userProfile) {
    return (
       <div className="flex items-center justify-center min-h-screen bg-background">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="ml-4 text-lg text-foreground">Redirecionando para o login...</p>
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
      <nav className="w-64 bg-card border-r border-border p-4 space-y-1 hidden md:flex flex-col shadow-md">
        <Accordion type="single" collapsible className="w-full" value={activeAccordionItem} onValueChange={setActiveAccordionItem}>
          <AccordionItem value="ecommerce-category" className="border-b-0">
            <AccordionTrigger className="p-3 rounded-md hover:bg-muted hover:text-primary transition-colors text-foreground font-medium text-sm no-underline [&[data-state=open]>svg]:text-primary">
              <div className="flex items-center gap-3">
                <Store className="h-5 w-5" />
                <span>E-Commerce</span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="pt-1 pb-0 pl-4 space-y-1">
              <Link href="/dashboard" className={cn("flex items-center gap-3 text-foreground p-3 rounded-md hover:bg-muted hover:text-primary transition-colors pl-5", router.pathname === "/dashboard" && "bg-muted text-primary font-semibold")}>
                  <LayoutDashboard className="h-5 w-5" />
                  <span className="font-medium text-sm">Dashboard</span>
              </Link>
              <Link href="/restock-opportunities" className={cn("flex items-center gap-3 text-foreground p-3 rounded-md hover:bg-muted hover:text-primary transition-colors pl-5", router.pathname === "/restock-opportunities" && "bg-muted text-primary font-semibold")}>
                  <PackageSearch className="h-5 w-5" />
                  <span className="font-medium text-sm">Oportunidades Reabast.</span>
              </Link>
              <Link href="/pillow-stock" className={cn("flex items-center gap-3 text-foreground p-3 rounded-md hover:bg-muted hover:text-primary transition-colors pl-5", router.pathname === "/pillow-stock" && "bg-muted text-primary font-semibold")}>
                  <BedDouble className="h-5 w-5" />
                  <span className="font-medium text-sm">Estoque Travesseiros</span>
              </Link>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="retail-category" className="border-b-0">
            <AccordionTrigger className="p-3 rounded-md hover:bg-muted hover:text-primary transition-colors text-foreground font-medium text-sm no-underline [&[data-state=open]>svg]:text-primary">
                <div className="flex items-center gap-3">
                    <Building className="h-5 w-5" />
                    <span>Varejo</span>
                </div>
            </AccordionTrigger>
            <AccordionContent className="pt-1 pb-0 pl-4">
              <p className="p-3 text-xs text-muted-foreground pl-5">Nenhuma opção disponível.</p>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
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
