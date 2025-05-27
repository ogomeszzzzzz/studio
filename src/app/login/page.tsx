
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation'; // useSearchParams removido pois não é usado
import { signInWithEmailAndPassword, onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { FirebaseError } from 'firebase/app';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { clientAuth } from '@/lib/firebase/config';
import { LogIn, Loader2 } from 'lucide-react';
// loginUserServerAction e useActionState removidos pois o login é puramente client-side agora

export default function LoginPage() {
  const router = useRouter();
  const { toast } = useToast();
  // searchParams e formMessage/state não são mais necessários com o login puramente client-side.
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(clientAuth, (user) => {
      if (user) {
        // Usuário está logado, redireciona para o dashboard.
        // O toast de login bem-sucedido pode ser movido para após o signIn bem-sucedido
        // ou mantido aqui, mas pode aparecer em cada recarregamento se o usuário já estiver logado.
        // Vamos deixar o toast para o momento do login efetivo.
        router.replace('/dashboard'); // Usar replace para não adicionar /login ao histórico
      }
      // Se o usuário não estiver logado, ele permanece na página de login.
    });
    return () => unsubscribe();
  }, [router]);


  const handleClientFirebaseLogin = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsLoading(true);
    // setFormMessage(null); // Removido
    
    const formData = new FormData(event.currentTarget);
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;
    
    if (!email || !password) {
      toast({ title: 'Erro de Validação', description: 'Email e senha são obrigatórios.', variant: 'destructive' });
      // setFormMessage({ message: 'Email e senha são obrigatórios.', status: 'error' }); // Removido
      setIsLoading(false);
      return;
    }

    try {
      await signInWithEmailAndPassword(clientAuth, email, password);
      // Se o login for bem-sucedido, o onAuthStateChanged listener (no useEffect acima)
      // irá detectar a mudança de estado e redirecionar para /dashboard.
      // Adicionamos um toast aqui para feedback imediato.
      toast({ title: 'Login Bem-sucedido', description: 'Redirecionando para o dashboard...' });
      // Não precisamos de setIsLoading(false) aqui, pois o redirecionamento desmontará o componente.
      // No entanto, se o redirecionamento demorar, o botão permanecerá em loading.
      // Para ser seguro, e se o onAuthStateChanged demorar, vamos setar para false,
      // mas o redirecionamento deve ser rápido.
      // Na verdade, o onAuthStateChanged já trata o redirecionamento. Se houver erro, o catch trata o isLoading.
      // Se não houver erro, o redirecionamento vai acontecer.
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
            errorMessage = 'Esta conta está desabilitada.';
            consoleLogFn = 'warn';
            break;
          case 'auth/invalid-email':
             errorMessage = 'O formato do email é inválido.';
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
      // setFormMessage({ message: errorMessage, status: 'error' }); // Removido
    }
    // Não é necessário setIsLoading(false) aqui, pois ou houve erro (tratado no catch)
    // ou houve sucesso (e o onAuthStateChanged cuidará do redirecionamento, desmontando o componente)
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
          {/* formAction removido do form, onSubmit é suficiente para client-side auth */}
          <form onSubmit={handleClientFirebaseLogin} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input 
                id="email" 
                name="email" 
                type="email" 
                placeholder="seu@email.com" 
                required 
                // defaultValue removido
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
                // defaultValue removido
                className="text-base py-3 px-4"/>
            </div>
            <Button type="submit" className="w-full text-lg py-6" disabled={isLoading}>
              {isLoading ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <LogIn className="mr-2 h-5 w-5" />}
              Entrar
            </Button>
          </form>
        </CardContent>
        <CardFooter className="flex flex-col items-center space-y-2">
           {/* formMessage removido, toasts são usados para feedback */}
        </CardFooter>
      </Card>
    </div>
  );
}

