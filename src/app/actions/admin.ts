
'use server';

import { adminFirestore_DefaultDB, adminSDKInitializationError } from '@/lib/firebase/adminConfig';
import type { UserProfile } from '@/types';
import { Timestamp } from 'firebase-admin/firestore';

interface AdminActionResult {
  message: string;
  status: 'success' | 'error';
  users?: UserProfile[];
}

const ADMIN_PRIMARY_EMAIL_SERVER = process.env.ADMIN_EMAIL || "gustavo.cordeiro@altenburg.com.br";

async function verifyAdminByEmail(callerEmail: string | undefined): Promise<boolean> {
  const expectedAdminEmailFromServer = ADMIN_PRIMARY_EMAIL_SERVER;
  console.log(`[Admin Verification by Email] SERVER_ADMIN_EMAIL value being used: '${expectedAdminEmailFromServer}'`);
  
  if (!callerEmail) {
    console.warn('[Admin Verification by Email] Failed: No caller email provided.');
    return false;
  }
  if (!expectedAdminEmailFromServer) {
    console.warn('[Admin Verification by Email] Failed: ADMIN_EMAIL environment variable is not set on the server.');
    return false;
  }

  const isAdmin = callerEmail.toLowerCase() === expectedAdminEmailFromServer.toLowerCase();
  if (isAdmin) {
    console.log(`[Admin Verification by Email] Success: Caller email '${callerEmail}' matches admin.`);
  } else {
    console.warn(`[Admin Verification by Email] Failed: Caller email '${callerEmail}' does NOT match admin. Expected: '${expectedAdminEmailFromServer}', Got: '${callerEmail}'.`);
  }
  return isAdmin;
}


export async function getPendingUsers(adminUserEmail: string): Promise<AdminActionResult> {
  console.log(`[Get Pending Users Action] Received request from admin: ${adminUserEmail}`);
  
  if (adminSDKInitializationError) {
    console.error(`[Get Pending Users Action] Failing due to Admin SDK init error: ${adminSDKInitializationError}`);
    return { message: `Erro Crítico no Servidor (Admin SDK): ${adminSDKInitializationError.substring(0, 200)}`, status: 'error' };
  }
  if (!adminFirestore_DefaultDB) {
    console.error("[Get Pending Users Action] Failing because Firestore Admin (Default DB) is not available.");
    return { message: "Erro Crítico no Servidor: Firestore Admin (Default DB) não está disponível.", status: 'error' };
  }
  if (!adminUserEmail) {
    console.error("[Get Pending Users Action] Failing because adminUserEmail was not provided.");
    return { message: "Email do administrador não fornecido para a ação.", status: "error" };
  }

  const isAdmin = await verifyAdminByEmail(adminUserEmail);
  if (!isAdmin) {
    return { message: 'Acesso não autorizado para buscar usuários pendentes (verificação de email falhou).', status: 'error' };
  }

  console.log('[Get Pending Users Action] Admin verified. Fetching pending users from Firestore (Default DB)...');
  try {
    // =====================================================================================
    // IMPORTANTE: Esta consulta requer um ÍNDICE COMPOSTO no Firestore (Default DB).
    // Coleção: `auth_users`
    // Campos do Índice:
    //   1. `pendingApproval` (Ascendente)
    //   2. `isApproved` (Ascendente)
    //   3. `createdAt` (Ascendente ou Descendente) - O Firestore geralmente sugere a ordem para `createdAt`
    // O Firestore fornecerá um link para criar este índice se ele estiver faltando.
    // Verifique os logs do servidor para este link se o erro "FAILED_PRECONDITION" ocorrer.
    // O link será específico para o seu projeto.
    // Exemplo: `isApproved` (Ascendente), `pendingApproval` (Ascendente), `createdAt` (Descendente)
    // =====================================================================================
    const snapshot = await adminFirestore_DefaultDB
      .collection('auth_users')
      .where('pendingApproval', '==', true)
      .where('isApproved', '==', false) // Ensure we only get those not yet approved
      .orderBy('createdAt', 'asc')
      .get();

    if (snapshot.empty) {
      console.log('[Get Pending Users Action] No users pending approval found in Firestore (Default DB).');
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
            } else {
                console.warn(`[Get Pending Users Action] User ${data.email} has an unexpected createdAt format:`, data.createdAt);
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
        } as UserProfile;
    });
    console.log(`[Get Pending Users Action] Fetched ${users.length} pending users from Firestore (Default DB).`);
    return { message: 'Usuários pendentes carregados.', status: 'success', users };
  } catch (error) {
    console.error('[Get Pending Users Action] Error fetching pending users from Firestore (Default DB):', error);
    const errorMessage = error instanceof Error ? error.message : "Erro desconhecido ao buscar usuários pendentes.";
    
    if (error instanceof Error && (error as any).code === 9 /* FAILED_PRECONDITION */) {
        const firebaseErrorDetails = (error as any).details || "Índice composto necessário. Verifique os logs do servidor para o link de criação do índice.";
        console.error(`[Get Pending Users Action] Firestore Index Required (Default DB): ${firebaseErrorDetails}`);
        return { message: `Erro ao buscar usuários: Índice do Firestore necessário. Detalhes: ${firebaseErrorDetails.substring(0,300)}`, status: 'error' };
    }
    return { message: `Erro ao buscar usuários pendentes no servidor: ${errorMessage.substring(0, 200)}`, status: 'error' };
  }
}

export async function approveUserInFirestore(adminUserEmail: string, userEmailToApprove: string): Promise<AdminActionResult> {
  console.log(`[Approve User Action] Received request from admin '${adminUserEmail}' to approve user email: ${userEmailToApprove}`);
  if (adminSDKInitializationError) {
     console.error(`[Approve User Action] Failing due to Admin SDK init error: ${adminSDKInitializationError}`);
     return { message: `Erro Crítico no Servidor (Admin SDK): ${adminSDKInitializationError.substring(0,200)}`, status: 'error' };
  }
  if (!adminFirestore_DefaultDB) {
    console.error("[Approve User Action] Failing because Firestore Admin (Default DB) is not available.");
    return { message: "Erro Crítico no Servidor: Firestore Admin (Default DB) não está disponível.", status: 'error' };
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

  console.log(`[Approve User Action] Admin verified. Approving user email: ${userEmailToApprove} in Firestore (Default DB)`);
  try {
    const userDocRef = adminFirestore_DefaultDB.collection('auth_users').doc(userEmailToApprove.toLowerCase());
    await userDocRef.update({
      isApproved: true,
      pendingApproval: false,
      // You might want to add an 'approvedAt: Timestamp.now()' field here too
      // approvedAt: Timestamp.now(),
    });
    console.log(`[Approve User Action] User ${userEmailToApprove} approved successfully in Firestore (Default DB).`);
    return { message: 'Usuário aprovado com sucesso!', status: 'success' };
  } catch (error) {
    console.error(`[Approve User Action] Error approving user ${userEmailToApprove} in Firestore (Default DB):`, error);
    const errorMessage = error instanceof Error ? error.message : "Erro desconhecido ao aprovar usuário.";
    return { message: `Erro ao aprovar usuário no servidor: ${errorMessage.substring(0, 200)}`, status: 'error' };
  }
}
