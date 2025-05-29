
'use server';

import { adminAuth, adminFirestore } from '@/lib/firebase/adminConfig';
import { Timestamp } from 'firebase-admin/firestore'; // Import Timestamp from admin SDK

interface ActionResult {
  message: string;
  status: 'success' | 'error' | 'pending';
}

export async function registerUser(prevState: any, formData: FormData): Promise<ActionResult> {
  const name = formData.get('name') as string;
  const email = formData.get('email') as string;
  const password = formData.get('password') as string;

  if (!name || !email || !password) {
    return { message: 'Nome, email e senha são obrigatórios.', status: 'error' };
  }
  if (password.length < 6) {
    return { message: 'A senha deve ter pelo menos 6 caracteres.', status: 'error' };
  }

  if (!adminAuth || !adminFirestore) {
    console.error('Firebase Admin SDK não inicializado corretamente.');
    return { message: 'Erro no servidor. Tente novamente mais tarde. (Admin SDK)', status: 'error' };
  }

  try {
    // Create user in Firebase Authentication
    const userRecord = await adminAuth.createUser({
      email: email,
      password: password,
      displayName: name,
      disabled: false, // User is enabled by default, approval is via Firestore field
    });

    // Create user document in Firestore
    const userDocRef = adminFirestore.collection('users').doc(userRecord.uid);
    await userDocRef.set({
      uid: userRecord.uid,
      name: name,
      email: email,
      createdAt: Timestamp.now(), // Use Firestore server timestamp
      isApproved: false,
      pendingApproval: true,
    });

    return { message: 'Registro realizado com sucesso! Sua conta está pendente de aprovação pelo administrador.', status: 'success' };
  } catch (error: any) {
    console.error('Error registering user:', error);
    let errorMessage = 'Ocorreu um erro ao registrar. Tente novamente.';
    if (error.code === 'auth/email-already-exists') {
      errorMessage = 'Este email já está registrado.';
    } else if (error.code === 'auth/invalid-email') {
      errorMessage = 'O formato do email é inválido.';
    }
    // Add more Firebase Auth error codes as needed
    return { message: errorMessage, status: 'error' };
  }
}


export async function loginUserServerAction(prevState: any, formData: FormData) {
  const email = formData.get('email') as string;
  const password = formData.get('password') as string;

  if (!email || !password) {
    return { message: 'Email e senha são obrigatórios.', status: 'error' };
  }
  // This server action is mostly a placeholder as login is client-side with Firebase SDK.
  // Actual auth happens client-side. This could be used for pre-flight checks or logging.
  console.log(`[Server Action] Tentativa de login para: ${email}`);
  return { message: 'Processando login...', status: 'pending' };
}
