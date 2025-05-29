
'use client';

import { useEffect, useState } from 'react';
import { useActionState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { LogIn, Loader2, UserPlus } from 'lucide-react';
import Link from 'next/link';
import { loginUserWithFirestore } from '@/app/actions/auth';
import { useAuth } from '@/contexts/AuthContext';
import type { UserProfile } from '@/types';

const initialLoginState = { message: '', status: '' as 'success' | 'error' | 'pending' | '', user: undefined as UserProfile | undefined };

export default function LoginPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { setCurrentUser, currentUser: contextUser, isLoading: authLoading } = useAuth();
  const [state, formAction, isFormPending] = useActionState(loginUserWithFirestore, initialLoginState);

  useEffect(() => {
    if (contextUser && contextUser.isApproved) {
      router.replace('/dashboard');
    }
  }, [contextUser, router]);

  useEffect(() => {
    if (state.status === 'success' && state.user) {
      toast({ title: 'Login Bem-sucedido!', description: state.message });
      setCurrentUser(state.user); // This will trigger redirect via contextUser change
    } else if (state.status === 'error') {
      toast({ title: 'Erro de Login', description: state.message, variant: 'destructive' });
    } else if (state.status === 'pending') {
      toast({ title: 'Conta Pendente', description: state.message, variant: 'default' });
    }
  }, [state, toast, router, setCurrentUser]);

  if (authLoading) {
     return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="ml-4 text-lg text-foreground">Carregando...</p>
      </div>
    );
  }

  if (contextUser && contextUser.isApproved) {
    // Already handled by useEffect, but good for initial render if fast
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="ml-4 text-lg text-foreground">Redirecionando...</p>
      </div>
    );
  }


  return (
    <div className="flex items-center justify-center min-h-screen bg-background p-4">
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader className="text-center">
          <div className="mx-auto bg-primary text-primary-foreground rounded-full p-3 w-fit mb-4">
            <LogIn size={32} />
          </div>
          <CardTitle className="text-3xl font-bold">Bem-vindo!</CardTitle>
          <CardDescription>Faça login para acessar o Painel de Controle de Estoque e Ruptura do E-commerce.</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={formAction} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="seu@email.com"
                required
                className="text-base py-3 px-4"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <Input
                id="password"
                name="password"
                type="password"
                placeholder="••••••••"
                required
                className="text-base py-3 px-4"
              />
            </div>
            <Button type="submit" className="w-full text-lg py-6" disabled={isFormPending}>
              {isFormPending ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <LogIn className="mr-2 h-5 w-5" />}
              Entrar
            </Button>
          </form>
        </CardContent>
        <CardFooter className="flex flex-col items-center space-y-4 pt-6">
           <p className="text-sm">
             Não tem uma conta?{' '}
             <Link href="/register" className="font-medium text-primary hover:underline flex items-center gap-1">
               <UserPlus className="h-4 w-4" />
               Registre-se
             </Link>
           </p>
           <p className="text-xs text-muted-foreground pt-2">
             Todos os direitos reservados ao E-Commerce Altenburg
           </p>
        </CardFooter>
      </Card>
    </div>
  );
}
