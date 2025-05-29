
'use client';

import { useEffect, useState, useTransition, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { clientAuth } from '@/lib/firebase/config';
import type { UserProfile } from '@/types';
import { getPendingUsers, approveUser } from '@/app/actions/admin';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, ShieldAlert, ShieldCheck, UserCheck, Users } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { onAuthStateChanged, type User as FirebaseUser } from 'firebase/auth';

// Define o email do admin com fallback, caso a variável de ambiente não esteja disponível no cliente.
const ADMIN_EMAIL_CLIENT_SIDE = process.env.NEXT_PUBLIC_ADMIN_EMAIL || "gustavo.cordeiro@altenburg.com.br";

export default function AdminPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  const [isLoadingUser, setIsLoadingUser] = useState(true);
  const [isDefinitelyAdmin, setIsDefinitelyAdmin] = useState(false);
  const [pendingUsers, setPendingUsers] = useState<UserProfile[]>([]);
  const [isLoadingPendingUsers, setIsLoadingPendingUsers] = useState(false);
  const [isApproving, startApproveTransition] = useTransition();

  const fetchPendingUsers = useCallback(async () => {
    if (!currentUser || !isDefinitelyAdmin) { 
      console.warn("AdminPage: fetchPendingUsers called without admin user or isDefinitelyAdmin is false.");
      setIsLoadingPendingUsers(false); 
      return;
    }
    console.log("AdminPage: Fetching pending users as admin:", currentUser.email);
    setIsLoadingPendingUsers(true);
    try {
      const adminIdToken = await currentUser.getIdToken(true); // Force refresh token
      console.log("AdminPage: Fetched adminIdToken (first few chars):", adminIdToken.substring(0, 20) + "..."); // For debugging
      const result = await getPendingUsers(adminIdToken);
      if (result.status === 'success' && result.users) {
        setPendingUsers(result.users);
        if (result.users.length === 0) {
          toast({ title: "Nenhum Usuário Pendente", description: "Não há novos usuários aguardando aprovação.", variant: "default" });
        }
      } else {
        toast({ title: "Erro ao Buscar Usuários", description: result.message || "Falha ao buscar usuários pendentes.", variant: "destructive" });
        setPendingUsers([]);
      }
    } catch (error) {
      console.error("AdminPage: Error fetching pending users:", error);
      const errorMessage = error instanceof Error ? error.message : "Erro desconhecido ao buscar usuários pendentes.";
      toast({ title: "Erro Crítico ao Buscar Usuários", description: errorMessage, variant: "destructive" });
      setPendingUsers([]);
    } finally {
      setIsLoadingPendingUsers(false);
    }
  }, [currentUser, toast, isDefinitelyAdmin]); // isDefinitelyAdmin is a dependency

  useEffect(() => {
    setIsLoadingUser(true); 
    console.log("AdminPage: Setting up onAuthStateChanged listener.");
    const unsubscribe = onAuthStateChanged(clientAuth, (user) => {
      setCurrentUser(user);
      if (user) {
        console.log("AdminPage: Auth state changed, user detected:", user.email);
        if (user.email?.toLowerCase() === ADMIN_EMAIL_CLIENT_SIDE.toLowerCase()) {
          console.log("AdminPage: User IS admin based on client-side email check.");
          setIsDefinitelyAdmin(true);
        } else {
          console.log("AdminPage: User is NOT admin based on client-side email check.");
          setIsDefinitelyAdmin(false);
        }
      } else {
        console.log("AdminPage: No user logged in from onAuthStateChanged.");
        setIsDefinitelyAdmin(false);
        // O layout principal (app)/layout.tsx deve lidar com o redirecionamento para /login
      }
      setIsLoadingUser(false); 
    });
    return () => {
      console.log("AdminPage: Cleaning up onAuthStateChanged listener.");
      unsubscribe();
    }
  }, []); 

  useEffect(() => {
    // Fetch pending users only if loading is complete, user exists, and is definitely admin
    if (!isLoadingUser && currentUser && isDefinitelyAdmin) {
      console.log("AdminPage: Conditions met to fetch pending users. Calling fetchPendingUsers...");
      fetchPendingUsers();
    } else if (!isLoadingUser && currentUser && !isDefinitelyAdmin) {
      console.log("AdminPage: User loaded but is not admin. Clearing pending users list.");
      setPendingUsers([]); 
    } else if (!isLoadingUser && !currentUser) {
      console.log("AdminPage: No user, not fetching pending users.");
      setPendingUsers([]);
    } else if (isLoadingUser) {
      console.log("AdminPage: Still loading user, not fetching pending users yet.");
    }
  }, [isLoadingUser, currentUser, isDefinitelyAdmin, fetchPendingUsers]);


  const handleApproveUser = async (userIdToApprove: string) => {
    startApproveTransition(async () => {
      if (!currentUser || !isDefinitelyAdmin) { 
         toast({ title: "Ação não permitida", description: "Apenas administradores podem aprovar usuários.", variant: "destructive" });
         return;
      }
      console.log(`AdminPage: Attempting to approve user ${userIdToApprove} by admin ${currentUser.email}`);
      try {
        const adminIdToken = await currentUser.getIdToken(true); 
        const result = await approveUser(adminIdToken, userIdToApprove);
        if (result.status === 'success') {
          toast({ title: "Usuário Aprovado!", description: result.message });
          await fetchPendingUsers(); 
        } else {
          toast({ title: "Erro ao Aprovar", description: result.message, variant: "destructive" });
        }
      } catch (error) {
        console.error("AdminPage: Error approving user:", error);
        const errorMessage = error instanceof Error ? error.message : "Erro desconhecido ao aprovar usuário.";
        toast({ title: "Erro Crítico na Aprovação", description: errorMessage, variant: "destructive" });
      }
    });
  };

  if (isLoadingUser) {
    return <div className="flex items-center justify-center h-screen"><Loader2 className="h-12 w-12 animate-spin text-primary" /><p className="ml-3">Verificando permissões...</p></div>;
  }

  if (!isDefinitelyAdmin && !isLoadingUser) { 
    return (
      <Card className="m-auto mt-10 max-w-lg text-center shadow-xl">
        <CardHeader>
          <ShieldAlert className="mx-auto h-16 w-16 text-destructive mb-4" />
          <CardTitle className="text-2xl">Acesso Negado</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Você não tem permissão para acessar esta página.</p>
          <Button onClick={() => router.push('/dashboard')} className="mt-6">Voltar ao Dashboard</Button>
        </CardContent>
      </Card>
    );
  }
  
  if (!currentUser && !isLoadingUser) {
     router.replace('/login'); 
     return <div className="flex items-center justify-center h-screen"><Loader2 className="h-12 w-12 animate-spin text-primary" /><p className="ml-3">Sessão expirada. Redirecionando...</p></div>;
  }


  return (
    <div className="space-y-6">
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center text-2xl">
            <ShieldCheck className="mr-3 h-7 w-7 text-primary" />
            Administração de Usuários - Aprovações Pendentes
          </CardTitle>
          <CardDescription>
            Aprove ou gerencie usuários que se registraram e estão aguardando aprovação para acessar o sistema.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoadingPendingUsers ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="ml-3 text-muted-foreground">Buscando usuários pendentes...</p>
            </div>
          ) : pendingUsers.length === 0 ? (
            <div className="text-center py-10">
              <Users className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">Nenhum usuário aguardando aprovação no momento.</p>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Data de Registro</TableHead>
                    <TableHead className="text-right">Ação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pendingUsers.map((user) => (
                    <TableRow key={user.uid}>
                      <TableCell className="font-medium">{user.name || 'N/A'}</TableCell>
                      <TableCell>{user.email}</TableCell>
                      <TableCell>
                        {user.createdAt instanceof Date 
                          ? user.createdAt.toLocaleDateString('pt-BR') 
                          : user.createdAt && typeof user.createdAt === 'object' && 'seconds' in user.createdAt && typeof (user.createdAt as any).seconds === 'number'
                            ? new Date((user.createdAt as any).seconds * 1000).toLocaleDateString('pt-BR')
                            : typeof user.createdAt === 'string' ? new Date(user.createdAt).toLocaleDateString('pt-BR') : 'N/A'}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button 
                          size="sm" 
                          onClick={() => handleApproveUser(user.uid)}
                          disabled={isApproving}
                          variant="default"
                          className="bg-green-600 hover:bg-green-700 text-white"
                        >
                          {isApproving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UserCheck className="mr-2 h-4 w-4" />}
                          Aprovar
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
