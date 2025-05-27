
'use client';

import { useEffect, useActionState } from 'react';
import { useRouter } from 'next/navigation';
import { signInWithEmailAndPassword, onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { FirebaseError } from 'firebase/app'; // Changed from import type
import { doc, getDoc } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';
import { clientAuth, firestore } from '@/lib/firebase/config'; // Client auth
import { LogIn, UserPlus } from 'lucide-react';

// This server action is called by the form's `action` prop.
// It's primarily for pre-flight checks or setting initial form state.
async function loginUserAction(prevState: any, formData: FormData) {
  const email = formData.get('email') as string;
  const password = formData.get('password') as string;
   if (!email || !password) {
    return { message: 'Email e senha são obrigatórios.', status: 'error' };
  }
  // This message will be set while the client-side Firebase login attempts.
  return { message: 'Tentando login...', status: 'pending' };
}


export default function LoginPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [state, formAction] = useActionState(loginUserAction, { message: '', status: '' });

 useEffect(() => {
    const unsubscribe = onAuthStateChanged(clientAuth, (user) => {
      if (user) {
        // User is signed in, see if they are approved
        checkApprovalAndRedirect(user);
      }
    });
    return () => unsubscribe();
  }, [router, toast]); // Added toast to dependency array as it's used in checkApprovalAndRedirect


  const checkApprovalAndRedirect = async (user: FirebaseUser) => {
    if (!firestore) {
        toast({ title: 'Erro', description: 'Serviço de banco de dados não disponível.', variant: 'destructive'});
        await clientAuth.signOut(); // Log out if we can't check approval
        return;
    }
    const userDocRef = doc(firestore, 'users', user.uid);
    const userDoc = await getDoc(userDocRef);

    if (userDoc.exists() && userDoc.data()?.isApproved) {
      toast({ title: 'Login Bem-sucedido', description: 'Redirecionando para o dashboard...' });
      router.push('/dashboard');
    } else {
      toast({
        title: 'Aguardando Aprovação',
        description: 'Sua conta ainda não foi aprovada por um administrador ou não existe.',
        variant: 'destructive',
      });
      await clientAuth.signOut(); // Log out user if not approved
    }
  };

  // This handler is for client-side Firebase authentication.
  // The server action `formAction` is invoked by the form's `action` prop.
  const handleClientFirebaseLogin = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault(); // Important: prevent default as Firebase login is client-side.
    
    const formData = new FormData(event.currentTarget);
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;
    
    // The server action (`loginUserAction` via `formAction`) has already been triggered by the form's `action` prop.
    // `state` will reflect its outcome (e.g., "Tentando login..." or validation error).

    if (!email || !password) {
      // Client-side validation can also show a toast, though server action also checks.
      toast({ title: 'Erro de Validação', description: 'Email e senha são obrigatórios.', variant: 'destructive' });
      return;
    }

    try {
      // Perform the actual client-side Firebase login.
      const userCredential = await signInWithEmailAndPassword(clientAuth, email, password);
      // onAuthStateChanged will handle redirection after approval check.
    } catch (e: unknown) {
      let errorMessage = 'Falha no login. Verifique suas credenciais.';
      // Default to console.error for unexpected issues
      let consoleLogFn: 'error' | 'warn' = 'error';
      let logMessagePrefix = 'Login error:';

      if (e instanceof FirebaseError) { // FirebaseError is a class from 'firebase/app'
        logMessagePrefix = `Firebase login attempt failed (${e.code}):`;
        switch (e.code) {
          case 'auth/user-not-found':
          case 'auth/wrong-password':
          case 'auth/invalid-credential':
            errorMessage = 'Email ou senha inválidos.';
            consoleLogFn = 'warn'; // Downgrade to warn for expected, handled auth errors
            break;
          case 'auth/user-disabled':
            errorMessage = 'Esta conta está desabilitada. Pode estar aguardando aprovação.';
            consoleLogFn = 'warn'; // Downgrade to warn
            break;
          default:
            // Keep as error for unexpected Firebase error codes
            errorMessage = `Erro do Firebase: ${e.message || 'Erro desconhecido ao tentar logar.'}`;
            break;
        }
      } else if (e instanceof Error) {
        errorMessage = e.message;
        logMessagePrefix = 'Generic login error:';
      } else {
        logMessagePrefix = 'Unknown login error structure:';
      }

      // Log to console (warn or error based on type)
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
  
  useEffect(() => {
    // This useEffect handles messages from the server action's state.
    if (state?.status === 'error' && state.message) {
      toast({ title: 'Erro', description: state.message, variant: 'destructive' });
    } else if (state?.status === 'pending' && state.message) {
      // Optionally, show a "pending" toast, though it might be quick.
      // toast({ title: 'Progresso', description: state.message });
    }
    // Actual success (login and redirect) is handled by onAuthStateChanged.
  }, [state, toast]);

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
          {/* Pass formAction to the form's `action` prop */}
          <form action={formAction} onSubmit={handleClientFirebaseLogin} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" placeholder="seu@email.com" required 
                     className="text-base py-3 px-4"/>
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <Input id="password" name="password" type="password" required 
                     className="text-base py-3 px-4"/>
            </div>
            <Button type="submit" className="w-full text-lg py-6">
              <LogIn className="mr-2 h-5 w-5" /> Entrar
            </Button>
          </form>
        </CardContent>
        <CardFooter className="flex flex-col items-center space-y-2">
           {/* Display message from server action state if it's an error */}
           {state?.message && state.status === 'error' && (
            <p className="text-sm text-destructive">{state.message}</p>
          )}
          {/* The "pending" message from the server action is subtle and might be overwritten by other toasts. */}
          {/* For example, if email/password are empty, server action returns error state, this toast shows. */}
          {/* If email/password are provided, server action returns pending, then client login attempts. */}
          <p className="text-sm text-muted-foreground">
            Não tem uma conta?{' '}
            <Link href="/register" className="font-medium text-primary hover:underline">
              Registre-se
            </Link>
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}
