
'use client';

import { useEffect, useState, useTransition } from 'react';
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

export default function AdminPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  const [isLoadingUser, setIsLoadingUser] = useState(true);
  const [pendingUsers, setPendingUsers] = useState<UserProfile[]>([]);
  const [isLoadingPendingUsers, setIsLoadingPendingUsers] = useState(false);
  const [isApproving, startApproveTransition] = useTransition();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(clientAuth, (user) => {
      setCurrentUser(user);
      setIsLoadingUser(false);
      if (user && user.email !== process.env.NEXT_PUBLIC_ADMIN_EMAIL) {
        // Non-admin user, redirect or show access denied immediately.
        // Redirecting is cleaner than rendering a denied message here as layout also handles it.
        router.replace('/dashboard'); 
      } else if (user && user.email === process.env.NEXT_PUBLIC_ADMIN_EMAIL) {
        fetchPendingUsers();
      } else if (!user) {
        router.replace('/login');
      }
    });
    return () => unsubscribe();
  }, [router]);

  const fetchPendingUsers = async () => {
    setIsLoadingPendingUsers(true);
    try {
      if (!currentUser || currentUser.email !== process.env.NEXT_PUBLIC_ADMIN_EMAIL) {
        // This check is redundant if useEffect handles redirection, but good for direct calls
        toast({ title: "Acesso Negado", description: "Você não tem permissão para ver esta página.", variant: "destructive" });
        setPendingUsers([]);
        return;
      }
      const adminIdToken = await currentUser.getIdToken(true); // Force refresh token
      const result = await getPendingUsers(adminIdToken);
      if (result.status === 'success' && result.users) {
        setPendingUsers(result.users);
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
  };

  const handleApproveUser = async (userIdToApprove: string) => {
    startApproveTransition(async () => {
      if (!currentUser || !currentUser.email || currentUser.email !== process.env.NEXT_PUBLIC_ADMIN_EMAIL) {
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

  if (!currentUser || currentUser.email !== process.env.NEXT_PUBLIC_ADMIN_EMAIL) {
    // This might be momentarily visible if redirection in useEffect is slow,
    // or if direct navigation attempt happens. Layout should also protect.
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
