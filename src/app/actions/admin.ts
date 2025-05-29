
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
// The server action itself should ensure it's being called by an authenticated admin.
async function verifyAdminByEmail(callerEmail: string | undefined): Promise<boolean> {
  console.log('[Admin Verification by Email] Starting verification...');
  console.log(`[Admin Verification by Email] Expected ADMIN_EMAIL from server env: '${ADMIN_PRIMARY_EMAIL_SERVER}'`);
  if (!callerEmail) {
    console.warn('[Admin Verification by Email] Failed: No caller email provided.');
    return false;
  }
  if (callerEmail.toLowerCase() === ADMIN_PRIMARY_EMAIL_SERVER.toLowerCase()) {
    console.log(`[Admin Verification by Email] Success: Caller email '${callerEmail}' matches admin.`);
    return true;
  }
  console.warn(`[Admin Verification by Email] Failed: Caller email '${callerEmail}' does NOT match admin. Expected: '${ADMIN_PRIMARY_EMAIL_SERVER}', Got: '${callerEmail}'.`);
  return false;
}


export async function getPendingUsers(adminUserEmail: string): Promise<AdminActionResult> {
  console.log(`[Get Pending Users Action] Received request from admin: ${adminUserEmail}`);
  if (adminSDKInitializationError) {
    return { message: `Erro Crítico no Servidor (Admin SDK): ${adminSDKInitializationError}`, status: 'error' };
  }
  if (!adminFirestore) {
    return { message: "Erro Crítico no Servidor: Firestore Admin não está disponível.", status: 'error' };
  }

  const isAdmin = await verifyAdminByEmail(adminUserEmail);
  if (!isAdmin) {
    return { message: 'Acesso não autorizado para buscar usuários pendentes (verificação de email falhou).', status: 'error' };
  }

  console.log('[Get Pending Users Action] Admin verified. Fetching pending users...');
  try {
    const snapshot = await adminFirestore
      .collection('auth_users')
      .where('pendingApproval', '==', true)
      .where('isApproved', '==', false) // Ensure we only get users not yet approved
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
            isApproved: data.isApproved,
            pendingApproval: data.pendingApproval,
            isAdmin: data.isAdmin || false,
            createdAt: createdAtDate,
        } as UserProfile;
    });
    console.log(`[Get Pending Users Action] Fetched ${users.length} pending users.`);
    return { message: 'Usuários pendentes carregados.', status: 'success', users };
  } catch (error) {
    console.error('[Get Pending Users Action] Error fetching pending users from Firestore:', error);
    return { message: `Erro ao buscar usuários pendentes no servidor: ${(error as Error).message}`, status: 'error' };
  }
}

export async function approveUserInFirestore(adminUserEmail: string, userEmailToApprove: string): Promise<AdminActionResult> {
  console.log(`[Approve User Action] Received request from admin '${adminUserEmail}' to approve user email: ${userEmailToApprove}`);
  if (adminSDKInitializationError) {
     return { message: `Erro Crítico no Servidor (Admin SDK): ${adminSDKInitializationError}`, status: 'error' };
  }
  if (!adminFirestore) {
    return { message: "Erro Crítico no Servidor: Firestore Admin não está disponível.", status: 'error' };
  }

  const isAdmin = await verifyAdminByEmail(adminUserEmail);
  if (!isAdmin) {
    return { message: 'Acesso não autorizado para aprovar usuário (verificação de email falhou).', status: 'error' };
  }

  if (!userEmailToApprove) {
    return { message: 'Email do usuário para aprovação é obrigatório.', status: 'error' };
  }

  console.log(`[Approve User Action] Admin verified. Approving user email: ${userEmailToApprove}`);
  try {
    // The document ID in 'auth_users' is the user's email in lowercase.
    const userDocRef = adminFirestore.collection('auth_users').doc(userEmailToApprove.toLowerCase());
    await userDocRef.update({
      isApproved: true,
      pendingApproval: false,
    });
    console.log(`[Approve User Action] User ${userEmailToApprove} approved successfully in Firestore.`);
    return { message: 'Usuário aprovado com sucesso!', status: 'success' };
  } catch (error) {
    console.error(`[Approve User Action] Error approving user ${userEmailToApprove} in Firestore:`, error);
    return { message: `Erro ao aprovar usuário no servidor: ${(error as Error).message}`, status: 'error' };
  }
}
