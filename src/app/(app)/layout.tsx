
'use client';

import type { ReactNode } from 'react';
import { useEffect, useState, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, LogOut, LayoutDashboard, UserCircle, ShieldCheck, Store, Building, TrendingUp, BarChart, BedDouble, Lock, Settings, Users as UsersIcon } from 'lucide-react';
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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";


interface AppLayoutProps {
  children: ReactNode;
}

const ADMIN_PRIMARY_EMAIL_CLIENT = process.env.NEXT_PUBLIC_ADMIN_EMAIL || "gustavo.cordeiro@altenburg.com.br";

export default function AppLayout({ children }: AppLayoutProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { toast } = useToast();
  const { currentUser, logout, isLoading: authContextLoading, setCurrentUser } = useAuth();
  const [activeAccordionItem, setActiveAccordionItem] = useState<string | undefined>(undefined);
  const [isUserAdmin, setIsUserAdmin] = useState(false);
  const [isUserApproved, setIsUserApproved] = useState(false);
  const [isUserDataLoaded, setIsUserDataLoaded] = useState(false);


  useEffect(() => {
    console.log("AppLayout: AuthContext loading:", authContextLoading, "CurrentUser:", !!currentUser);
    if (!authContextLoading && currentUser) {
      const isAdminByFlag = currentUser.isAdmin === true;
      const isAdminByEmail = currentUser.email.toLowerCase() === ADMIN_PRIMARY_EMAIL_CLIENT.toLowerCase();
      
      const effectiveIsAdmin = isAdminByEmail || isAdminByFlag;
      setIsUserAdmin(effectiveIsAdmin);
      // For admin, approval is implicit. For others, check isApproved flag.
      setIsUserApproved(effectiveIsAdmin || currentUser.isApproved === true);
      setIsUserDataLoaded(true);

      console.log("AppLayout: User data processed. Email:", currentUser.email, "IsAdmin(Effective):", effectiveIsAdmin, "IsApproved(Effective):", effectiveIsAdmin || currentUser.isApproved === true);

    } else if (!authContextLoading && !currentUser) {
      console.log("AppLayout: No current user, and auth not loading. Redirecting to login.");
      setIsUserAdmin(false);
      setIsUserApproved(false);
      setIsUserDataLoaded(true); // Mark as loaded to prevent infinite loader
      if (pathname !== '/login' && pathname !== '/register') {
        router.replace('/login');
      }
    } else if (authContextLoading) {
      console.log("AppLayout: Auth context is still loading...");
      setIsUserDataLoaded(false); // Waiting for auth context
    }
  }, [authContextLoading, currentUser, router, pathname]);


  useEffect(() => {
    if (pathname?.startsWith('/admin')) {
      setActiveAccordionItem("admin-category");
    } else if (pathname?.startsWith('/dashboard') || pathname?.startsWith('/restock-opportunities') || pathname?.startsWith('/pillow-stock') || pathname?.startsWith('/abc-analysis')) {
      setActiveAccordionItem("ecommerce-category");
    } else if (pathname?.startsWith('/retail')) {
      setActiveAccordionItem("retail-category");
    } else if (pathname?.startsWith('/profile')) {
      // No accordion for profile, or handle as needed
    }
  }, [pathname]);


  const handleSignOut = () => {
    logout(); // This clears localStorage and resets AuthContext
    toast({ title: 'Logout', description: 'Você foi desconectado.' });
    // router.replace('/login'); // AuthContext or HomePage will handle redirect
  };

  // This loader shows while AuthContext is loading or initial user data processing is pending
  if (authContextLoading || !isUserDataLoaded) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="ml-4 text-lg text-foreground">Carregando sessão...</p>
      </div>
    );
  }

  // If user data is loaded, but there's no user, and we are not on public pages, redirect.
  if (isUserDataLoaded && !currentUser && (pathname !== '/login' && pathname !== '/register')) {
    console.log("AppLayout: User data loaded, no currentUser, not on public page. Redirecting to login.");
    // router.replace('/login'); // This will be handled by useEffect or page itself
     return <div className="flex items-center justify-center h-screen"><Loader2 className="h-12 w-12 animate-spin text-primary" /><p className="ml-3">Redirecionando...</p></div>;
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

  if (currentUser && !effectivelyApproved && !currentUser.pendingApproval) { // Not admin, not approved, and not pending (i.e., explicitly rejected or issue)
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

  const UserAvatar = () => {
    if (!currentUser) return null;
    const initial = currentUser.name ? currentUser.name.charAt(0).toUpperCase() : currentUser.email.charAt(0).toUpperCase();
    return (
      <Avatar className="h-8 w-8">
        <AvatarImage src={currentUser.photoURL} alt={currentUser.name || currentUser.email} />
        <AvatarFallback>{initial}</AvatarFallback>
      </Avatar>
    );
  };


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
             <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="flex items-center gap-2 text-sm text-muted-foreground hover:bg-muted px-2 py-1 h-auto">
                  <UserAvatar />
                  <span className="hidden sm:inline">{currentUser.name || currentUser.email}</span>
                  {isUserAdmin && <Badge variant="outline" className="ml-1 border-green-600 text-green-700 hidden sm:inline-flex">Admin</Badge>}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>{currentUser.name || "Usuário"}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/profile">
                    <UserCircle className="mr-2 h-4 w-4" />
                    <span>Meu Perfil</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleSignOut} className="text-destructive focus:bg-destructive/10 focus:text-destructive">
                  <LogOut className="mr-2 h-4 w-4" />
                  Sair
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>
    </header>
  );

  // If auth context is not loading, but there's no user, and current path is public - render children (login/register)
  if (!authContextLoading && !currentUser && (pathname === '/login' || pathname === '/register')) {
    console.log("AppLayout: Rendering public page (login/register).");
    return <>{children}</>;
  }
  
  // If auth context is not loading, no user, and NOT on public pages (should have been caught by useEffect, but defensive)
  if (!authContextLoading && !currentUser) {
     console.warn("AppLayout: Reached unexpected state - no user, not loading, not on public page. Forcing redirect.");
     router.replace('/login'); // Force redirect if somehow missed by useEffect
     return <div className="flex items-center justify-center h-screen"><Loader2 className="h-12 w-12 animate-spin text-primary" /><p className="ml-3">Redirecionando...</p></div>;
  }
  
  // If user is loaded and effectively approved, render the authenticated layout
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
                    <ShieldCheck className={cn("h-5 w-5", isUserAdmin ? "text-inherit" : "text-muted-foreground")} />
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
                        <UsersIcon className="h-5 w-5" />
                        <span className="font-medium text-sm">Aprovações</span>
                    </Link>
                    <Link href="/admin/users"
                    className={cn(
                        "flex items-center gap-3 text-foreground p-3 rounded-md hover:bg-muted hover:text-primary transition-colors pl-5",
                        pathname === "/admin/users" && "bg-muted text-primary font-semibold"
                    )}
                    >
                        <Settings className="h-5 w-5" />
                        <span className="font-medium text-sm">Gerenciar Usuários</span>
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

  // Fallback loader if none of the above conditions met (should be rare)
  console.log("AppLayout: Reached fallback loader. State: authLoading", authContextLoading, "isUserDataLoaded", isUserDataLoaded, "currentUser", !!currentUser, "effectivelyApproved", effectivelyApproved);
  return (
    <div className="flex items-center justify-center min-h-screen bg-background">
      <Loader2 className="h-12 w-12 animate-spin text-primary" />
      <p className="ml-4 text-lg text-foreground">Verificando status da conta...</p>
    </div>
  );
}
