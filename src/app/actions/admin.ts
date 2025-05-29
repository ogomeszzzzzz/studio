
'use server';

import { adminFirestore, adminAuth, adminSDKInitializationError } from '@/lib/firebase/adminConfig';
import type { UserProfile } from '@/types';
import { Timestamp } from 'firebase-admin/firestore';

interface AdminActionResult {
  message: string;
  status: 'success' | 'error';
  users?: UserProfile[];
}

const ADMIN_PRIMARY_EMAIL_SERVER = process.env.ADMIN_EMAIL || "gustavo.cordeiro@altenburg.com.br";

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

  console.log('[Get Pending Users Action] Admin verified. Fetching pending users from Firestore database ID "ecom"...');
  try {
    // =====================================================================================
    // IMPORTANTE: Esta consulta requer um ÍNDICE COMPOSTO no Firestore.
    // Coleção: `auth_users`
    // Campos do Índice:
    //   1. `pendingApproval` (Ascendente)
    //   2. `isApproved` (Ascendente)
    //   3. `createdAt` (Ascendente ou Descendente)
    // O Firestore geralmente fornecerá um link para criar este índice se ele estiver faltando.
    // Verifique os logs do servidor para este link se o erro "FAILED_PRECONDITION" ocorrer.
    // O link será específico para o seu projeto (ex: ecommerce-db-75f77).
    // =====================================================================================
    const snapshot = await adminFirestore // adminFirestore já está configurado para o projeto correto
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
            } else if (typeof data.createdAt === 'number') { 
                createdAtDate = new Date(data.createdAt);
            }
        }
        return {
            uid: doc.id, 
            email: data.email,
            name: data.name || 'N/A',
            isApproved: data.isApproved === true, 
            pendingApproval: data.pendingApproval === true, 
            isAdmin: data.isAdmin === true, 
            createdAt: createdAtDate,
        } as UserProfile;
    });
    console.log(`[Get Pending Users Action] Fetched ${users.length} pending users.`);
    return { message: 'Usuários pendentes carregados.', status: 'success', users };
  } catch (error) {
    console.error('[Get Pending Users Action] Error fetching pending users from Firestore:', error);
    const errorMessage = error instanceof Error ? error.message : "Erro desconhecido ao buscar usuários pendentes.";
    
    if (error instanceof Error && (error as any).code === 9 /* FAILED_PRECONDITION */) {
        const firebaseErrorDetails = (error as any).details || "Índice composto necessário. Verifique os logs do servidor para o link de criação do índice.";
        console.error(`[Get Pending Users Action] Firestore Index Required: ${firebaseErrorDetails}`);
        return { message: `Erro ao buscar usuários: Índice do Firestore necessário. Detalhes: ${firebaseErrorDetails.substring(0,300)}`, status: 'error' };
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

  console.log(`[Approve User Action] Admin verified. Approving user email: ${userEmailToApprove} in Firestore database ID "ecom"`);
  try {
    const userDocRef = adminFirestore.collection('auth_users').doc(userEmailToApprove.toLowerCase());
    await userDocRef.update({
      isApproved: true,
      pendingApproval: false,
      // You might want to add an 'approvedAt: Timestamp.now()' field here too
    });
    console.log(`[Approve User Action] User ${userEmailToApprove} approved successfully in Firestore.`);
    return { message: 'Usuário aprovado com sucesso!', status: 'success' };
  } catch (error) {
    console.error(`[Approve User Action] Error approving user ${userEmailToApprove} in Firestore:`, error);
    const errorMessage = error instanceof Error ? error.message : "Erro desconhecido ao aprovar usuário.";
    return { message: `Erro ao aprovar usuário no servidor: ${errorMessage.substring(0, 200)}`, status: 'error' };
  }
}

    