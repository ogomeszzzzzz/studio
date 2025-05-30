
'use server';

import { adminFirestore_DefaultDB, adminSDKInitializationError as adminSDKAuthError } from '@/lib/firebase/adminConfig';
import { Timestamp } from 'firebase-admin/firestore';
import type { UserProfile } from '@/types';

interface ActionResult {
  message: string;
  status: 'success' | 'error' | 'pending';
  user?: UserProfile; 
}

const ADMIN_PRIMARY_EMAIL = process.env.ADMIN_EMAIL || "gustavo.cordeiro@altenburg.com.br";

export async function registerUserInFirestore(prevState: any, formData: FormData): Promise<ActionResult> {
  if (adminSDKAuthError) {
    return { message: `Erro Crítico no Servidor (Admin SDK): ${adminSDKAuthError}`, status: 'error' };
  }
  if (!adminFirestore_DefaultDB) {
    return { message: "Erro Crítico no Servidor: Conexão com Firestore (Default DB) para usuários não está disponível.", status: 'error' };
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
    const userDocRef = adminFirestore_DefaultDB.collection('auth_users').doc(email.toLowerCase());
    const userDoc = await userDocRef.get();

    if (userDoc.exists) {
      return { message: 'Este email já está registrado.', status: 'error' };
    }

    const isAdmin = email.toLowerCase() === ADMIN_PRIMARY_EMAIL.toLowerCase();
    const newUserProfile: Omit<UserProfile, 'uid'> & { password?: string; createdAt: Timestamp } = {
      email: email.toLowerCase(),
      name,
      password: password, // ATENÇÃO: Senha em texto plano!
      isApproved: isAdmin, 
      pendingApproval: !isAdmin, 
      isAdmin: isAdmin,
      createdAt: Timestamp.now(),
    };

    await userDocRef.set(newUserProfile);

    return {
      message: isAdmin
        ? 'Conta de administrador registrada e aprovada automaticamente!'
        : 'Registro realizado com sucesso! Sua conta está pendente de aprovação pelo administrador.',
      status: 'success'
    };
  } catch (error: any) {
    console.error('[Register User Firestore Action] Error:', error);
    return { message: `Ocorreu um erro ao registrar: ${error.message || 'Erro desconhecido'}.`, status: 'error' };
  }
}

export async function loginUserWithFirestore(prevState: any, formData: FormData): Promise<ActionResult> {
  if (adminSDKAuthError) {
    return { message: `Erro Crítico no Servidor (Admin SDK): ${adminSDKAuthError}`, status: 'error' };
  }
  if (!adminFirestore_DefaultDB) {
     return { message: "Erro Crítico no Servidor: Conexão com Firestore (Default DB) para usuários não está disponível.", status: 'error' };
  }

  const email = formData.get('email') as string;
  const password = formData.get('password') as string;

  if (!email || !password) {
    return { message: 'Email e senha são obrigatórios.', status: 'error' };
  }

  try {
    const userDocRef = adminFirestore_DefaultDB.collection('auth_users').doc(email.toLowerCase());
    const userDocSnap = await userDocRef.get();

    if (!userDocSnap.exists) {
      return { message: 'Email não encontrado.', status: 'error' };
    }

    const userDataFromDb = userDocSnap.data();
    if (!userDataFromDb) {
        return { message: 'Dados do usuário não encontrados após o fetch.', status: 'error' };
    }
    
    // ATENÇÃO: Comparação de senha em texto plano!
    if (userDataFromDb.password !== password) {
      return { message: 'Senha incorreta.', status: 'error' };
    }

    if (!userDataFromDb.isApproved && userDataFromDb.pendingApproval) {
      return { message: 'Sua conta está pendente de aprovação pelo administrador.', status: 'pending' };
    }
    
    if (!userDataFromDb.isApproved && !userDataFromDb.pendingApproval) {
      return { message: 'Sua conta não foi aprovada. Contate o administrador.', status: 'error'};
    }

    const userProfileToReturn: UserProfile = {
      uid: userDocSnap.id, // email é o ID
      email: userDataFromDb.email,
      name: userDataFromDb.name,
      isApproved: userDataFromDb.isApproved,
      pendingApproval: userDataFromDb.pendingApproval,
      isAdmin: userDataFromDb.isAdmin,
      createdAt: userDataFromDb.createdAt ? (userDataFromDb.createdAt as Timestamp).toDate() : new Date(),
    };

    return { message: 'Login bem-sucedido!', status: 'success', user: userProfileToReturn };

  } catch (error: any) {
    console.error('[Login User Firestore Action] Error:', error);
    return { message: `Erro no login: ${error.message || 'Erro desconhecido'}.`, status: 'error' };
  }
}
