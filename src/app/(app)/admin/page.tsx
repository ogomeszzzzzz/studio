
'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, ShieldAlert, ShieldCheck, UserCheck, Users } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import type { UserProfile } from '@/types';
import { getPendingUsers, approveUserInFirestore } from '@/app/actions/admin';
import { Badge } from '@/components/ui/badge';

const ADMIN_PRIMARY_EMAIL_CLIENT = process.env.NEXT_PUBLIC_ADMIN_EMAIL || "gustavo.cordeiro@altenburg.com.br";

export default function AdminPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { currentUser, isLoading: authLoading } = useAuth();

  const [isDefinitelyAdmin, setIsDefinitelyAdmin] = useState(false);
  const [pendingUsers, setPendingUsers] = useState<UserProfile[]>([]);
  const [isLoadingPage, setIsLoadingPage] = useState(true);
  const [isApprovingId, setIsApprovingId] = useState<string | null>(null);
  const [initialFetchAttempted, setInitialFetchAttempted] = useState(false);

  useEffect(() => {
    console.log("AdminPage: Auth check effect. authLoading:", authLoading, "currentUser:", !!currentUser);
    if (!authLoading) {
      const isAdminCheck = currentUser?.email?.toLowerCase() === ADMIN_PRIMARY_EMAIL_CLIENT.toLowerCase() && currentUser?.isAdmin === true;
      console.log("AdminPage: isAdminCheck result:", isAdminCheck);
      setIsDefinitelyAdmin(isAdminCheck);
      // If not admin, page is considered "loaded" as it will show access denied.
      // If admin, isLoadingPage will be set to false after fetchPendingUsers completes.
      if (!isAdminCheck) {
        setIsLoadingPage(false);
        setPendingUsers([]);
      }
    } else {
      setIsLoadingPage(true); // Still waiting for auth
    }
  }, [authLoading, currentUser]);

  const fetchPendingUsers = useCallback(async () => {
    if (!currentUser?.email) {
      console.warn("AdminPage: fetchPendingUsers called without currentUser email.");
      setIsLoadingPage(false); // Ensure loading stops if this somehow happens
      return;
    }
    console.log("AdminPage: Fetching pending users by admin:", currentUser.email);
    // No need to set isLoadingPage to true here, as it's handled by the initial state or the calling useEffect.

    try {
      const result = await getPendingUsers(currentUser.email);
      console.log("AdminPage: getPendingUsers server action result:", result);
      if (result.status === 'success' && result.users) {
        setPendingUsers(result.users);
        if (result.users.length === 0 && initialFetchAttempted) { // Only show if first fetch returned none or list became empty
          toast({ title: "Nenhum Usuário Pendente", description: "Não há novos usuários aguardando aprovação.", variant: "default" });
        }
      } else {
        toast({ title: "Erro ao Buscar Usuários", description: result.message || "Falha ao buscar usuários pendentes.", variant: "destructive" });
        setPendingUsers([]);
      }
    } catch (error) {
      console.error("AdminPage: Critical error in fetchPendingUsers:", error);
      toast({ title: "Erro Crítico ao Buscar Usuários", description: (error as Error).message, variant: "destructive" });
      setPendingUsers([]);
    } finally {
      setInitialFetchAttempted(true);
      setIsLoadingPage(false); // Fetch attempt is complete, page is now fully loaded
    }
  }, [currentUser, toast, initialFetchAttempted]); // Added initialFetchAttempted to dependencies

  // Effect to fetch users once admin status is confirmed and auth is done
  useEffect(() => {
    console.log("AdminPage: Pending users fetch trigger effect. isDefinitelyAdmin:", isDefinitelyAdmin, "authLoading:", authLoading);
    if (!authLoading && isDefinitelyAdmin) {
      // Only set loading to true here if it's the first time we're fetching for an admin
      // isLoadingPage is already true initially if user could be admin.
      fetchPendingUsers();
    }
    // If auth is done and not admin, isLoadingPage is already false from the first effect.
  }, [isDefinitelyAdmin, authLoading, fetchPendingUsers]);


  const handleApproveUser = async (userEmailToApprove: string) => {
    if (!currentUser || !currentUser.isAdmin || !currentUser.email) {
       toast({ title: "Ação não permitida", description: "Apenas administradores podem aprovar usuários.", variant: "destructive" });
       return;
    }
    setIsApprovingId(userEmailToApprove);
    console.log(`AdminPage: Attempting to approve user: ${userEmailToApprove} by admin: ${currentUser.email}`);
    try {
      const result = await approveUserInFirestore(currentUser.email, userEmailToApprove);
      console.log("AdminPage: approveUserInFirestore server action result:", result);
      if (result.status === 'success') {
        toast({ title: "Usuário Aprovado!", description: result.message });
        setInitialFetchAttempted(false); // Allow "no users" toast if list becomes empty
        await fetchPendingUsers(); // Refresh list
      } else {
        toast({ title: "Erro ao Aprovar", description: result.message, variant: "destructive" });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Erro desconhecido ao aprovar usuário.";
      console.error("AdminPage: Critical error in handleApproveUser:", error);
      toast({ title: "Erro Crítico na Aprovação", description: errorMessage, variant: "destructive" });
    } finally {
      setIsApprovingId(null);
    }
  };

  if (isLoadingPage) {
    return <div className="flex items-center justify-center h-screen"><Loader2 className="h-12 w-12 animate-spin text-primary" /><p className="ml-3">Carregando...</p></div>;
  }

  if (!isDefinitelyAdmin) {
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
  
  if (!currentUser) { // Should be caught by AppLayout, but defensive
     console.error("AdminPage: currentUser is null after loading. Redirecting.");
     router.replace('/login');
     return <div className="flex items-center justify-center h-screen"><Loader2 className="h-12 w-12 animate-spin text-primary" /><p className="ml-3">Sessão inválida. Redirecionando...</p></div>;
  }

  return (
    <div className="space-y-6">
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center text-2xl">
            <ShieldCheck className="mr-3 h-7 w-7 text-primary" />
            Administração de Usuários - Aprovações Pendentes
             {currentUser.isAdmin && <Badge variant="outline" className="ml-3 border-green-600 text-green-700">Admin Autenticado</Badge>}
          </CardTitle>
          <CardDescription>
            Aprove ou gerencie usuários que se registraram e estão aguardando aprovação para acessar o sistema.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {pendingUsers.length === 0 && initialFetchAttempted ? (
            <div className="text-center py-10">
              <Users className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">Nenhum usuário aguardando aprovação no momento.</p>
            </div>
          ) : pendingUsers.length === 0 && !initialFetchAttempted && !isLoadingPage ? (
             <div className="flex items-center justify-center py-10"><Loader2 className="h-8 w-8 animate-spin text-primary" /><p className="ml-3">Buscando usuários pendentes...</p></div>
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
                        {user.createdAt
                          ? new Date(user.createdAt instanceof Date ? user.createdAt.getTime() : user.createdAt.seconds * 1000).toLocaleDateString('pt-BR')
                          : 'N/A'}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          onClick={() => handleApproveUser(user.email)}
                          disabled={isApprovingId === user.email}
                          variant="default"
                          className="bg-green-600 hover:bg-green-700 text-white"
                        >
                          {isApprovingId === user.email ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UserCheck className="mr-2 h-4 w-4" />}
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
