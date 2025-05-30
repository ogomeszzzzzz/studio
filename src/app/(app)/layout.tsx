
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
      // Primary check for admin status is the isAdmin flag from the user profile
      const isAdminByFlag = currentUser.isAdmin === true;
      // Fallback or secondary check via email if needed, but isAdmin flag should be source of truth
      const isAdminByEmail = currentUser.email.toLowerCase() === ADMIN_PRIMARY_EMAIL_CLIENT.toLowerCase();
      
      setIsUserAdmin(isAdminByFlag); // Use isAdmin flag from profile

      if (isAdminByFlag && !isAdminByEmail) {
        console.warn("AppLayout: User has isAdmin flag true, but email does not match ADMIN_PRIMARY_EMAIL_CLIENT. Proceeding as admin based on flag.");
      }
      if (!isAdminByFlag && isAdminByEmail) {
        console.warn("AppLayout: User email matches ADMIN_PRIMARY_EMAIL_CLIENT, but isAdmin flag is not true. User will NOT be treated as admin. This might need correction in Firestore for the admin user.");
      }

    } else if (!authContextLoading && !currentUser) {
      setIsUserAdmin(false);
      router.replace('/login');
    }
  }, [authContextLoading, currentUser, router]);


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
        const currentNotifiedIds = new Set(notifiedPendingUserIds);
        let newNotifications = false;

        querySnapshot.forEach((docSnap) => {
          const userData = docSnap.data() as DocumentData;
          const userId = docSnap.id; // email is the doc ID

          if (!currentNotifiedIds.has(userId)) {
            console.log(`AppLayout: New pending user detected - ${userId}`);
            toast({
              title: "Novo Usuário Pendente",
              description: `${userData.name || userId} aguarda sua aprovação.`,
              action: (
                <ToastAction altText="Ver Aprovações" onClick={() => router.push('/admin')}>
                  Ver Aprovações
                </ToastAction>
              ),
              duration: 15000,
            });
            currentNotifiedIds.add(userId);
            newNotifications = true;
          }
        });

        if (newNotifications) {
          setNotifiedPendingUserIds(currentNotifiedIds);
        }
      }, (error) => {
        console.error("AppLayout: Error listening to pending users:", error);
        toast({
          title: "Erro de Notificação de Admin",
          description: `Não foi possível verificar novos usuários pendentes: ${error.message}. Verifique as regras do Firestore.`,
          variant: "destructive",
        });
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
  }, [isUserAdmin, firestore, firestoreClientInitializationError, toast, router, notifiedPendingUserIds]);

  const handleSignOut = () => {
    logout(); // AuthContext handles localStorage removal
    toast({ title: 'Logout', description: 'Você foi desconectado.' });
    router.push('/login'); // Ensure redirect after logout
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
     // This case should ideally be caught by the useEffect that redirects to /login
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="ml-4 text-lg text-foreground">Redirecionando para o login...</p>
      </div>
    );
  }
  
  // Special handling for the primary admin email to always be considered approved
  // The main check is now currentUser.isApproved from AuthContext, which should come from Firestore.
  const effectivelyApproved = currentUser.email.toLowerCase() === ADMIN_PRIMARY_EMAIL_CLIENT.toLowerCase() || currentUser.isApproved;

  if (!effectivelyApproved && currentUser.pendingApproval) {
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

  if (!effectivelyApproved && !currentUser.pendingApproval) {
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

