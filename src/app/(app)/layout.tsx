
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
import { firestore, firestoreClientInitializationError } from '@/lib/firebase/config';
import { collection, query, where, onSnapshot, type Unsubscribe, type DocumentData } from 'firebase/firestore';
import { ToastAction } from "@/components/ui/toast";
import { Badge } from '@/components/ui/badge'; // Added import for Badge

interface AppLayoutProps {
  children: ReactNode;
}

// Fallback admin email if NEXT_PUBLIC_ADMIN_EMAIL is not set
const ADMIN_PRIMARY_EMAIL_CLIENT = process.env.NEXT_PUBLIC_ADMIN_EMAIL || "gustavo.cordeiro@altenburg.com.br";

export default function AppLayout({ children }: AppLayoutProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { toast } = useToast();
  const { currentUser, logout, isLoading: authContextLoading, setCurrentUser: setAuthContextUser } = useAuth();
  const [activeAccordionItem, setActiveAccordionItem] = useState<string | undefined>(undefined);
  const [notifiedPendingUserIds, setNotifiedPendingUserIds] = useState<Set<string>>(new Set());
  const [isUserAdmin, setIsUserAdmin] = useState(false);

  useEffect(() => {
    if (!authContextLoading && currentUser) {
      const isAdminByFlag = currentUser.isAdmin === true;
      const isAdminByEmail = currentUser.email.toLowerCase() === ADMIN_PRIMARY_EMAIL_CLIENT.toLowerCase();
      
      // For this application, being the specific admin email OR having the isAdmin flag is enough.
      // The isAdmin flag is set during registration for the primary admin.
      setIsUserAdmin(isAdminByEmail || isAdminByFlag);

      if (isAdminByFlag && !isAdminByEmail) {
        console.warn("AppLayout: User has isAdmin flag true, but email does not match ADMIN_PRIMARY_EMAIL_CLIENT. Proceeding as admin based on flag.");
      }
       if (!isAdminByFlag && isAdminByEmail && currentUser.email === ADMIN_PRIMARY_EMAIL_CLIENT) {
        // This specific case is important for the primary admin who might not have the flag set yet if created manually
        // or if the flag logic in registration wasn't perfect initially.
        console.log(`AppLayout: User ${currentUser.email} matches ADMIN_PRIMARY_EMAIL_CLIENT, ensuring admin status.`);
        setIsUserAdmin(true);
      }


    } else if (!authContextLoading && !currentUser) {
      setIsUserAdmin(false);
      if (pathname !== '/login' && pathname !== '/register') { // Avoid redirect loop if already on public pages
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

  // Firestore listener for new pending users (admin only)
  useEffect(() => {
    let unsubscribe: Unsubscribe | undefined;
    console.log("AppLayout: Admin listener check. isUserAdmin:", isUserAdmin, "firestore available:", !!firestore, "init error:", firestoreClientInitializationError);

    if (isUserAdmin && firestore && !firestoreClientInitializationError) {
      console.log("AppLayout: Admin detected, setting up pending users listener.");
      const q = query(
        collection(firestore, "auth_users"),
        where("pendingApproval", "==", true),
        where("isApproved", "==", false)
      );

      unsubscribe = onSnapshot(q, (querySnapshot) => {
        const currentNotifiedIds = new Set(notifiedPendingUserIds); // Work with a copy
        let newNotificationsMade = false;

        querySnapshot.forEach((docSnap) => {
          const userData = docSnap.data() as DocumentData;
          const userId = docSnap.id; // email is the doc ID

          if (!notifiedPendingUserIds.has(userId)) { // Check against original set
            console.log(`AppLayout: New pending user detected - ${userId}`);
            toast({
              title: "Novo Usuário Pendente",
              description: `${userData.name || userId} aguarda sua aprovação.`,
              action: (
                <ToastAction altText="Ver Aprovações" onClick={() => router.push('/admin')}>
                  Ver Aprovações
                </ToastAction>
              ),
              duration: 15000, // Increased duration
            });
            currentNotifiedIds.add(userId); // Add to the copy
            newNotificationsMade = true;
          }
        });

        if (newNotificationsMade) {
          setNotifiedPendingUserIds(currentNotifiedIds); // Update state with the new set
        }
      }, (error) => {
        console.error("AppLayout: Error listening to pending users:", error);
        // Avoid overly aggressive toasting for listener errors if they are frequent.
        // Consider logging to a more persistent system in production.
        if (error.message.includes("Missing or insufficient permissions")) {
            console.warn("AppLayout: Firestore permission error for pending users listener. Check Firestore rules for `auth_users` list access.");
            // Optionally, toast only once or less frequently for permission issues.
            toast({
              title: "Erro de Permissão (Admin)",
              description: `Não foi possível verificar novos usuários pendentes devido a permissões. Verifique as regras do Firestore.`,
              variant: "destructive",
              duration: 20000
            });
        } else {
            toast({
            title: "Erro de Notificação de Admin",
            description: `Não foi possível verificar novos usuários pendentes: ${error.message}.`,
            variant: "destructive",
            });
        }
      });
    } else {
      if (isUserAdmin && (firestoreClientInitializationError || !firestore)) {
        console.warn("AppLayout: Firestore not available for admin listener. Error:", firestoreClientInitializationError);
      }
    }

    return () => {
      if (unsubscribe) {
        console.log("AppLayout: Cleaning up pending users listener.");
        unsubscribe();
      }
    };
  // notifiedPendingUserIds is included because we read it to check if a user was already notified
  // router and toast are stable, firestoreClientInitializationError is a static error string
  // isUserAdmin and firestore instance are the main drivers for setting up/tearing down.
  }, [isUserAdmin, firestore, firestoreClientInitializationError, toast, router, notifiedPendingUserIds]);


  const handleSignOut = () => {
    logout(); // AuthContext handles localStorage removal and currentUser state
    toast({ title: 'Logout', description: 'Você foi desconectado.' });
    // router.push('/login'); // AuthContext or HomePage will handle redirect
  };

  if (authContextLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="ml-4 text-lg text-foreground">Carregando sessão...</p>
      </div>
    );
  }

  if (!currentUser) {
     // This case should ideally be caught by the useEffect that redirects to /login if not on login/register page
    if (pathname !== '/login' && pathname !== '/register') {
        // To prevent infinite loops if already on login page and no user
        return (
            <div className="flex items-center justify-center min-h-screen bg-background">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
                <p className="ml-4 text-lg text-foreground">Redirecionando para o login...</p>
            </div>
        );
    }
    // If on login/register page and no currentUser, allow children (the login/register page) to render
  }
  
  // Special handling for the primary admin email to always be considered approved
  const isPrimaryAdmin = currentUser?.email.toLowerCase() === ADMIN_PRIMARY_EMAIL_CLIENT.toLowerCase();
  const effectivelyApproved = isPrimaryAdmin || currentUser?.isApproved;

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

  // If not loading, and no current user, but on login/register page, render children
  if (!authContextLoading && !currentUser && (pathname === '/login' || pathname === '/register')) {
    return <>{children}</>;
  }
  
  // If not loading, and no current user, and NOT on login/register (should have been redirected, but as a safeguard)
  if (!authContextLoading && !currentUser) {
     // This should ideally not be reached if redirection logic is perfect
     return <div className="flex items-center justify-center h-screen"><Loader2 className="h-12 w-12 animate-spin text-primary" /><p className="ml-3">Redirecionando...</p></div>;
  }
  
  // If effectively approved or the children are public pages not needing approval check (which isn't the case for (app) layout)
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
  // If none of the above, it means currentUser exists but is not approved, or auth is still loading
  // The specific messages for "Pending Approval" or "Access Denied" are handled above.
  // If it's still authContextLoading, the top-level loader handles it.
  // This return is a fallback for completeness, though other conditions should catch specific states.
  return (
    <div className="flex items-center justify-center min-h-screen bg-background">
      <Loader2 className="h-12 w-12 animate-spin text-primary" />
      <p className="ml-4 text-lg text-foreground">Verificando status da conta...</p>
    </div>
  );
}
