
'use server';

import { adminFirestore_DefaultDB, adminSDKInitializationError } from '@/lib/firebase/adminConfig';
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

// Function to verify if the caller is the admin based on email
async function verifyAdminByEmail(callerEmail: string | undefined): Promise<boolean> {
  const expectedAdminEmailFromServer = ADMIN_PRIMARY_EMAIL_SERVER; // Use server-side env var or fallback
  console.log(`[Admin Verification by Email] SERVER_ADMIN_EMAIL value being used: '${expectedAdminEmailFromServer}'`);

  if (!callerEmail) {
    console.warn('[Admin Verification by Email] Failed: No caller email provided.');
    return false;
  }
  if (!expectedAdminEmailFromServer) {
    console.warn('[Admin Verification by Email] Failed: ADMIN_EMAIL environment variable is not set on the server, or fallback is missing.');
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
            } else if (data.createdAt._seconds !== undefined) { // Handle case where it might be a plain object from Firestore
                createdAtVal = { seconds: data.createdAt._seconds, nanoseconds: data.createdAt._nanoseconds || 0 };
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
            createdAt: createdAtVal, // Keep as object for client to parse if needed
            photoURL: data.photoURL,
        } as UserProfile;
    });
    console.log(`[Get Pending Users Action] Fetched ${users.length} pending users from Firestore (Default DB).`);
    return { message: 'Usuários pendentes carregados.', status: 'success', users };
  } catch (error) {
    console.error('[Get Pending Users Action] Error fetching pending users from Firestore (Default DB):', error);
    const errorMessage = error instanceof Error ? error.message : "Erro desconhecido ao buscar usuários pendentes.";

    if (error instanceof Error && (error as any).code === 5 /* FAILED_PRECONDITION for Firestore, was 9 */) {
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


// New Admin Actions for User Management
export async function getAllUsers(adminUserEmail: string): Promise<AdminActionResult> {
  console.log(`[Get All Users Action] Request from admin: ${adminUserEmail}`);
  if (adminSDKInitializationError) return { message: `Erro Crítico no Servidor (Admin SDK): ${adminSDKInitializationError}`, status: 'error' };
  if (!adminFirestore_DefaultDB) return { message: "Erro Crítico no Servidor: Firestore Admin (Default DB) não disponível.", status: 'error' };
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
        uid: docSnap.id, // email
        email: data.email,
        name: data.name || data.email, // Fallback to email if name is not set
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
    console.error('[Get All Users Action] Error:', error);
    return { message: `Erro ao buscar todos os usuários: ${errorMessage.substring(0, 200)}`, status: 'error' };
  }
}

export async function updateUserByAdmin(
  adminUserEmail: string,
  targetUserEmail: string,
  updates: { name?: string; password?: string; isApproved?: boolean; isAdmin?: boolean }
): Promise<AdminActionResult> {
  console.log(`[Update User by Admin Action] Request from admin: ${adminUserEmail} for target: ${targetUserEmail}, Updates:`, JSON.stringify(updates).replace(/"password":"[^"]*"/, '"password":"***"'));
  if (adminSDKInitializationError) return { message: `Erro Crítico no Servidor (Admin SDK): ${adminSDKInitializationError}`, status: 'error' };
  if (!adminFirestore_DefaultDB) return { message: "Erro Crítico no Servidor: Firestore Admin (Default DB) não disponível.", status: 'error' };
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
         updateData.password = hashedPassword; // Store hashed password
      }
      // If password is an empty string, it means no change to password
    }
    if (updates.isApproved !== undefined) {
        updateData.isApproved = updates.isApproved;
        if (updates.isApproved) updateData.pendingApproval = false; // If approved, no longer pending
    }
    if (updates.isAdmin !== undefined) updateData.isAdmin = updates.isAdmin;


    if (Object.keys(updateData).length === 0) {
        return { message: "Nenhuma alteração fornecida.", status: "success" };
    }

    await userDocRef.update(updateData);
    return { message: 'Usuário atualizado com sucesso.', status: 'success' };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Erro desconhecido.";
    console.error('[Update User by Admin Action] Error:', error);
    return { message: `Erro ao atualizar usuário: ${errorMessage.substring(0, 200)}`, status: 'error' };
  }
}

export async function deleteUserByAdmin(adminUserEmail: string, targetUserEmail: string): Promise<AdminActionResult> {
  console.log(`[Delete User by Admin Action] Request from admin: ${adminUserEmail} for target: ${targetUserEmail}`);
  if (adminSDKInitializationError) return { message: `Erro Crítico no Servidor (Admin SDK): ${adminSDKInitializationError}`, status: 'error' };
  if (!adminFirestore_DefaultDB) return { message: "Erro Crítico no Servidor: Firestore Admin (Default DB) não disponível.", status: 'error' };
  if (!adminUserEmail || !targetUserEmail) return { message: "Emails do administrador e do usuário alvo são obrigatórios.", status: 'error' };

  const isAdmin = await verifyAdminByEmail(adminUserEmail);
  if (!isAdmin) return { message: 'Acesso não autorizado (verificação de email falhou).', status: 'error' };

  if (targetUserEmail.toLowerCase() === ADMIN_PRIMARY_EMAIL_SERVER.toLowerCase()) {
    return { message: 'Não é permitido excluir o administrador principal.', status: 'error' };
  }

  try {
    const userDocRef = adminFirestore_DefaultDB.collection('auth_users').doc(targetUserEmail.toLowerCase());
    await userDocRef.delete();
    // Note: This only deletes from Firestore. If using Firebase Auth, user still exists there.
    // For custom auth, this is sufficient to "ban" them if login checks Firestore.
    return { message: 'Usuário excluído com sucesso do Firestore.', status: 'success' };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Erro desconhecido.";
    console.error('[Delete User by Admin Action] Error:', error);
    return { message: `Erro ao excluir usuário: ${errorMessage.substring(0, 200)}`, status: 'error' };
  }
}
