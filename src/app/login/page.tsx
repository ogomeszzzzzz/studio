
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useFormState } from 'react-dom';
import { signInWithEmailAndPassword, onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';
import { clientAuth, firestore } from '@/lib/firebase/config'; // Client auth
import { LogIn, UserPlus } from 'lucide-react';

// Placeholder for a server action (not fully implemented here for brevity in client-side handling)
async function loginUserAction(prevState: any, formData: FormData) {
  // This server action would ideally handle server-side checks if needed,
  // but primary Firebase login is client-side.
  // For this example, we'll focus on client-side Firebase auth.
  // In a real app, you might use this to set secure HTTPOnly cookies.
  const email = formData.get('email') as string;
  const password = formData.get('password') as string;
   if (!email || !password) {
    return { message: 'Email e senha são obrigatórios.', status: 'error' };
  }
  return { message: 'Tentando login...', status: 'pending' };
}


export default function LoginPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [state, formAction] = useFormState(loginUserAction, { message: '', status: '' });

 useEffect(() => {
    const unsubscribe = onAuthStateChanged(clientAuth, (user) => {
      if (user) {
        // User is signed in, see if they are approved
        checkApprovalAndRedirect(user);
      }
    });
    return () => unsubscribe();
  }, [router]);


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


  const handleLogin = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;
    
    // Trigger the formAction for optimistic UI or server-side logic if any
    // For now, it's mostly a placeholder as Firebase auth is client-driven
    formAction(formData);


    if (!email || !password) {
      toast({ title: 'Erro de Validação', description: 'Email e senha são obrigatórios.', variant: 'destructive' });
      return;
    }

    try {
      const userCredential = await signInWithEmailAndPassword(clientAuth, email, password);
      // onAuthStateChanged will handle redirection after approval check
    } catch (error: any) {
      console.error('Login error:', error);
      let errorMessage = 'Falha no login. Verifique suas credenciais.';
      if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
        errorMessage = 'Email ou senha inválidos.';
      } else if (error.code === 'auth/user-disabled') {
        errorMessage = 'Esta conta está desabilitada. Pode estar aguardando aprovação.';
      }
      toast({ title: 'Erro de Login', description: errorMessage, variant: 'destructive' });
    }
  };
  
  useEffect(() => {
    if (state?.status === 'error' && state.message) {
      toast({ title: 'Erro', description: state.message, variant: 'destructive' });
    }
    // Do not show success toast here, as actual success is handled by onAuthStateChanged
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
          <form onSubmit={handleLogin} className="space-y-6">
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
           {state?.message && state.status === 'error' && (
            <p className="text-sm text-destructive">{state.message}</p>
          )}
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
