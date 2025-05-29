
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
    if (!currentUser || !isDefinitelyAdmin) { // Verificação reforçada
      console.warn("fetchPendingUsers chamado sem usuário admin ou currentUser/isDefinitelyAdmin não definidos.");
      setIsLoadingPendingUsers(false); // Garante que o loading pare
      return;
    }
    setIsLoadingPendingUsers(true);
    try {
      const adminIdToken = await currentUser.getIdToken(true);
      const result = await getPendingUsers(adminIdToken);
      if (result.status === 'success' && result.users) {
        setPendingUsers(result.users);
        if (result.users.length === 0 && isDefinitelyAdmin) {
          toast({ title: "Nenhum Usuário Pendente", description: "Não há novos usuários aguardando aprovação.", variant: "default" });
        }
      } else {
        toast({ title: "Erro ao Buscar Usuários", description: result.message, variant: "destructive" });
        setPendingUsers([]);
      }
    } catch (error) {
      console.error("Error fetching pending users:", error);
      toast({ title: "Erro Crítico", description: "Não foi possível buscar usuários pendentes.", variant: "destructive" });
      setPendingUsers([]);
    } finally {
      setIsLoadingPendingUsers(false);
    }
  }, [currentUser, toast, isDefinitelyAdmin]); // Adicionado isDefinitelyAdmin

  useEffect(() => {
    setIsLoadingUser(true); // Inicia o carregamento
    const unsubscribe = onAuthStateChanged(clientAuth, (user) => {
      setCurrentUser(user);
      if (user) {
        if (user.email === ADMIN_EMAIL_CLIENT_SIDE) {
          setIsDefinitelyAdmin(true);
        } else {
          setIsDefinitelyAdmin(false);
          // Não redireciona daqui, deixa o render condicional mostrar "Acesso Negado"
        }
      } else {
        setIsDefinitelyAdmin(false);
        // O layout principal (app)/layout.tsx deve lidar com o redirecionamento para /login
        // se não houver usuário. Se o usuário chegar aqui sem estar logado,
        // é provável que o layout falhou ou esta página foi acessada de forma inesperada.
      }
      setIsLoadingUser(false); // Termina o carregamento APÓS definir o status do admin
    });
    return () => unsubscribe();
  }, []); // Removido router da dependência, pois o redirecionamento foi removido daqui

  useEffect(() => {
    if (isDefinitelyAdmin && currentUser) { // Apenas busca se for admin e tiver usuário
      fetchPendingUsers();
    } else if (!isLoadingUser && !isDefinitelyAdmin && currentUser) {
      // Se carregou, tem usuário, mas não é admin, não faz nada aqui (render vai mostrar Acesso Negado)
      setPendingUsers([]); // Limpa usuários pendentes se não for admin
    }
  }, [isDefinitelyAdmin, currentUser, fetchPendingUsers, isLoadingUser]);


  const handleApproveUser = async (userIdToApprove: string) => {
    startApproveTransition(async () => {
      if (!currentUser || !isDefinitelyAdmin) {
         toast({ title: "Ação não permitida", description: "Apenas administradores podem aprovar usuários.", variant: "destructive" });
         return;
      }
      try {
        const adminIdToken = await currentUser.getIdToken(true);
        const result = await approveUser(adminIdToken, userIdToApprove);
        if (result.status === 'success') {
          toast({ title: "Usuário Aprovado!", description: result.message });
          fetchPendingUsers(); // Refresh the list
        } else {
          toast({ title: "Erro ao Aprovar", description: result.message, variant: "destructive" });
        }
      } catch (error) {
        console.error("Error approving user:", error);
        toast({ title: "Erro Crítico na Aprovação", description: "Não foi possível aprovar o usuário.", variant: "destructive" });
      }
    });
  };

  if (isLoadingUser) {
    return <div className="flex items-center justify-center h-screen"><Loader2 className="h-12 w-12 animate-spin text-primary" /><p className="ml-3">Verificando permissões...</p></div>;
  }

  // Se não está carregando e não é admin (e há um usuário, caso contrário o layout deveria ter redirecionado)
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
  
  // Se chegou aqui, é admin e não está carregando.
  // No entanto, se currentUser for null (usuário deslogou enquanto estava na página),
  // o layout deve ter lidado com isso, mas adicionamos uma verificação para segurança.
  if (!currentUser && !isLoadingUser) {
     router.replace('/login'); // Segurança extra
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
                          : user.createdAt ? new Date((user.createdAt as any).seconds * 1000).toLocaleDateString('pt-BR') : 'N/A'}
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
