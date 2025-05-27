
'use client';

import { useEffect, useState } from 'react'; // useActionState não é mais necessário aqui
import { useRouter, useSearchParams } from 'next/navigation';
import { signInWithEmailAndPassword, onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { FirebaseError } from 'firebase/app';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
// Link para registro removido
import { clientAuth } from '@/lib/firebase/config';
import { LogIn, Loader2 } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const { toast } = useToast();
  const searchParams = useSearchParams();
  const [isLoading, setIsLoading] = useState(false);
  const [formMessage, setFormMessage] = useState<{ message: string, status: string } | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(clientAuth, (user) => {
      if (user) {
        // Usuário está logado, redireciona para o dashboard
        // A lógica de aprovação foi removida
        toast({ title: 'Login Bem-sucedido', description: 'Redirecionando para o dashboard...' });
        router.push('/dashboard');
      }
    });
    return () => unsubscribe();
  }, [router, toast]);

  useEffect(() => {
    const approvalSuccess = searchParams.get('approvalSuccess');
    if (approvalSuccess === 'true') {
      toast({
        title: 'Conta Aprovada!',
        description: 'Sua conta foi aprovada com sucesso. Você já pode fazer login.',
      });
      // Remove o parâmetro da URL para não mostrar o toast novamente no refresh
      router.replace('/login', undefined);
    }
  }, [searchParams, toast, router]);


  const handleClientFirebaseLogin = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsLoading(true);
    setFormMessage(null);
    
    const formData = new FormData(event.currentTarget);
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;
    
    if (!email || !password) {
      toast({ title: 'Erro de Validação', description: 'Email e senha são obrigatórios.', variant: 'destructive' });
      setFormMessage({ message: 'Email e senha são obrigatórios.', status: 'error' });
      setIsLoading(false);
      return;
    }

    try {
      await signInWithEmailAndPassword(clientAuth, email, password);
      // onAuthStateChanged lidará com o redirecionamento.
      // setIsLoading(false) será tratado pelo redirecionamento ou erro.
    } catch (e: unknown) {
      setIsLoading(false);
      let errorMessage = 'Falha no login. Verifique suas credenciais.';
      let consoleLogFn: 'error' | 'warn' = 'error';
      let logMessagePrefix = 'Login error:';

      if (e instanceof FirebaseError) {
        logMessagePrefix = `Firebase login attempt failed (${e.code}):`;
        switch (e.code) {
          case 'auth/user-not-found':
          case 'auth/wrong-password':
          case 'auth/invalid-credential':
            errorMessage = 'Email ou senha inválidos.';
            consoleLogFn = 'warn';
            break;
          case 'auth/user-disabled':
            errorMessage = 'Esta conta está desabilitada.'; // Não deve acontecer com o sistema de aprovação removido
            consoleLogFn = 'warn';
            break;
          default:
            errorMessage = `Erro do Firebase: ${e.message || 'Erro desconhecido ao tentar logar.'}`;
            break;
        }
      } else if (e instanceof Error) {
        errorMessage = e.message;
        logMessagePrefix = 'Generic login error:';
      } else {
        logMessagePrefix = 'Unknown login error structure:';
      }

      if (consoleLogFn === 'warn') {
        console.warn(logMessagePrefix, e);
      } else {
        console.error(logMessagePrefix, e);
      }

      toast({
        title: 'Erro de Login',
        description: errorMessage,
        variant: 'destructive'
      });
      setFormMessage({ message: errorMessage, status: 'error' });
    }
  };
  
  return (
    <div className="flex items-center justify-center min-h-screen bg-background p-4">
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader className="text-center">
          <div className="mx-auto bg-primary text-primary-foreground rounded-full p-3 w-fit mb-4">
            <LogIn size={32} />
          </div>
          <CardTitle className="text-3xl font-bold">Bem-vindo!</CardTitle>
          <CardDescription>Faça login para acessar o Collection Gap Analyzer.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleClientFirebaseLogin} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input 
                id="email" 
                name="email" 
                type="email" 
                placeholder="seu@email.com" 
                defaultValue="altenburgstore@gmail.com" // Valor padrão para facilitar
                required 
                className="text-base py-3 px-4"/>
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <Input 
                id="password" 
                name="password" 
                type="password" 
                defaultValue="gapecommerce2025" // Valor padrão para facilitar
                required 
                className="text-base py-3 px-4"/>
            </div>
            <Button type="submit" className="w-full text-lg py-6" disabled={isLoading}>
              {isLoading ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <LogIn className="mr-2 h-5 w-5" />}
              Entrar
            </Button>
          </form>
        </CardContent>
        <CardFooter className="flex flex-col items-center space-y-2">
           {formMessage?.message && (
            <p className={`text-sm ${formMessage.status === 'error' ? 'text-destructive' : 'text-green-600'}`}>{formMessage.message}</p>
          )}
          {/* Link para registro removido */}
        </CardFooter>
      </Card>
    </div>
  );
}
