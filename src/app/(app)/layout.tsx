
'use client';

import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, LogOut, LayoutDashboard, UserCircle, ShieldCheck, Store, Building, TrendingUp, BarChart, BedDouble, Lock } from 'lucide-react';
import Link from 'next/link';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

interface AppLayoutProps {
  children: ReactNode;
}

// Fallback admin email if NEXT_PUBLIC_ADMIN_EMAIL is not set
const ADMIN_PRIMARY_EMAIL_CLIENT = process.env.NEXT_PUBLIC_ADMIN_EMAIL || "gustavo.cordeiro@altenburg.com.br";

export default function AppLayout({ children }: AppLayoutProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { toast } = useToast();
  const { currentUser, logout, isLoading: authContextLoading } = useAuth();
  const [activeAccordionItem, setActiveAccordionItem] = useState<string | undefined>(undefined);
  const [isUserAdmin, setIsUserAdmin] = useState(false);
  const [isUserApproved, setIsUserApproved] = useState(false);
  const [isUserDataLoaded, setIsUserDataLoaded] = useState(false);


  useEffect(() => {
    if (!authContextLoading && currentUser) {
      const isAdminByFlag = currentUser.isAdmin === true;
      const isAdminByEmail = currentUser.email.toLowerCase() === ADMIN_PRIMARY_EMAIL_CLIENT.toLowerCase();
      
      setIsUserAdmin(isAdminByEmail || isAdminByFlag);
      setIsUserApproved(currentUser.isApproved === true);
      setIsUserDataLoaded(true);

      if (isAdminByFlag && !isAdminByEmail) {
        console.warn("AppLayout: User has isAdmin flag true, but email does not match ADMIN_PRIMARY_EMAIL_CLIENT. Proceeding as admin based on flag.");
      }
      if (!isAdminByFlag && isAdminByEmail) {
        console.log(`AppLayout: User ${currentUser.email} matches ADMIN_PRIMARY_EMAIL_CLIENT, ensuring admin status.`);
        setIsUserAdmin(true); // Ensure primary admin is always admin
        setIsUserApproved(true); // Ensure primary admin is always approved
      }

    } else if (!authContextLoading && !currentUser) {
      setIsUserAdmin(false);
      setIsUserApproved(false);
      setIsUserDataLoaded(true);
      if (pathname !== '/login' && pathname !== '/register') {
        router.replace('/login');
      }
    }
  }, [authContextLoading, currentUser, router, pathname]);


  useEffect(() => {
    if (pathname?.startsWith('/admin')) {
      setActiveAccordionItem("admin-category");
    } else if (pathname?.startsWith('/dashboard') || pathname?.startsWith('/restock-opportunities') || pathname?.startsWith('/pillow-stock') || pathname?.startsWith('/abc-analysis')) {
      setActiveAccordionItem("ecommerce-category");
    } else if (pathname?.startsWith('/retail')) {
      setActiveAccordionItem("retail-category");
    }
  }, [pathname]);


  const handleSignOut = () => {
    logout();
    toast({ title: 'Logout', description: 'Você foi desconectado.' });
    // router.push('/login'); // AuthContext or HomePage will handle redirect
  };

  if (authContextLoading || (!isUserDataLoaded && !authContextLoading && currentUser)) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="ml-4 text-lg text-foreground">Carregando sessão...</p>
      </div>
    );
  }

  if (!currentUser && (pathname !== '/login' && pathname !== '/register')) {
    return (
        <div className="flex items-center justify-center min-h-screen bg-background">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
            <p className="ml-4 text-lg text-foreground">Redirecionando para o login...</p>
        </div>
    );
  }
  
  // Special handling for the primary admin email to always be considered approved.
  const effectivelyApproved = (currentUser?.email.toLowerCase() === ADMIN_PRIMARY_EMAIL_CLIENT.toLowerCase()) || isUserApproved;

  if (currentUser && !effectivelyApproved && currentUser.pendingApproval) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-background p-6">
        <Card className="w-full max-w-md text-center shadow-lg">
          <CardHeader>
            <CardTitle className="text-2xl font-semibold text-primary">Conta Pendente de Aprovação</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-4">
              Obrigado por se registrar, {currentUser.name || currentUser.email}! Sua conta está aguardando aprovação do administrador.
            </p>
            <p className="text-sm text-muted-foreground">Você será notificado ou poderá tentar fazer login novamente mais tarde.</p>
          </CardContent>
          <CardFooter>
            <Button variant="outline" onClick={handleSignOut} className="w-full">
              <LogOut className="mr-2 h-4 w-4" /> Sair e tentar mais tarde
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  if (currentUser && !effectivelyApproved && !currentUser.pendingApproval) {
      return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-background p-6">
        <Card className="w-full max-w-md text-center shadow-lg">
          <CardHeader>
            <CardTitle className="text-2xl font-semibold text-destructive">Acesso Negado</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-4">
              Sua conta não tem permissão para acessar esta aplicação ou não foi aprovada.
            </p>
            <p className="text-sm text-muted-foreground">Por favor, contate o administrador.</p>
          </CardContent>
          <CardFooter>
            <Button variant="outline" onClick={handleSignOut} className="w-full">
              <LogOut className="mr-2 h-4 w-4" /> Sair
            </Button>
          </CardFooter>
        </Card>
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
          {currentUser && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <UserCircle className="h-5 w-5" />
              <span>{currentUser.email}</span>
               {isUserAdmin && <Badge variant="outline" className="border-green-600 text-green-700">Admin</Badge>}
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

  if (!authContextLoading && !currentUser && (pathname === '/login' || pathname === '/register')) {
    return <>{children}</>;
  }
  
  if (!authContextLoading && !currentUser) {
     return <div className="flex items-center justify-center h-screen"><Loader2 className="h-12 w-12 animate-spin text-primary" /><p className="ml-3">Redirecionando...</p></div>;
  }
  
  if (currentUser && effectivelyApproved) {
    return (
        <div className="flex min-h-screen">
        <nav className="w-64 bg-card border-r border-border p-4 space-y-1 hidden md:flex flex-col shadow-md">
            <Accordion type="single" collapsible className="w-full" value={activeAccordionItem} onValueChange={setActiveAccordionItem}>
            
            <AccordionItem value="admin-category" className="border-b-0">
                <AccordionTrigger
                className={cn(
                    "p-3 rounded-md hover:bg-muted hover:text-primary transition-colors text-foreground font-medium text-sm no-underline",
                    !isUserAdmin && "cursor-not-allowed opacity-70 hover:text-foreground hover:no-underline",
                    "data-[state=open]:text-primary [&[data-state=open]>svg:not(.lucide-lock)]:text-primary"
                )}
                disabled={!isUserAdmin}
                onClick={(e) => { if (!isUserAdmin) e.preventDefault(); }}
                >
                <div className="flex items-center gap-3 w-full">
                    <ShieldCheck className={cn("h-5 w-5", isUserAdmin ? "text-primary" : "text-muted-foreground")} />
                    <span>Admin</span>
                    {!isUserAdmin && <Lock className="h-4 w-4 ml-auto text-muted-foreground" />}
                </div>
                </AccordionTrigger>
                {isUserAdmin && (
                <AccordionContent className="pt-1 pb-0 pl-4 space-y-1">
                    <Link href="/admin"
                    className={cn(
                        "flex items-center gap-3 text-foreground p-3 rounded-md hover:bg-muted hover:text-primary transition-colors pl-5",
                        pathname === "/admin" && "bg-muted text-primary font-semibold"
                    )}
                    >
                        <ShieldCheck className="h-5 w-5" />
                        <span className="font-medium text-sm">Aprovações</span>
                    </Link>
                </AccordionContent>
                )}
            </AccordionItem>
            
            <AccordionItem value="ecommerce-category" className="border-b-0">
                <AccordionTrigger className="p-3 rounded-md hover:bg-muted hover:text-primary transition-colors text-foreground font-medium text-sm no-underline [&[data-state=open]>svg]:text-primary">
                <div className="flex items-center gap-3">
                    <Store className="h-5 w-5" />
                    <span>E-Commerce</span>
                </div>
                </AccordionTrigger>
                <AccordionContent className="pt-1 pb-0 pl-4 space-y-1">
                <Link href="/dashboard" className={cn("flex items-center gap-3 text-foreground p-3 rounded-md hover:bg-muted hover:text-primary transition-colors pl-5", pathname === "/dashboard" && "bg-muted text-primary font-semibold")}>
                    <LayoutDashboard className="h-5 w-5" />
                    <span className="font-medium text-sm">Dashboard</span>
                </Link>
                <Link href="/restock-opportunities" className={cn("flex items-center gap-3 text-foreground p-3 rounded-md hover:bg-muted hover:text-primary transition-colors pl-5", pathname === "/restock-opportunities" && "bg-muted text-primary font-semibold")}>
                    <TrendingUp className="h-5 w-5" />
                    <span className="font-medium text-sm">Oport. Reabastec.</span>
                </Link>
                <Link href="/pillow-stock" className={cn("flex items-center gap-3 text-foreground p-3 rounded-md hover:bg-muted hover:text-primary transition-colors pl-5", pathname === "/pillow-stock" && "bg-muted text-primary font-semibold")}>
                    <BedDouble className="h-5 w-5" />
                    <span className="font-medium text-sm">Estoque Travesseiros</span>
                </Link>
                <Link href="/abc-analysis" className={cn("flex items-center gap-3 text-foreground p-3 rounded-md hover:bg-muted hover:text-primary transition-colors pl-5", pathname === "/abc-analysis" && "bg-muted text-primary font-semibold")}>
                    <BarChart className="h-5 w-5" />
                    <span className="font-medium text-sm">Análise Curva ABC</span>
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

  return (
    <div className="flex items-center justify-center min-h-screen bg-background">
      <Loader2 className="h-12 w-12 animate-spin text-primary" />
      <p className="ml-4 text-lg text-foreground">Verificando status da conta...</p>
    </div>
  );
}
