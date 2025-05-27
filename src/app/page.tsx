
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged } from 'firebase/auth';
import { clientAuth, firestore } from '@/lib/firebase/config';
import { doc, getDoc } from 'firebase/firestore';
import { Loader2 } from 'lucide-react';

export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(clientAuth, async (user) => {
      if (user) {
        // User is signed in, check if approved and redirect to dashboard
        if (!firestore) {
            console.error("Firestore not available for homepage redirect check");
            router.push('/login'); // Fallback to login if DB check fails
            return;
        }
        const userDocRef = doc(firestore, 'users', user.uid);
        const userDoc = await getDoc(userDocRef);
        if (userDoc.exists() && userDoc.data().isApproved) {
          router.replace('/dashboard');
        } else {
          // Not approved or data missing, redirect to login (after signing out if needed)
          await clientAuth.signOut();
          router.replace('/login');
        }
      } else {
        // No user signed in, redirect to login page
        router.replace('/login');
      }
    });

    return () => unsubscribe(); // Cleanup subscription on unmount
  }, [router]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-background text-foreground">
      <Loader2 className="h-16 w-16 animate-spin text-primary mb-6" />
      <h1 className="text-2xl font-semibold mb-2">Carregando...</h1>
      <p className="text-muted-foreground">Redirecionando para a página apropriada.</p>
    </div>
  );
}
