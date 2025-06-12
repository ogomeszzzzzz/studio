
'use server';

import { getAdminAuthInstance, getAdminFirestoreInstance, getAdminSDKInitializationError } from '@/lib/firebase/adminConfig';
import type { UserProfile } from '@/types';
import { Timestamp } from 'firebase-admin/firestore';
import bcrypt from 'bcrypt';

interface AdminActionResult {
  message: string;
  status: 'success' | 'error';
  users?: UserProfile[];
}

const ADMIN_PRIMARY_EMAIL_SERVER = process.env.ADMIN_EMAIL || "gustavo.cordeiro@altenburg.com.br";
const SALT_ROUNDS = 10;
const LOG_VERSION_TAG_ACTION = "V36"; 

async function verifyAdminByEmail(callerEmail: string | undefined): Promise<boolean> {
  const expectedAdminEmailFromServer = ADMIN_PRIMARY_EMAIL_SERVER; 
  if (!callerEmail) return false;
  if (!expectedAdminEmailFromServer) return false;
  return callerEmail.toLowerCase() === expectedAdminEmailFromServer.toLowerCase();
}

export async function getPendingUsers(adminUserEmail: string): Promise<AdminActionResult> {
  const adminAuth = getAdminAuthInstance();
  const adminFirestore_DefaultDB = getAdminFirestoreInstance();
  const adminSDKInitError = getAdminSDKInitializationError();
  
  console.log(`[Get Pending Users Action - PRE-CHECK ${LOG_VERSION_TAG_ACTION}] adminSDKInitError: ${adminSDKInitError}`);
  console.log(`[Get Pending Users Action - PRE-CHECK ${LOG_VERSION_TAG_ACTION}] adminAuth is null: ${adminAuth === null}`);
  console.log(`[Get Pending Users Action - PRE-CHECK ${LOG_VERSION_TAG_ACTION}] adminFirestore_DefaultDB is null: ${adminFirestore_DefaultDB === null}`);

  if (adminSDKInitError || !adminAuth || !adminFirestore_DefaultDB) {
    const errorMsg = `Erro Crítico de Inicialização do Servidor (Admin SDK): ${adminSDKInitError || 'Serviços Admin não disponíveis'}. Verifique os logs V36 do servidor. (REF: SDK_INIT_FAIL_IN_ACTION_GPU_${LOG_VERSION_TAG_ACTION})`;
    console.error(`[Get Pending Users Action - CRITICAL_FAILURE] ${errorMsg}`);
    return { message: errorMsg, status: 'error' };
  }
  
  if (!adminUserEmail) {
    return { message: "Email do administrador não fornecido para a ação.", status: "error" };
  }

  const isAdmin = await verifyAdminByEmail(adminUserEmail);
  if (!isAdmin) {
    return { message: 'Acesso não autorizado para buscar usuários pendentes (verificação de email falhou).', status: 'error' };
  }

  console.log(`[Get Pending Users Action ${LOG_VERSION_TAG_ACTION}] Admin verified. Fetching pending users...`);
  try {
    const snapshot = await adminFirestore_DefaultDB
      .collection('auth_users')
      .where('pendingApproval', '==', true)
      .where('isApproved', '==', false) 
      .orderBy('createdAt', 'asc')
      .get();

    if (snapshot.empty) {
      return { message: 'Nenhum usuário pendente de aprovação.', status: 'success', users: [] };
    }

    const users: UserProfile[] = snapshot.docs.map(docSnap => {
        const data = docSnap.data();
        let createdAtVal: Date | { seconds: number; nanoseconds: number } | undefined;
        if (data.createdAt) {
            if (data.createdAt instanceof Timestamp) {
                createdAtVal = { seconds: data.createdAt.seconds, nanoseconds: data.createdAt.nanoseconds };
            } else if (typeof data.createdAt === 'object' && 'seconds' in data.createdAt && typeof data.createdAt.seconds === 'number') {
                 createdAtVal = { seconds: data.createdAt.seconds, nanoseconds: data.createdAt.nanoseconds || 0 };
            } else if (data.createdAt._seconds !== undefined) { 
                createdAtVal = { seconds: data.createdAt._seconds, nanoseconds: data.createdAt._nanoseconds || 0 };
            }
        }
        return {
            uid: docSnap.id,
            email: data.email,
            name: data.name || 'N/A',
            isApproved: data.isApproved === true,
            pendingApproval: data.pendingApproval === true,
            isAdmin: data.isAdmin === true,
            createdAt: createdAtVal, 
            photoURL: data.photoURL,
        } as UserProfile;
    });
    return { message: 'Usuários pendentes carregados.', status: 'success', users };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Erro desconhecido ao buscar usuários pendentes.";
    if (error instanceof Error && (error as any).code === 5) {
        const firebaseErrorDetails = (error as any).details || "Índice composto necessário.";
        return { message: `Erro ao buscar usuários: Índice do Firestore necessário. Detalhes: ${firebaseErrorDetails.substring(0,300)}`, status: 'error' };
    }
    return { message: `Erro ao buscar usuários pendentes no servidor: ${errorMessage.substring(0, 200)}`, status: 'error' };
  }
}

export async function approveUserInFirestore(adminUserEmail: string, userEmailToApprove: string): Promise<AdminActionResult> {
  const adminAuth = getAdminAuthInstance();
  const adminFirestore_DefaultDB = getAdminFirestoreInstance();
  const adminSDKInitError = getAdminSDKInitializationError();

  console.log(`[Approve User Action - PRE-CHECK ${LOG_VERSION_TAG_ACTION}] adminSDKInitError: ${adminSDKInitError}`);
  console.log(`[Approve User Action - PRE-CHECK ${LOG_VERSION_TAG_ACTION}] adminAuth is null: ${adminAuth === null}`);
  console.log(`[Approve User Action - PRE-CHECK ${LOG_VERSION_TAG_ACTION}] adminFirestore_DefaultDB is null: ${adminFirestore_DefaultDB === null}`);
  
  if (adminSDKInitError || !adminAuth || !adminFirestore_DefaultDB) {
    const errorMsg = `Erro Crítico de Inicialização do Servidor (Admin SDK): ${adminSDKInitError || 'Serviços Admin não disponíveis'}. Verifique os logs V36 do servidor. (REF: SDK_INIT_FAIL_IN_ACTION_APU_${LOG_VERSION_TAG_ACTION})`;
    console.error(`[Approve User Action - CRITICAL_FAILURE] ${errorMsg}`);
    return { message: errorMsg, status: 'error' };
  }

  if (!adminUserEmail) return { message: "Email do administrador não fornecido para a ação.", status: "error" };
  if (!userEmailToApprove) return { message: 'Email do usuário para aprovação é obrigatório.', status: 'error' };

  const isAdmin = await verifyAdminByEmail(adminUserEmail);
  if (!isAdmin) return { message: 'Acesso não autorizado para aprovar usuário (verificação de email falhou).', status: 'error' };

  try {
    const userDocRef = adminFirestore_DefaultDB.collection('auth_users').doc(userEmailToApprove.toLowerCase());
    await userDocRef.update({
      isApproved: true,
      pendingApproval: false,
    });
    return { message: 'Usuário aprovado com sucesso!', status: 'success' };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Erro desconhecido ao aprovar usuário.";
    return { message: `Erro ao aprovar usuário no servidor: ${errorMessage.substring(0, 200)}`, status: 'error' };
  }
}

export async function getAllUsers(adminUserEmail: string): Promise<AdminActionResult> {
  const adminAuth = getAdminAuthInstance();
  const adminFirestore_DefaultDB = getAdminFirestoreInstance();
  const adminSDKInitError = getAdminSDKInitializationError();

  console.log(`[Get All Users Action - PRE-CHECK ${LOG_VERSION_TAG_ACTION}] adminSDKInitError: ${adminSDKInitError}`);
  console.log(`[Get All Users Action - PRE-CHECK ${LOG_VERSION_TAG_ACTION}] adminAuth is null: ${adminAuth === null}`);
  console.log(`[Get All Users Action - PRE-CHECK ${LOG_VERSION_TAG_ACTION}] adminFirestore_DefaultDB is null: ${adminFirestore_DefaultDB === null}`);
  
  if (adminSDKInitError || !adminAuth || !adminFirestore_DefaultDB) {
    const errorMsg = `Erro Crítico de Inicialização do Servidor (Admin SDK): ${adminSDKInitError || 'Serviços Admin não disponíveis'}. Verifique os logs V36 do servidor. (REF: SDK_INIT_FAIL_IN_ACTION_GAU_${LOG_VERSION_TAG_ACTION})`;
    console.error(`[Get All Users Action - CRITICAL_FAILURE] ${errorMsg}`);
    return { message: errorMsg, status: 'error' };
  }
  
  if (!adminUserEmail) return { message: "Email do administrador não fornecido.", status: "error" };

  const isAdmin = await verifyAdminByEmail(adminUserEmail);
  if (!isAdmin) return { message: 'Acesso não autorizado (verificação de email falhou).', status: 'error' };

  try {
    const snapshot = await adminFirestore_DefaultDB.collection('auth_users').orderBy('createdAt', 'desc').get();
    const users: UserProfile[] = snapshot.docs.map(docSnap => {
      const data = docSnap.data();
      let createdAtVal: Date | { seconds: number; nanoseconds: number } | undefined;
      if (data.createdAt) {
        if (data.createdAt instanceof Timestamp) createdAtVal = { seconds: data.createdAt.seconds, nanoseconds: data.createdAt.nanoseconds };
        else if (typeof data.createdAt === 'object' && 'seconds' in data.createdAt) createdAtVal = { seconds: data.createdAt.seconds, nanoseconds: data.createdAt.nanoseconds || 0 };
        else if (data.createdAt._seconds !== undefined) createdAtVal = { seconds: data.createdAt._seconds, nanoseconds: data.createdAt._nanoseconds || 0 };
      }
      return {
        uid: docSnap.id, 
        email: data.email,
        name: data.name || data.email, 
        isApproved: data.isApproved === true,
        pendingApproval: data.pendingApproval === true,
        isAdmin: data.isAdmin === true,
        createdAt: createdAtVal,
        photoURL: data.photoURL,
      } as UserProfile;
    });
    return { message: 'Usuários carregados.', status: 'success', users };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Erro desconhecido.";
    return { message: `Erro ao buscar todos os usuários: ${errorMessage.substring(0, 200)}`, status: 'error' };
  }
}

export async function updateUserByAdmin(
  adminUserEmail: string,
  targetUserEmail: string,
  updates: { name?: string; password?: string; isApproved?: boolean; isAdmin?: boolean }
): Promise<AdminActionResult> {
  const adminAuth = getAdminAuthInstance();
  const adminFirestore_DefaultDB = getAdminFirestoreInstance();
  const adminSDKInitError = getAdminSDKInitializationError();

  console.log(`[Update User by Admin Action - PRE-CHECK ${LOG_VERSION_TAG_ACTION}] adminSDKInitError: ${adminSDKInitError}`);
  console.log(`[Update User by Admin Action - PRE-CHECK ${LOG_VERSION_TAG_ACTION}] adminAuth is null: ${adminAuth === null}`);
  console.log(`[Update User by Admin Action - PRE-CHECK ${LOG_VERSION_TAG_ACTION}] adminFirestore_DefaultDB is null: ${adminFirestore_DefaultDB === null}`);
  
  if (adminSDKInitError || !adminAuth || !adminFirestore_DefaultDB) {
    const errorMsg = `Erro Crítico de Inicialização do Servidor (Admin SDK): ${adminSDKInitError || 'Serviços Admin não disponíveis'}. Verifique os logs V36 do servidor. (REF: SDK_INIT_FAIL_IN_ACTION_UUA_${LOG_VERSION_TAG_ACTION})`;
    console.error(`[Update User by Admin Action - CRITICAL_FAILURE] ${errorMsg}`);
    return { message: errorMsg, status: 'error' };
  }

  if (!adminUserEmail || !targetUserEmail) return { message: "Emails do administrador e do usuário alvo são obrigatórios.", status: 'error' };

  const isAdmin = await verifyAdminByEmail(adminUserEmail);
  if (!isAdmin) return { message: 'Acesso não autorizado (verificação de email falhou).', status: 'error' };

  if (targetUserEmail.toLowerCase() === ADMIN_PRIMARY_EMAIL_SERVER.toLowerCase() && updates.isAdmin === false) {
    return { message: 'Não é permitido remover o status de administrador do administrador principal.', status: 'error' };
  }
  if (targetUserEmail.toLowerCase() === ADMIN_PRIMARY_EMAIL_SERVER.toLowerCase() && updates.isApproved === false) {
    return { message: 'Não é permitido desaprovar o administrador principal.', status: 'error' };
  }

  try {
    const userDocRef = adminFirestore_DefaultDB.collection('auth_users').doc(targetUserEmail.toLowerCase());
    const updateData: Partial<UserProfile> & { password?: string } = {};

    if (updates.name !== undefined) updateData.name = updates.name;
    if (updates.password !== undefined) {
      if (updates.password.length > 0 && updates.password.length < 6) {
        return { message: "Nova senha deve ter pelo menos 6 caracteres.", status: "error"};
      }
      if (updates.password.length >= 6) {
         const salt = await bcrypt.genSalt(SALT_ROUNDS);
         const hashedPassword = await bcrypt.hash(updates.password, salt);
         updateData.password = hashedPassword; 
      }
    }
    if (updates.isApproved !== undefined) {
        updateData.isApproved = updates.isApproved;
        if (updates.isApproved) updateData.pendingApproval = false; 
    }
    if (updates.isAdmin !== undefined) updateData.isAdmin = updates.isAdmin;

    if (Object.keys(updateData).length === 0) {
        return { message: "Nenhuma alteração fornecida.", status: "success" };
    }

    await userDocRef.update(updateData);
    return { message: 'Usuário atualizado com sucesso.', status: 'success' };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Erro desconhecido.";
    return { message: `Erro ao atualizar usuário: ${errorMessage.substring(0, 200)}`, status: 'error' };
  }
}

export async function deleteUserByAdmin(adminUserEmail: string, targetUserEmail: string): Promise<AdminActionResult> {
  const adminAuth = getAdminAuthInstance();
  const adminFirestore_DefaultDB = getAdminFirestoreInstance();
  const adminSDKInitError = getAdminSDKInitializationError();

  console.log(`[Delete User by Admin Action - PRE-CHECK ${LOG_VERSION_TAG_ACTION}] adminSDKInitError: ${adminSDKInitError}`);
  console.log(`[Delete User by Admin Action - PRE-CHECK ${LOG_VERSION_TAG_ACTION}] adminAuth is null: ${adminAuth === null}`);
  console.log(`[Delete User by Admin Action - PRE-CHECK ${LOG_VERSION_TAG_ACTION}] adminFirestore_DefaultDB is null: ${adminFirestore_DefaultDB === null}`);
  
  if (adminSDKInitError || !adminAuth || !adminFirestore_DefaultDB) {
    const errorMsg = `Erro Crítico de Inicialização do Servidor (Admin SDK): ${adminSDKInitError || 'Serviços Admin não disponíveis'}. Verifique os logs V36 do servidor. (REF: SDK_INIT_FAIL_IN_ACTION_DUA_${LOG_VERSION_TAG_ACTION})`;
    console.error(`[Delete User by Admin Action - CRITICAL_FAILURE] ${errorMsg}`);
    return { message: errorMsg, status: 'error' };
  }
  
  if (!adminUserEmail || !targetUserEmail) return { message: "Emails do administrador e do usuário alvo são obrigatórios.", status: 'error' };

  const isAdmin = await verifyAdminByEmail(adminUserEmail);
  if (!isAdmin) return { message: 'Acesso não autorizado (verificação de email falhou).', status: 'error' };

  if (targetUserEmail.toLowerCase() === ADMIN_PRIMARY_EMAIL_SERVER.toLowerCase()) {
    return { message: 'Não é permitido excluir o administrador principal.', status: 'error' };
  }

  try {
    const userDocRef = adminFirestore_DefaultDB.collection('auth_users').doc(targetUserEmail.toLowerCase());
    await userDocRef.delete();
    return { message: 'Usuário excluído com sucesso do Firestore.', status: 'success' };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Erro desconhecido.";
    return { message: `Erro ao excluir usuário: ${errorMessage.substring(0, 200)}`, status: 'error' };
  }
}
