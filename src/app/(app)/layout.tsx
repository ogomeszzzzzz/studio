
'use client';

import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { onAuthStateChanged, signOut, type User as FirebaseUser } from 'firebase/auth';
import { clientAuth, firestore } from '@/lib/firebase/config';
import { doc, getDoc } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Loader2, LogOut, LayoutDashboard, UserCircle, PackageSearch, BedDouble, Store, Building, TrendingUp, BarChart, ShieldCheck, Settings } from 'lucide-react';
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
  const pathname = usePathname();
  const { toast } = useToast();
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [approvalStatusLoading, setApprovalStatusLoading] = useState(false);
  const [isApproved, setIsApproved] = useState(false);
  const [activeAccordionItem, setActiveAccordionItem] = useState<string | undefined>(undefined);

  const isAdmin = userProfile?.email === process.env.NEXT_PUBLIC_ADMIN_EMAIL;

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(clientAuth, async (fbUser) => {
      setFirebaseUser(fbUser);
      if (fbUser) {
        setApprovalStatusLoading(true);
        try {
          const userDocRef = doc(firestore, 'users', fbUser.uid);
          const userDocSnap = await getDoc(userDocRef);
          if (userDocSnap.exists()) {
            const profileData = userDocSnap.data() as UserProfile;
            setUserProfile(profileData);
            if (profileData.isApproved) {
              setIsApproved(true);
            } else {
              setIsApproved(false);
              // User exists but is not approved
              // No redirect here, let content rendering handle "Pending Approval"
            }
          } else {
            // User exists in Auth but not in Firestore (should not happen with new registration flow)
            // Or new user who hasn't had their Firestore doc created by admin action yet (old system)
            // For new system, this means an issue or they need to complete registration/wait for approval.
            setUserProfile({ uid: fbUser.uid, email: fbUser.email, isApproved: false, pendingApproval: true });
            setIsApproved(false);
            toast({ title: "Conta Pendente", description: "Seu perfil não foi encontrado ou ainda não foi aprovado.", variant: "default" });
          }
        } catch (error) {
          console.error("Error fetching user profile:", error);
          toast({ title: "Erro de Perfil", description: "Não foi possível carregar seu perfil.", variant: "destructive" });
          setIsApproved(false); // Default to not approved on error
          setUserProfile({ uid: fbUser.uid, email: fbUser.email }); // Basic profile
        } finally {
          setApprovalStatusLoading(false);
        }
      } else {
        setUserProfile(null);
        setIsApproved(false);
        router.replace('/login');
      }
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, [router, toast]);

  useEffect(() => {
    if (pathname?.startsWith('/dashboard') || pathname?.startsWith('/restock-opportunities') || pathname?.startsWith('/pillow-stock') || pathname?.startsWith('/abc-analysis')) {
      setActiveAccordionItem("ecommerce-category");
    } else if (pathname?.startsWith('/admin')) {
      setActiveAccordionItem("admin-category");
    }
  }, [pathname]);

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

  if (authLoading || (firebaseUser && approvalStatusLoading)) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="ml-4 text-lg text-foreground">
          {authLoading ? "Verificando autenticação..." : "Verificando status da conta..."}
        </p>
      </div>
    );
  }

  if (!firebaseUser) { // Should be caught by onAuthStateChanged, but as a fallback
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

  if (!isApproved && userProfile?.pendingApproval) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-background p-6">
        <Card className="w-full max-w-md text-center shadow-lg">
          <CardHeader>
            <CardTitle className="text-2xl font-semibold text-primary">Conta Pendente de Aprovação</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-4">
              Obrigado por se registrar, {userProfile.name || userProfile.email}! Sua conta está aguardando aprovação do administrador.
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
  
  if (!isApproved && userProfile && !userProfile.pendingApproval) {
     // This case might happen if isApproved is explicitly false but pendingApproval is also false/undefined.
     // Or if user document exists but doesn't have approval fields (older users before this system)
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


  return (
    <div className="flex min-h-screen">
      <nav className="w-64 bg-card border-r border-border p-4 space-y-1 hidden md:flex flex-col shadow-md">
        <Accordion type="single" collapsible className="w-full" value={activeAccordionItem} onValueChange={setActiveAccordionItem}>
          {isAdmin && (
            <AccordionItem value="admin-category" className="border-b-0">
              <AccordionTrigger className="p-3 rounded-md hover:bg-muted hover:text-primary transition-colors text-foreground font-medium text-sm no-underline [&[data-state=open]>svg]:text-primary">
                <div className="flex items-center gap-3">
                  <Settings className="h-5 w-5" />
                  <span>Admin</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="pt-1 pb-0 pl-4 space-y-1">
                <Link href="/admin" className={cn("flex items-center gap-3 text-foreground p-3 rounded-md hover:bg-muted hover:text-primary transition-colors pl-5", pathname === "/admin" && "bg-muted text-primary font-semibold")}>
                    <ShieldCheck className="h-5 w-5" />
                    <span className="font-medium text-sm">Aprovações</span>
                </Link>
              </AccordionContent>
            </AccordionItem>
          )}
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
          {isApproved ? children : null /* Render children only if approved */}
        </main>
      </div>
    </div>
  );
}
