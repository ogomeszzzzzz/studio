
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

// This function is NOT for Firebase Auth tokens anymore.
// It's a simple check if the provided email matches the admin email.
// In a real system, the server action would need a secure way to verify the *caller* is admin.
// For this prototype, we'll assume the client-side check (is user admin?) is sufficient
// and the server action is just a gate for admin-specific Firestore operations.
// A proper way would be to pass a session token that the server action can validate.
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
  console.warn(`[Admin Verification by Email] Failed: Caller email '${callerEmail}' does NOT match admin.`);
  return false;
}


export async function getPendingUsers(adminUserEmail: string): Promise<AdminActionResult> {
  console.log('[Get Pending Users Action] Received request.');
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
      .where('isApproved', '==', false)
      .orderBy('createdAt', 'asc')
      .get();

    if (snapshot.empty) {
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
    return { message: 'Usuários pendentes carregados.', status: 'success', users };
  } catch (error) {
    console.error('[Get Pending Users Action] Error fetching pending users from Firestore:', error);
    return { message: 'Erro ao buscar usuários pendentes no servidor.', status: 'error' };
  }
}

export async function approveUserInFirestore(adminUserEmail: string, userEmailToApprove: string): Promise<AdminActionResult> {
  console.log(`[Approve User Action] Received request to approve user email: ${userEmailToApprove}`);
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
    const userDocRef = adminFirestore.collection('auth_users').doc(userEmailToApprove.toLowerCase());
    await userDocRef.update({
      isApproved: true,
      pendingApproval: false,
    });
    console.log(`[Approve User Action] User ${userEmailToApprove} approved successfully.`);
    return { message: 'Usuário aprovado com sucesso!', status: 'success' };
  } catch (error) {
    console.error(`[Approve User Action] Error approving user ${userEmailToApprove} in Firestore:`, error);
    return { message: 'Erro ao aprovar usuário no servidor.', status: 'error' };
  }
}
