
'use server';

import { adminFirestore, adminSDKInitializationError } from '@/lib/firebase/adminConfig';
import type { UserProfile } from '@/types';
import { Timestamp } from 'firebase-admin/firestore';

interface AdminActionResult {
  message: string;
  status: 'success' | 'error';
  users?: UserProfile[];
}

const ADMIN_PRIMARY_EMAIL_SERVER = process.env.ADMIN_EMAIL || "gustavo.cordeiro@altenburg.com.br";

// This function is a simple check if the provided email matches the admin email.
async function verifyAdminByEmail(callerEmail: string | undefined): Promise<boolean> {
  console.log('[Admin Verification by Email] Starting verification...');
  console.log(`[Admin Verification by Email] Expected ADMIN_EMAIL from server env: '${ADMIN_PRIMARY_EMAIL_SERVER}'`);
  
  if (!callerEmail) {
    console.warn('[Admin Verification by Email] Failed: No caller email provided.');
    return false;
  }
  if (!ADMIN_PRIMARY_EMAIL_SERVER) {
    console.warn('[Admin Verification by Email] Failed: ADMIN_EMAIL environment variable is not set on the server.');
    return false;
  }

  const isAdmin = callerEmail.toLowerCase() === ADMIN_PRIMARY_EMAIL_SERVER.toLowerCase();
  if (isAdmin) {
    console.log(`[Admin Verification by Email] Success: Caller email '${callerEmail}' matches admin.`);
  } else {
    console.warn(`[Admin Verification by Email] Failed: Caller email '${callerEmail}' does NOT match admin. Expected: '${ADMIN_PRIMARY_EMAIL_SERVER}', Got: '${callerEmail}'.`);
  }
  return isAdmin;
}


export async function getPendingUsers(adminUserEmail: string): Promise<AdminActionResult> {
  console.log(`[Get Pending Users Action] Received request from admin: ${adminUserEmail}`);
  
  if (adminSDKInitializationError) {
    console.error(`[Get Pending Users Action] Failing due to Admin SDK init error: ${adminSDKInitializationError}`);
    return { message: `Erro Crítico no Servidor (Admin SDK): ${adminSDKInitializationError}`, status: 'error' };
  }
  if (!adminFirestore) {
    console.error("[Get Pending Users Action] Failing because Firestore Admin is not available.");
    return { message: "Erro Crítico no Servidor: Firestore Admin não está disponível.", status: 'error' };
  }
  if (!adminUserEmail) {
    console.error("[Get Pending Users Action] Failing because adminUserEmail was not provided.");
    return { message: "Email do administrador não fornecido para a ação.", status: "error" };
  }

  const isAdmin = await verifyAdminByEmail(adminUserEmail);
  if (!isAdmin) {
    return { message: 'Acesso não autorizado para buscar usuários pendentes (verificação de email falhou).', status: 'error' };
  }

  console.log('[Get Pending Users Action] Admin verified. Fetching pending users...');
  try {
    // =====================================================================================
    // IMPORTANTE: Esta consulta requer um ÍNDICE COMPOSTO no Firestore.
    // Se você receber um erro "FAILED_PRECONDITION", o Firestore geralmente fornecerá
    // um link direto nos logs do servidor para criar este índice.
    // O índice geralmente envolve os campos:
    // Coleção: `auth_users`
    // Campos:
    //   1. `pendingApproval` (Ascendente)
    //   2. `isApproved` (Ascendente)
    //   3. `createdAt` (Ascendente ou Descendente, dependendo da sua ordenação preferida)
    // =====================================================================================
    const snapshot = await adminFirestore
      .collection('auth_users')
      .where('pendingApproval', '==', true)
      .where('isApproved', '==', false)
      .orderBy('createdAt', 'asc')
      .get();

    if (snapshot.empty) {
      console.log('[Get Pending Users Action] No users pending approval found in Firestore.');
      return { message: 'Nenhum usuário pendente de aprovação.', status: 'success', users: [] };
    }

    const users: UserProfile[] = snapshot.docs.map(doc => {
        const data = doc.data();
        let createdAtDate : Date | undefined = undefined;
        if (data.createdAt) {
            if (data.createdAt instanceof Timestamp) {
                createdAtDate = data.createdAt.toDate();
            } else if (typeof data.createdAt === 'object' && 'seconds' in data.createdAt && typeof (data.createdAt as any).seconds === 'number') {
                 createdAtDate = new Date((data.createdAt as any).seconds * 1000);
            } else if (typeof data.createdAt === 'string' && !isNaN(new Date(data.createdAt).getTime())) {
                 createdAtDate = new Date(data.createdAt);
            } else if (typeof data.createdAt === 'number') { // For potential milliseconds since epoch
                createdAtDate = new Date(data.createdAt);
            }
        }
        return {
            uid: doc.id, // email is the doc.id in auth_users
            email: data.email,
            name: data.name || 'N/A',
            isApproved: data.isApproved === true, // Explicit boolean
            pendingApproval: data.pendingApproval === true, // Explicit boolean
            isAdmin: data.isAdmin === true, // Explicit boolean
            createdAt: createdAtDate,
        } as UserProfile;
    });
    console.log(`[Get Pending Users Action] Fetched ${users.length} pending users.`);
    return { message: 'Usuários pendentes carregados.', status: 'success', users };
  } catch (error) {
    console.error('[Get Pending Users Action] Error fetching pending users from Firestore:', error);
    const errorMessage = error instanceof Error ? error.message : "Erro desconhecido ao buscar usuários pendentes.";
    // Verifique se o erro é de FAILED_PRECONDITION (índice faltando) e adicione o link se for o caso.
    if (error instanceof Error && (error as any).code === 9 && (error as any).details?.includes('create_composite=')) {
        const firebaseErrorDetails = (error as any).details;
        return { message: `Erro ao buscar usuários pendentes no servidor: ${errorMessage.substring(0,100)}. ${firebaseErrorDetails}`, status: 'error' };
    }
    return { message: `Erro ao buscar usuários pendentes no servidor: ${errorMessage.substring(0, 200)}`, status: 'error' };
  }
}

export async function approveUserInFirestore(adminUserEmail: string, userEmailToApprove: string): Promise<AdminActionResult> {
  console.log(`[Approve User Action] Received request from admin '${adminUserEmail}' to approve user email: ${userEmailToApprove}`);
  if (adminSDKInitializationError) {
     console.error(`[Approve User Action] Failing due to Admin SDK init error: ${adminSDKInitializationError}`);
     return { message: `Erro Crítico no Servidor (Admin SDK): ${adminSDKInitializationError}`, status: 'error' };
  }
  if (!adminFirestore) {
    console.error("[Approve User Action] Failing because Firestore Admin is not available.");
    return { message: "Erro Crítico no Servidor: Firestore Admin não está disponível.", status: 'error' };
  }
  if (!adminUserEmail) {
    console.error("[Approve User Action] Failing because adminUserEmail was not provided.");
    return { message: "Email do administrador não fornecido para a ação.", status: "error" };
  }
  if (!userEmailToApprove) {
    console.error("[Approve User Action] Failing because userEmailToApprove was not provided.");
    return { message: 'Email do usuário para aprovação é obrigatório.', status: 'error' };
  }

  const isAdmin = await verifyAdminByEmail(adminUserEmail);
  if (!isAdmin) {
    return { message: 'Acesso não autorizado para aprovar usuário (verificação de email falhou).', status: 'error' };
  }

  console.log(`[Approve User Action] Admin verified. Approving user email: ${userEmailToApprove}`);
  try {
    const userDocRef = adminFirestore.collection('auth_users').doc(userEmailToApprove.toLowerCase());
    await userDocRef.update({
      isApproved: true,
      pendingApproval: false,
    });
    console.log(`[Approve User Action] User ${userEmailToApprove} approved successfully in Firestore.`);
    return { message: 'Usuário aprovado com sucesso!', status: 'success' };
  } catch (error) {
    console.error(`[Approve User Action] Error approving user ${userEmailToApprove} in Firestore:`, error);
    const errorMessage = error instanceof Error ? error.message : "Erro desconhecido ao aprovar usuário.";
    return { message: `Erro ao aprovar usuário no servidor: ${errorMessage.substring(0, 200)}`, status: 'error' };
  }
}
