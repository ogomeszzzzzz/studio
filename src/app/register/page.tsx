
'use client';

import { useEffect } from 'react';
import { useFormState } from 'react-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';
import { registerUser } from '@/app/actions/auth';
import { UserPlus, LogIn } from 'lucide-react';

export default function RegisterPage() {
  const { toast } = useToast();
  const [state, formAction] = useFormState(registerUser, { message: '', status: '' });

  useEffect(() => {
    if (state?.status === 'success' && state.message) {
      toast({ title: 'Registro Enviado', description: state.message });
      // Optionally redirect or clear form here
    } else if (state?.status === 'error' && state.message) {
      toast({ title: 'Erro de Registro', description: state.message, variant: 'destructive' });
    }
  }, [state, toast]);

  return (
    <div className="flex items-center justify-center min-h-screen bg-background p-4">
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader className="text-center">
           <div className="mx-auto bg-primary text-primary-foreground rounded-full p-3 w-fit mb-4">
            <UserPlus size={32} />
          </div>
          <CardTitle className="text-3xl font-bold">Criar Conta</CardTitle>
          <CardDescription>Preencha os campos abaixo para se registrar.</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={formAction} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" placeholder="seu@email.com" required 
                     className="text-base py-3 px-4"/>
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <Input id="password" name="password" type="password" placeholder="Mínimo 6 caracteres" required 
                     className="text-base py-3 px-4"/>
            </div>
             <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirmar Senha</Label>
              <Input id="confirmPassword" name="confirmPassword" type="password" placeholder="Repita a senha" required 
                     className="text-base py-3 px-4"/>
            </div>
            <Button type="submit" className="w-full text-lg py-6">
              <UserPlus className="mr-2 h-5 w-5" /> Registrar
            </Button>
          </form>
        </CardContent>
         <CardFooter className="flex flex-col items-center space-y-2">
           {state?.message && (
            <p className={`text-sm ${state.status === 'error' ? 'text-destructive' : 'text-green-600'}`}>{state.message}</p>
          )}
          <p className="text-sm text-muted-foreground">
            Já tem uma conta?{' '}
            <Link href="/login" className="font-medium text-primary hover:underline">
              Faça login
            </Link>
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}
