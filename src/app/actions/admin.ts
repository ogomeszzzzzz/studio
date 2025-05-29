
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
  
  const expectedAdminEmail = process.env.ADMIN_EMAIL;
  if (!expectedAdminEmail) {
    console.error('[Admin Verification] Failed: ADMIN_EMAIL environment variable is not set on the server.');
    return false;
  }

  try {
    const decodedToken = await adminAuth.verifyIdToken(adminIdToken);
    if (decodedToken.email === expectedAdminEmail) {
      console.log(`[Admin Verification] Success: Token email ${decodedToken.email} matches expected admin ${expectedAdminEmail}.`);
      return true;
    }
    console.warn(`[Admin Verification] Failed: Email mismatch. Token email: ${decodedToken.email}, Expected admin: ${expectedAdminEmail}`);
    return false;
  } catch (error) {
    console.error('[Admin Verification] Failed: Error verifying ID token:', error);
    return false;
  }
}

export async function getPendingUsers(adminIdToken: string): Promise<AdminActionResult> {
  if (adminSDKInitializationError) {
    console.error(`[Get Pending Users Action] Admin SDK not initialized: ${adminSDKInitializationError}`);
    return { message: `Erro Crítico no Servidor: Falha na configuração do Firebase Admin. (Detalhe: ${adminSDKInitializationError})`, status: 'error' };
  }
  if (!adminFirestore) {
    const errorDetail = adminSDKInitializationError || "adminFirestore is null post-initialization check.";
    console.error(`[Get Pending Users Action] Firebase Admin Firestore SDK not available: ${errorDetail}`);
    return { message: `Erro Crítico no Servidor: Firestore Admin não está pronto. (Detalhe: ${errorDetail})`, status: 'error' };
  }

  if (!await verifyAdmin(adminIdToken)) {
    return { message: 'Acesso não autorizado para buscar usuários pendentes.', status: 'error' };
  }

  console.log('[Get Pending Users Action] Admin verified. Fetching pending users...');
  try {
    const snapshot = await adminFirestore
      .collection('users')
      .where('pendingApproval', '==', true)
      .where('isApproved', '==', false) // Explicitly check for isApproved: false
      .orderBy('createdAt', 'asc')
      .get();

    if (snapshot.empty) {
      console.log('[Get Pending Users Action] No users found pending approval.');
      return { message: 'Nenhum usuário pendente de aprovação.', status: 'success', users: [] };
    }

    const users: UserProfile[] = snapshot.docs.map(doc => {
        const data = doc.data();
        let createdAtDate : Date | undefined = undefined;
        if (data.createdAt && data.createdAt instanceof Timestamp) {
            createdAtDate = data.createdAt.toDate();
        } else if (data.createdAt) { 
            try { 
              // Handle potential string or number timestamps from older data if necessary
              const tsSeconds = (data.createdAt as any).seconds || (typeof data.createdAt === 'number' ? data.createdAt / 1000 : null);
              if (tsSeconds) {
                createdAtDate = new Date(tsSeconds * 1000);
              } else if (typeof data.createdAt === 'string' && !isNaN(new Date(data.createdAt).getTime())) {
                createdAtDate = new Date(data.createdAt);
              }
            } catch(e) { console.warn("Error parsing createdAt from Firestore data:", data.createdAt, e)}
        }

        return {
            uid: doc.id,
            name: data.name || 'N/A', // Fallback for name
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
  if (adminSDKInitializationError) {
    console.error(`[Approve User Action] Admin SDK not initialized: ${adminSDKInitializationError}`);
    return { message: `Erro Crítico no Servidor: Falha na configuração do Firebase Admin. (Detalhe: ${adminSDKInitializationError})`, status: 'error' };
  }
  if (!adminFirestore || !adminAuth) { 
    const errorDetail = adminSDKInitializationError || "adminFirestore or adminAuth is null post-initialization check.";
    console.error(`[Approve User Action] Firebase Admin SDK components not available: ${errorDetail}`);
    return { message: `Erro Crítico no Servidor: Componentes do Firebase Admin não estão prontos. (Detalhe: ${errorDetail})`, status: 'error' };
  }

  if (!await verifyAdmin(adminIdToken)) {
    return { message: 'Acesso não autorizado para aprovar usuário.', status: 'error' };
  }
  
  if (!userIdToApprove) {
    return { message: 'ID do usuário para aprovação é obrigatório.', status: 'error' };
  }

  console.log(`[Approve User Action] Admin verified. Approving user ID: ${userIdToApprove}`);
  try {
    const userDocRef = adminFirestore.collection('users').doc(userIdToApprove);
    await userDocRef.update({
      isApproved: true,
      pendingApproval: false, // Explicitly set pendingApproval to false
    });
    console.log(`[Approve User Action] User ${userIdToApprove} approved successfully.`);
    return { message: 'Usuário aprovado com sucesso!', status: 'success' };
  } catch (error) {
    console.error(`[Approve User Action] Error approving user ${userIdToApprove} in Firestore:`, error);
    return { message: 'Erro ao aprovar usuário no servidor.', status: 'error' };
  }
}
