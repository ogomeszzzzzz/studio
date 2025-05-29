
'use server';

import { adminAuth, adminFirestore, adminSDKInitializationError } from '@/lib/firebase/adminConfig';
import { Timestamp } from 'firebase-admin/firestore'; // Import Timestamp from admin SDK

interface ActionResult {
  message: string;
  status: 'success' | 'error' | 'pending';
}

export async function registerUser(prevState: any, formData: FormData): Promise<ActionResult> {
  if (adminSDKInitializationError) {
    console.error(`[Register User Action] Admin SDK not initialized: ${adminSDKInitializationError}`);
    return { message: `Erro Crítico no Servidor: Falha na configuração do Firebase Admin. Por favor, contate o suporte. (Detalhe: ${adminSDKInitializationError})`, status: 'error' };
  }
  if (!adminAuth || !adminFirestore) {
    const errorDetail = adminSDKInitializationError || "adminAuth or adminFirestore is null post-initialization check.";
    console.error(`[Register User Action] Firebase Admin SDK not fully available: ${errorDetail}`);
    return { message: `Erro Crítico no Servidor: Componentes do Firebase Admin não estão prontos. Por favor, contate o suporte. (Detalhe: ${errorDetail})`, status: 'error' };
  }

  const name = formData.get('name') as string;
  const email = formData.get('email') as string;
  const password = formData.get('password') as string;

  if (!name || !email || !password) {
    return { message: 'Nome, email e senha são obrigatórios.', status: 'error' };
  }
  if (password.length < 6) {
    return { message: 'A senha deve ter pelo menos 6 caracteres.', status: 'error' };
  }

  try {
    // Create user in Firebase Authentication
    const userRecord = await adminAuth.createUser({
      email: email,
      password: password,
      displayName: name,
      disabled: false, 
    });

    // Create user document in Firestore
    const userDocRef = adminFirestore.collection('users').doc(userRecord.uid);
    await userDocRef.set({
      uid: userRecord.uid,
      name: name,
      email: email,
      createdAt: Timestamp.now(), 
      isApproved: false,
      pendingApproval: true,
    });

    return { message: 'Registro realizado com sucesso! Sua conta está pendente de aprovação pelo administrador.', status: 'success' };
  } catch (error: any) {
    console.error('[Register User Action] Error registering user:', error);
    let errorMessage = 'Ocorreu um erro ao registrar. Tente novamente.';
    if (error.code === 'auth/email-already-exists') {
      errorMessage = 'Este email já está registrado.';
    } else if (error.code === 'auth/invalid-email') {
      errorMessage = 'O formato do email é inválido.';
    }
    return { message: errorMessage, status: 'error' };
  }
}


export async function loginUserServerAction(prevState: any, formData: FormData) {
  const email = formData.get('email') as string;
  const password = formData.get('password') as string;

  if (!email || !password) {
    return { message: 'Email e senha são obrigatórios.', status: 'error' };
  }
  console.log(`[Server Action - Login Placeholder] Tentativa de login para: ${email}`);
  return { message: 'Processando login...', status: 'pending' };
}
