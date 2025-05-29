
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { signInWithEmailAndPassword, onAuthStateChanged, type User as FirebaseUser } from 'firebase/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { clientAuth } from '@/lib/firebase/config';
import { LogIn, Loader2, UserPlus } from 'lucide-react';
import Link from 'next/link';


export default function LoginPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(clientAuth, (user) => {
      if (user) {
        // O layout (app)/layout.tsx cuidará da verificação de aprovação e redirecionamento para dashboard
        // ou para a tela de pendente. Se o usuário está logado, ele não deve estar na página de login.
        router.replace('/dashboard');
      }
    });
    return () => unsubscribe();
  }, [router]);


  const handleClientFirebaseLogin = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsLoading(true);
    
    const formData = new FormData(event.currentTarget);
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;
    
    if (!email || !password) {
      toast({ title: 'Erro de Validação', description: 'Email e senha são obrigatórios.', variant: 'destructive' });
      setIsLoading(false);
      return;
    }

    try {
      await signInWithEmailAndPassword(clientAuth, email, password);
      // Se o login for bem-sucedido, o onAuthStateChanged listener (no useEffect acima)
      // irá detectar a mudança de estado e redirecionar para /dashboard.
      // Adicionamos um toast aqui para feedback imediato.
      toast({ title: 'Login Bem-sucedido', description: 'Verificando status da conta...' });
      // O setIsLoading(false) não é estritamente necessário aqui porque a navegação deve ocorrer,
      // desmontando o componente ou o estado de carregamento será interrompido pela mudança de página.
      // Mas é bom ter em caso de falha no redirecionamento por algum motivo inesperado.
    } catch (e: unknown) {
      setIsLoading(false);
      let errorMessage = 'Falha no login. Verifique suas credenciais.';
      let consoleLogFn: 'error' | 'warn' = 'error';
      let logMessagePrefix = 'Login error:';

      // Check if 'e' is an object and has a 'code' property (typical for Firebase errors)
      if (e && typeof e === 'object' && 'code' in e) {
        const firebaseError = e as { code: string; message?: string }; // Type assertion
        logMessagePrefix = `Firebase login attempt failed (${firebaseError.code}):`;
        switch (firebaseError.code) {
          case 'auth/user-not-found':
          case 'auth/wrong-password':
          case 'auth/invalid-credential':
            errorMessage = 'Email ou senha inválidos.';
            consoleLogFn = 'warn';
            break;
          case 'auth/user-disabled':
            errorMessage = 'Esta conta está desabilitada.';
            consoleLogFn = 'warn';
            break;
          case 'auth/invalid-email':
             errorMessage = 'O formato do email é inválido.';
             consoleLogFn = 'warn';
             break;
          default:
            errorMessage = `Erro: ${firebaseError.message || 'Erro desconhecido ao tentar logar.'}`;
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
          <CardDescription>Faça login para acessar o Painel de Controle de Estoque e Ruptura do E-commerce.</CardDescription>
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
                required 
                className="text-base py-3 px-4"/>
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <Input 
                id="password" 
                name="password" 
                type="password" 
                placeholder="••••••••"
                required 
                className="text-base py-3 px-4"/>
            </div>
            <Button type="submit" className="w-full text-lg py-6" disabled={isLoading}>
              {isLoading ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <LogIn className="mr-2 h-5 w-5" />}
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
