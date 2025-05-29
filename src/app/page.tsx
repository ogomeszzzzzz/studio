
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged, type User as FirebaseUser } from 'firebase/auth';
import { clientAuth, firestore } from '@/lib/firebase/config';
import { doc, getDoc } from 'firebase/firestore';
import { Loader2 } from 'lucide-react';
import type { UserProfile } from '@/types';

export default function HomePage() {
  const router = useRouter();
  const [loadingMessage, setLoadingMessage] = useState("Carregando...");

  useEffect(() => {
    setLoadingMessage("Verificando autenticação...");
    const unsubscribe = onAuthStateChanged(clientAuth, async (fbUser: FirebaseUser | null) => {
      if (fbUser) {
        setLoadingMessage("Verificando status da conta...");
        try {
          const userDocRef = doc(firestore, 'users', fbUser.uid);
          const userDocSnap = await getDoc(userDocRef);

          if (userDocSnap.exists()) {
            const userProfile = userDocSnap.data() as UserProfile;
            if (userProfile.isApproved) {
              setLoadingMessage("Redirecionando para o dashboard...");
              router.replace('/dashboard');
            } else if (userProfile.pendingApproval) {
              setLoadingMessage("Conta pendente de aprovação...");
              // Stay on a "pending" state or redirect to a specific pending page if you create one
              // For now, we can redirect to login, where they'll be shown the pending message by the layout if they try to access app routes
              router.replace('/login'); 
            } else {
              setLoadingMessage("Conta não aprovada. Redirecionando para login...");
              router.replace('/login'); // Not approved, not pending -> login
            }
          } else {
            // User in Auth, but no Firestore document (e.g. error during registration or old user)
            setLoadingMessage("Perfil não encontrado. Redirecionando para login...");
            // Consider signing out the user here if this state is truly invalid
            // await signOut(clientAuth); 
            router.replace('/login');
          }
        } catch (error) {
          console.error("Error checking approval status on HomePage:", error);
          setLoadingMessage("Erro ao verificar status. Redirecionando para login...");
          router.replace('/login');
        }
      } else {
        // No user logged in
        setLoadingMessage("Redirecionando para login...");
        router.replace('/login');
      }
    });

    return () => unsubscribe();
  }, [router]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-background text-foreground">
      <Loader2 className="h-16 w-16 animate-spin text-primary mb-6" />
      <h1 className="text-2xl font-semibold mb-2">{loadingMessage}</h1>
      <p className="text-muted-foreground">Por favor, aguarde.</p>
    </div>
  );
}
