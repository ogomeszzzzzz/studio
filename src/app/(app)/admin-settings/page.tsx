
'use client';

import { useEffect, useState, useActionState } from 'react';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged, type User as FirebaseUser } from 'firebase/auth';
import { clientAuth } from '@/lib/firebase/config';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Loader2, UserPlus, AlertTriangle, ShieldCheck } from 'lucide-react';
import { createUserByAdmin } from '@/app/actions/admin'; // We will create this action

const ADMIN_EMAIL_ADDRESS = process.env.NEXT_PUBLIC_ADMIN_EMAIL || "gustavo.cordeiro@altenburg.com.br"; // Fallback for safety

type FormState = {
  message: string;
  status: 'success' | 'error' | '';
};

const initialFormState: FormState = { message: '', status: '' };

export default function AdminSettingsPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  const [loadingUser, setLoadingUser] = useState(true);
  const [isAuthorizedAdmin, setIsAuthorizedAdmin] = useState(false);

  const [formState, formAction, isPending] = useActionState(createUserByAdmin, initialFormState);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(clientAuth, (user) => {
      setCurrentUser(user);
      if (user) {
        if (user.email === ADMIN_EMAIL_ADDRESS) {
          setIsAuthorizedAdmin(true);
        } else {
          setIsAuthorizedAdmin(false);
        }
      } else {
        setIsAuthorizedAdmin(false);
        router.replace('/login'); // Not logged in, redirect
      }
      setLoadingUser(false);
    });
    return () => unsubscribe();
  }, [router]);

  useEffect(() => {
    if (formState.message) {
      toast({
        title: formState.status === 'success' ? 'Sucesso!' : 'Erro ao Criar Usuário',
        description: formState.message,
        variant: formState.status === 'success' ? 'default' : 'destructive',
      });
    }
  }, [formState, toast]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!currentUser) {
      toast({ title: 'Erro', description: 'Administrador não autenticado.', variant: 'destructive' });
      return;
    }
    try {
      const adminIdToken = await currentUser.getIdToken(true); // Force refresh token
      const formData = new FormData(event.currentTarget);
      formData.append('adminIdToken', adminIdToken);
      formAction(formData);
    } catch (error) {
      console.error("Error getting admin ID token:", error);
      toast({ title: 'Erro de Token', description: 'Não foi possível obter o token de administrador.', variant: 'destructive' });
    }
  };


  if (loadingUser) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-200px)]">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="ml-4 text-lg text-foreground">Verificando autorização...</p>
      </div>
    );
  }

  if (!isAuthorizedAdmin) {
    return (
      <Card className="max-w-md mx-auto mt-10 shadow-lg border-destructive border-l-4">
        <CardHeader>
          <CardTitle className="flex items-center text-destructive">
            <AlertTriangle className="mr-2 h-6 w-6" /> Acesso Negado
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Você não tem permissão para acessar esta página.</p>
          <Button onClick={() => router.push('/dashboard')} className="mt-4">Voltar ao Dashboard</Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-8">
      <Card className="shadow-xl border-primary border-t-4">
        <CardHeader>
          <CardTitle className="text-2xl font-bold tracking-tight text-foreground flex items-center">
            <ShieldCheck className="mr-3 h-7 w-7 text-primary" />
            Configurações de Administrador
          </CardTitle>
          <CardDescription>Gerencie usuários e outras configurações do sistema.</CardDescription>
        </CardHeader>
      </Card>

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center text-xl">
            <UserPlus className="mr-2 h-6 w-6 text-primary" /> Criar Novo Usuário
          </CardTitle>
          <CardDescription>
            Crie uma nova conta de usuário para acesso ao sistema.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="newUserEmail">Email do Novo Usuário</Label>
              <Input
                id="newUserEmail"
                name="newUserEmail"
                type="email"
                placeholder="novo.usuario@example.com"
                required
                className="text-base"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="newPassword">Senha para o Novo Usuário</Label>
              <Input
                id="newPassword"
                name="newPassword"
                type="password"
                placeholder="Senha (mín. 6 caracteres)"
                required
                minLength={6}
                className="text-base"
              />
            </div>
            <Button type="submit" className="w-full sm:w-auto" disabled={isPending}>
              {isPending ? (
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              ) : (
                <UserPlus className="mr-2 h-5 w-5" />
              )}
              {isPending ? 'Criando Usuário...' : 'Criar Usuário'}
            </Button>
          </form>
        </CardContent>
        {formState.message && formState.status === 'error' && (
          <CardFooter>
             <p className="text-sm text-destructive">{formState.message}</p>
          </CardFooter>
        )}
      </Card>
    </div>
  );
}
