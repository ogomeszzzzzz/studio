
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, ShieldAlert, Users, Edit3, Trash2, CheckCircle, XCircle, KeyRound, UserPlus } from 'lucide-react';
import type { UserProfile } from '@/types';
import { getAllUsers, updateUserByAdmin, deleteUserByAdmin } from '@/app/actions/admin';
import { Badge } from '@/components/ui/badge';
import { format, isValid } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const ADMIN_PRIMARY_EMAIL_CLIENT = process.env.NEXT_PUBLIC_ADMIN_EMAIL || "gustavo.cordeiro@altenburg.com.br";

type EditableUserFields = Pick<UserProfile, 'name'> & { password?: string };

export default function AdminManageUsersPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { currentUser, isLoading: authLoading } = useAuth();

  const [isDefinitelyAdmin, setIsDefinitelyAdmin] = useState(false);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [isLoadingPage, setIsLoadingPage] = useState(true);
  const [isProcessingAction, setIsProcessingAction] = useState<string | null>(null); // Stores email of user being processed

  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [editFormData, setEditFormData] = useState<EditableUserFields>({ name: '', password: '' });
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);

  useEffect(() => {
    if (!authLoading) {
      const isAdminCheck = currentUser?.email?.toLowerCase() === ADMIN_PRIMARY_EMAIL_CLIENT.toLowerCase() && currentUser?.isAdmin === true;
      setIsDefinitelyAdmin(isAdminCheck);
      if (!isAdminCheck) {
        setIsLoadingPage(false);
      }
    } else {
      setIsLoadingPage(true);
    }
  }, [authLoading, currentUser]);

  const fetchAllUsers = useCallback(async () => {
    if (!currentUser?.email || !isDefinitelyAdmin) {
      setIsLoadingPage(false);
      return;
    }
    setIsLoadingPage(true);
    try {
      const result = await getAllUsers(currentUser.email);
      if (result.status === 'success' && result.users) {
        setUsers(result.users);
      } else {
        toast({ title: "Erro ao Buscar Usuários", description: result.message || "Falha ao buscar todos os usuários.", variant: "destructive" });
        setUsers([]);
      }
    } catch (error) {
      toast({ title: "Erro Crítico ao Buscar Usuários", description: (error as Error).message, variant: "destructive" });
      setUsers([]);
    } finally {
      setIsLoadingPage(false);
    }
  }, [currentUser, toast, isDefinitelyAdmin]);

  useEffect(() => {
    if (!authLoading && isDefinitelyAdmin) {
      fetchAllUsers();
    }
  }, [isDefinitelyAdmin, authLoading, fetchAllUsers]);

  const handleToggleApproval = async (userToToggle: UserProfile) => {
    if (!currentUser?.email) return;
    setIsProcessingAction(userToToggle.email);
    try {
      const result = await updateUserByAdmin(currentUser.email, userToToggle.email, { isApproved: !userToToggle.isApproved, pendingApproval: false });
      if (result.status === 'success') {
        toast({ title: "Status de Aprovação Alterado", description: `Usuário ${userToToggle.email} foi ${!userToToggle.isApproved ? 'aprovado' : 'desaprovado'}.` });
        fetchAllUsers(); // Refresh list
      } else {
        toast({ title: "Erro ao Alterar Status", description: result.message, variant: "destructive" });
      }
    } catch (error) {
      toast({ title: "Erro Crítico", description: (error as Error).message, variant: "destructive" });
    } finally {
      setIsProcessingAction(null);
    }
  };

  const handleDeleteUser = async (userEmailToDelete: string) => {
    if (!currentUser?.email) return;
    setIsProcessingAction(userEmailToDelete);
    try {
      const result = await deleteUserByAdmin(currentUser.email, userEmailToDelete);
      if (result.status === 'success') {
        toast({ title: "Usuário Excluído", description: `Usuário ${userEmailToDelete} foi excluído.` });
        fetchAllUsers(); // Refresh list
      } else {
        toast({ title: "Erro ao Excluir", description: result.message, variant: "destructive" });
      }
    } catch (error) {
      toast({ title: "Erro Crítico", description: (error as Error).message, variant: "destructive" });
    } finally {
      setIsProcessingAction(null);
    }
  };

  const openEditDialog = (user: UserProfile) => {
    setEditingUser(user);
    setEditFormData({ name: user.name, password: '' });
    setIsEditDialogOpen(true);
  };

  const handleEditUserSubmit = async () => {
    if (!currentUser?.email || !editingUser) return;
    setIsProcessingAction(editingUser.email);
    
    const updates: { name?: string; password?: string } = {};
    if (editFormData.name && editFormData.name !== editingUser.name) {
      updates.name = editFormData.name;
    }
    if (editFormData.password && editFormData.password.length >= 6) {
      updates.password = editFormData.password;
    } else if (editFormData.password && editFormData.password.length > 0 && editFormData.password.length < 6) {
       toast({ title: "Senha Curta", description: "A nova senha deve ter pelo menos 6 caracteres.", variant: "destructive"});
       setIsProcessingAction(null);
       return;
    }

    if (Object.keys(updates).length === 0) {
      toast({ title: "Nenhuma Alteração", description: "Nenhum dado foi modificado." });
      setIsEditDialogOpen(false);
      setIsProcessingAction(null);
      return;
    }

    try {
      const result = await updateUserByAdmin(currentUser.email, editingUser.email, updates);
      if (result.status === 'success') {
        toast({ title: "Usuário Atualizado", description: `Dados do usuário ${editingUser.email} foram atualizados.` });
        fetchAllUsers();
        setIsEditDialogOpen(false);
      } else {
        toast({ title: "Erro ao Atualizar", description: result.message, variant: "destructive" });
      }
    } catch (error) {
      toast({ title: "Erro Crítico", description: (error as Error).message, variant: "destructive" });
    } finally {
      setIsProcessingAction(null);
    }
  };


  if (isLoadingPage || authLoading) {
    return <div className="flex items-center justify-center h-screen"><Loader2 className="h-12 w-12 animate-spin text-primary" /><p className="ml-3">Carregando...</p></div>;
  }

  if (!isDefinitelyAdmin) {
    return (
      <Card className="m-auto mt-10 max-w-lg text-center shadow-xl">
        <CardHeader><ShieldAlert className="mx-auto h-16 w-16 text-destructive mb-4" /><CardTitle className="text-2xl">Acesso Negado</CardTitle></CardHeader>
        <CardContent><p className="text-muted-foreground">Você não tem permissão para acessar esta página.</p><Button onClick={() => router.push('/dashboard')} className="mt-6">Voltar ao Dashboard</Button></CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center text-2xl"><Users className="mr-3 h-7 w-7 text-primary" />Gerenciamento de Usuários</CardTitle>
          <CardDescription>Visualize e gerencie todos os usuários registrados no sistema.</CardDescription>
        </CardHeader>
        <CardContent>
          {users.length === 0 ? (
            <div className="text-center py-10"><Users className="mx-auto h-12 w-12 text-muted-foreground mb-4" /><p className="text-muted-foreground">Nenhum usuário encontrado no sistema.</p></div>
          ) : (
            <div className="overflow-x-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Aprovado?</TableHead>
                    <TableHead>Admin?</TableHead>
                    <TableHead>Registrado em</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((user) => (
                    <TableRow key={user.uid}>
                      <TableCell className="font-medium">{user.name || 'N/A'}</TableCell>
                      <TableCell>{user.email}</TableCell>
                      <TableCell>
                        {user.isApproved ? <Badge variant="default" className="bg-green-600 hover:bg-green-700">Sim</Badge> : <Badge variant="destructive">Não</Badge>}
                        {user.pendingApproval && !user.isApproved && <Badge variant="outline" className="ml-2 border-amber-500 text-amber-600">Pendente</Badge>}
                      </TableCell>
                      <TableCell>{user.isAdmin ? <Badge variant="secondary">Sim</Badge> : 'Não'}</TableCell>
                      <TableCell>
                        {user.createdAt && isValid(new Date(user.createdAt instanceof Date ? user.createdAt.getTime() : user.createdAt.seconds * 1000))
                          ? format(new Date(user.createdAt instanceof Date ? user.createdAt.getTime() : user.createdAt.seconds * 1000), 'dd/MM/yyyy HH:mm', { locale: ptBR })
                          : 'N/A'}
                      </TableCell>
                      <TableCell className="text-right space-x-2 whitespace-nowrap">
                        <Button variant="outline" size="sm" onClick={() => openEditDialog(user)} disabled={isProcessingAction === user.email}>
                          {isProcessingAction === user.email && editingUser?.email === user.email ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Edit3 className="mr-1 h-4 w-4" />} Editar
                        </Button>
                        <Button
                            variant={user.isApproved ? "destructive" : "default"}
                            size="sm"
                            onClick={() => handleToggleApproval(user)}
                            disabled={isProcessingAction === user.email || user.email.toLowerCase() === ADMIN_PRIMARY_EMAIL_CLIENT.toLowerCase()}
                            className={user.isApproved ? "" : "bg-green-600 hover:bg-green-700"}
                        >
                            {isProcessingAction === user.email && !editingUser ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : (user.isApproved ? <XCircle className="mr-1 h-4 w-4" /> : <CheckCircle className="mr-1 h-4 w-4" />)}
                            {user.isApproved ? 'Desaprovar' : 'Aprovar'}
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="destructive" size="sm" disabled={isProcessingAction === user.email || user.email.toLowerCase() === ADMIN_PRIMARY_EMAIL_CLIENT.toLowerCase()}>
                                <Trash2 className="mr-1 h-4 w-4" /> Excluir
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader><AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle><AlertDialogDescription>Tem certeza que deseja excluir o usuário {user.email}? Esta ação não pode ser desfeita.</AlertDialogDescription></AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleDeleteUser(user.email)} className="bg-destructive hover:bg-destructive/90">
                                {isProcessingAction === user.email ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Excluir
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {editingUser && (
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Editar Usuário: {editingUser.email}</DialogTitle>
              <DialogDescription>Altere o nome ou defina uma nova senha para o usuário.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="edit-name" className="text-right">Nome</Label>
                <Input id="edit-name" value={editFormData.name} onChange={(e) => setEditFormData(prev => ({ ...prev, name: e.target.value }))} className="col-span-3" />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="edit-password" className="text-right">Nova Senha</Label>
                <Input id="edit-password" type="password" value={editFormData.password || ''} onChange={(e) => setEditFormData(prev => ({ ...prev, password: e.target.value }))} className="col-span-3" placeholder="Deixe em branco para não alterar" />
              </div>
               {editFormData.password && editFormData.password.length > 0 && editFormData.password.length < 6 && (
                <p className="col-span-4 text-xs text-destructive text-center">Nova senha deve ter pelo menos 6 caracteres.</p>
              )}
            </div>
            <DialogFooter>
              <DialogClose asChild><Button variant="outline">Cancelar</Button></DialogClose>
              <Button onClick={handleEditUserSubmit} disabled={!!isProcessingAction}>
                {isProcessingAction === editingUser.email ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Salvar Alterações
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
