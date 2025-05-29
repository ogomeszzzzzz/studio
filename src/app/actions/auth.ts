
'use server';

import { adminFirestore, adminSDKInitializationError } from '@/lib/firebase/adminConfig';
import { Timestamp } from 'firebase-admin/firestore';
import type { UserProfile } from '@/types';

interface ActionResult {
  message: string;
  status: 'success' | 'error' | 'pending';
  user?: UserProfile; // For login
}

const ADMIN_PRIMARY_EMAIL = process.env.ADMIN_EMAIL || "gustavo.cordeiro@altenburg.com.br";

export async function registerUserInFirestore(prevState: any, formData: FormData): Promise<ActionResult> {
  if (adminSDKInitializationError) {
    return { message: `Erro Crítico no Servidor (Admin SDK): ${adminSDKInitializationError}`, status: 'error' };
  }
  if (!adminFirestore) {
    return { message: "Erro Crítico no Servidor: Firestore Admin não está disponível.", status: 'error' };
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
    const userDocRef = adminFirestore.collection('auth_users').doc(email.toLowerCase());
    const userDoc = await userDocRef.get();

    if (userDoc.exists) {
      return { message: 'Este email já está registrado.', status: 'error' };
    }

    const isAdmin = email.toLowerCase() === ADMIN_PRIMARY_EMAIL.toLowerCase();
    const newUserProfile: UserProfile = {
      uid: email.toLowerCase(), // Use email as UID
      email: email.toLowerCase(),
      name,
      // ADVERTÊNCIA DE SEGURANÇA: Armazenando senha em texto plano. NÃO FAÇA ISSO EM PRODUÇÃO!
      // A senha deve ser hasheada antes de ser armazenada.
      // password: hashedPassword, // Exemplo se estivesse usando hash
      password: password, // Temporário para atender ao pedido, mas inseguro.
      isApproved: isAdmin, // Admin é aprovado automaticamente
      pendingApproval: !isAdmin, // Não admin precisa de aprovação
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
  if (adminSDKInitializationError) {
    return { message: `Erro Crítico no Servidor (Admin SDK): ${adminSDKInitializationError}`, status: 'error' };
  }
  if (!adminFirestore) {
    return { message: "Erro Crítico no Servidor: Firestore Admin não está disponível.", status: 'error' };
  }

  const email = formData.get('email') as string;
  const password = formData.get('password') as string;

  if (!email || !password) {
    return { message: 'Email e senha são obrigatórios.', status: 'error' };
  }

  try {
    const userDocRef = adminFirestore.collection('auth_users').doc(email.toLowerCase());
    const userDocSnap = await userDocRef.get();

    if (!userDocSnap.exists) {
      return { message: 'Email não encontrado.', status: 'error' };
    }

    const userData = userDocSnap.data() as UserProfile & { password?: string };

    // ADVERTÊNCIA DE SEGURANÇA: Comparação de senha em texto plano.
    // Em um sistema real, você compararia um hash da senha fornecida com o hash armazenado.
    if (userData.password !== password) {
      return { message: 'Senha incorreta.', status: 'error' };
    }

    if (!userData.isApproved && userData.pendingApproval) {
      return { message: 'Sua conta está pendente de aprovação pelo administrador.', status: 'pending' };
    }
    
    if (!userData.isApproved && !userData.pendingApproval) {
      return { message: 'Sua conta não foi aprovada. Contate o administrador.', status: 'error'};
    }

    // Login bem-sucedido
    const userProfileToReturn: UserProfile = {
      uid: userData.uid,
      email: userData.email,
      name: userData.name,
      isApproved: userData.isApproved,
      pendingApproval: userData.pendingApproval,
      isAdmin: userData.isAdmin,
      createdAt: userData.createdAt ? (userData.createdAt as Timestamp).toDate() : new Date(), // Convert Timestamp
    };

    return { message: 'Login bem-sucedido!', status: 'success', user: userProfileToReturn };

  } catch (error: any) {
    console.error('[Login User Firestore Action] Error:', error);
    return { message: `Erro no login: ${error.message || 'Erro desconhecido'}.`, status: 'error' };
  }
}
