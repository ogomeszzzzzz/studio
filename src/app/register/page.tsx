
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
import { registerUser } from '@/app/actions/auth'; // We'll create/update this
import Link from 'next/link';
import { onAuthStateChanged } from 'firebase/auth';
import { clientAuth } from '@/lib/firebase/config';

export default function RegisterPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [state, formAction, isPending] = useActionState(registerUser, null);
  const [passwordsMatch, setPasswordsMatch] = useState(true);

 useEffect(() => {
    // If user is already logged in, redirect them from register page
    const unsubscribe = onAuthStateChanged(clientAuth, (user) => {
      if (user) {
        router.replace('/dashboard'); // Or wherever logged-in users should go
      }
    });
    return () => unsubscribe();
  }, [router]);

  useEffect(() => {
    if (state?.status === 'success') {
      toast({
        title: 'Registro Bem-sucedido!',
        description: state.message,
        duration: 5000,
      });
      // Optionally redirect to login or a page saying "awaiting approval"
      // router.push('/login'); 
    } else if (state?.status === 'error') {
      toast({
        title: 'Erro no Registro',
        description: state.message,
        variant: 'destructive',
      });
    }
  }, [state, toast, router]);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const password = formData.get('password') as string;
    const confirmPassword = formData.get('confirmPassword') as string;

    if (password !== confirmPassword) {
      setPasswordsMatch(false);
      toast({
        title: 'Erro de Validação',
        description: 'As senhas não coincidem.',
        variant: 'destructive',
      });
      return;
    }
    setPasswordsMatch(true);
    formAction(formData);
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-background p-4">
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader className="text-center">
          <div className="mx-auto bg-primary text-primary-foreground rounded-full p-3 w-fit mb-4">
            <UserPlus size={32} />
          </div>
          <CardTitle className="text-3xl font-bold">Criar Conta</CardTitle>
          <CardDescription>Registre-se para solicitar acesso ao painel.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="name">Nome Completo</Label>
              <Input id="name" name="name" type="text" placeholder="Seu nome completo" required />
            </div>
            <div>
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" placeholder="seu@email.com" required />
            </div>
            <div>
              <Label htmlFor="password">Senha</Label>
              <Input id="password" name="password" type="password" placeholder="••••••••" required minLength={6}/>
            </div>
            <div>
              <Label htmlFor="confirmPassword">Confirmar Senha</Label>
              <Input id="confirmPassword" name="confirmPassword" type="password" placeholder="••••••••" required minLength={6}/>
              {!passwordsMatch && <p className="text-sm text-destructive mt-1">As senhas não coincidem.</p>}
            </div>
            <Button type="submit" className="w-full text-lg py-3" disabled={isPending}>
              {isPending ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <UserPlus className="mr-2 h-5 w-5" />}
              Registrar
            </Button>
          </form>
        </CardContent>
        <CardFooter className="flex flex-col items-center space-y-2 pt-4">
          <p className="text-sm">
            Já tem uma conta?{' '}
            <Link href="/login" className="font-medium text-primary hover:underline">
              Faça login
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
