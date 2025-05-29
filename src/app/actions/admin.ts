
'use server';

import { adminAuth, adminFirestore, adminSDKInitializationError } from '@/lib/firebase/adminConfig';
import type { UserProfile } from '@/types';
import { Timestamp } from 'firebase-admin/firestore';

interface AdminActionResult {
  message: string;
  status: 'success' | 'error';
  users?: UserProfile[];
}

async function verifyAdmin(adminIdToken: string | null | undefined): Promise<boolean> {
  console.log('[Admin Verification] Starting verification process...');
  const expectedAdminEmailFromServer = process.env.ADMIN_EMAIL;
  // Log the value of ADMIN_EMAIL as seen by the server environment
  console.log(`[Admin Verification] Expected ADMIN_EMAIL from server env: '${expectedAdminEmailFromServer}' (Type: ${typeof expectedAdminEmailFromServer})`);

  if (adminSDKInitializationError) {
    console.warn(`[Admin Verification] Cannot verify admin, Admin SDK not initialized: ${adminSDKInitializationError}`);
    return false;
  }
  if (!adminAuth) {
     console.warn('[Admin Verification] Cannot verify admin, adminAuth is null.');
     return false;
  }

  if (!adminIdToken) {
    console.warn('[Admin Verification] Failed: No ID token provided.');
    return false;
  }

  if (!expectedAdminEmailFromServer) {
    console.error('[Admin Verification] Failed: ADMIN_EMAIL environment variable is NOT SET or is empty on the server. This is a critical configuration issue. Please ensure it is set in your .env file and the server is restarted.');
    return false;
  }

  try {
    console.log('[Admin Verification] Attempting to verify ID token...');
    const decodedToken = await adminAuth.verifyIdToken(adminIdToken);
    console.log(`[Admin Verification] ID Token decoded. Email from token: ${decodedToken.email}`);

    if (decodedToken.email?.toLowerCase() === expectedAdminEmailFromServer.toLowerCase()) {
      console.log(`[Admin Verification] Success: Token email '${decodedToken.email}' matches expected admin '${expectedAdminEmailFromServer}'. User is admin.`);
      return true;
    }
    console.warn(`[Admin Verification] Failed: Email mismatch. Token email: '${decodedToken.email}', Expected admin: '${expectedAdminEmailFromServer}'. User is NOT admin.`);
    return false;
  } catch (error) {
    console.error('[Admin Verification] Failed: Error verifying ID token:', error);
    return false;
  }
}

export async function getPendingUsers(adminIdToken: string): Promise<AdminActionResult> {
  console.log('[Get Pending Users Action] Received request.');
  if (!adminIdToken) {
    console.warn('[Get Pending Users Action] Admin ID token is missing or empty in the request.');
    return { message: 'Token de administrador ausente. Ação não permitida.', status: 'error' };
  }

  if (adminSDKInitializationError) {
    console.error(`[Get Pending Users Action] Admin SDK not initialized: ${adminSDKInitializationError}`);
    return { message: `Erro Crítico no Servidor: Falha na configuração do Firebase Admin. (Detalhe: ${adminSDKInitializationError})`, status: 'error' };
  }
  if (!adminFirestore || !adminAuth) {
    const errorDetail = adminSDKInitializationError || "adminFirestore or adminAuth is null post-initialization check.";
    console.error(`[Get Pending Users Action] Firebase Admin SDK components not available: ${errorDetail}`);
    return { message: `Erro Crítico no Servidor: Componentes do Firebase Admin não estão prontos. (Detalhe: ${errorDetail})`, status: 'error' };
  }

  const isAdmin = await verifyAdmin(adminIdToken);
  if (!isAdmin) {
    console.warn('[Get Pending Users Action] Admin verification failed. Returning unauthorized.');
    return { message: 'Acesso não autorizado para buscar usuários pendentes.', status: 'error' };
  }

  console.log('[Get Pending Users Action] Admin verified. Fetching pending users...');
  try {
    const snapshot = await adminFirestore
      .collection('users')
      .where('pendingApproval', '==', true)
      .where('isApproved', '==', false)
      .orderBy('createdAt', 'asc')
      .get();

    if (snapshot.empty) {
      console.log('[Get Pending Users Action] No users found pending approval.');
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
            name: data.name || 'N/A',
            email: data.email,
            isApproved: data.isApproved,
            pendingApproval: data.pendingApproval,
            createdAt: createdAtDate,
        } as UserProfile;
    });
    console.log(`[Get Pending Users Action] Found ${users.length} pending users.`);
    return { message: 'Usuários pendentes carregados.', status: 'success', users };
  } catch (error) {
    console.error('[Get Pending Users Action] Error fetching pending users from Firestore:', error);
    return { message: 'Erro ao buscar usuários pendentes no servidor.', status: 'error' };
  }
}

export async function approveUser(adminIdToken: string, userIdToApprove: string): Promise<AdminActionResult> {
  console.log(`[Approve User Action] Received request to approve user ID: ${userIdToApprove}`);
   if (!adminIdToken) {
    console.warn('[Approve User Action] Admin ID token is missing or empty in the request.');
    return { message: 'Token de administrador ausente. Ação não permitida.', status: 'error' };
  }

  if (adminSDKInitializationError) {
    console.error(`[Approve User Action] Admin SDK not initialized: ${adminSDKInitializationError}`);
    return { message: `Erro Crítico no Servidor: Falha na configuração do Firebase Admin. (Detalhe: ${adminSDKInitializationError})`, status: 'error' };
  }
  if (!adminFirestore || !adminAuth) {
    const errorDetail = adminSDKInitializationError || "adminFirestore or adminAuth is null post-initialization check.";
    console.error(`[Approve User Action] Firebase Admin SDK components not available: ${errorDetail}`);
    return { message: `Erro Crítico no Servidor: Componentes do Firebase Admin não estão prontos. (Detalhe: ${errorDetail})`, status: 'error' };
  }

  const isAdmin = await verifyAdmin(adminIdToken);
  if (!isAdmin) {
    console.warn('[Approve User Action] Admin verification failed. Returning unauthorized.');
    return { message: 'Acesso não autorizado para aprovar usuário.', status: 'error' };
  }

  if (!userIdToApprove) {
    console.warn('[Approve User Action] User ID to approve is missing.');
    return { message: 'ID do usuário para aprovação é obrigatório.', status: 'error' };
  }

  console.log(`[Approve User Action] Admin verified. Approving user ID: ${userIdToApprove}`);
  try {
    const userDocRef = adminFirestore.collection('users').doc(userIdToApprove);
    await userDocRef.update({
      isApproved: true,
      pendingApproval: false,
    });
    console.log(`[Approve User Action] User ${userIdToApprove} approved successfully.`);
    return { message: 'Usuário aprovado com sucesso!', status: 'success' };
  } catch (error) {
    console.error(`[Approve User Action] Error approving user ${userIdToApprove} in Firestore:`, error);
    return { message: 'Erro ao aprovar usuário no servidor.', status: 'error' };
  }
}
