
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
  
  try {
    const decodedToken = await adminAuth.verifyIdToken(adminIdToken);
    // Ensure ADMIN_EMAIL is set in your .env for server-side checks
    if (decodedToken.email === process.env.ADMIN_EMAIL) {
      return true;
    }
    console.warn(`[Admin Verification] Failed: Email mismatch. Token email: ${decodedToken.email}, Expected admin: ${process.env.ADMIN_EMAIL}`);
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

  try {
    const snapshot = await adminFirestore
      .collection('users')
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
        if (data.createdAt && data.createdAt instanceof Timestamp) {
            createdAtDate = data.createdAt.toDate();
        } else if (data.createdAt) { 
            try { createdAtDate = new Date(data.createdAt); } catch(e) { /* ignore */}
        }

        return {
            uid: doc.id,
            name: data.name,
            email: data.email,
            isApproved: data.isApproved,
            pendingApproval: data.pendingApproval,
            createdAt: createdAtDate, 
        } as UserProfile;
    });
    return { message: 'Usuários pendentes carregados.', status: 'success', users };
  } catch (error) {
    console.error('[Get Pending Users Action] Error fetching pending users:', error);
    return { message: 'Erro ao buscar usuários pendentes no servidor.', status: 'error' };
  }
}

export async function approveUser(adminIdToken: string, userIdToApprove: string): Promise<AdminActionResult> {
  if (adminSDKInitializationError) {
    console.error(`[Approve User Action] Admin SDK not initialized: ${adminSDKInitializationError}`);
    return { message: `Erro Crítico no Servidor: Falha na configuração do Firebase Admin. (Detalhe: ${adminSDKInitializationError})`, status: 'error' };
  }
  if (!adminFirestore || !adminAuth) { // Also check adminAuth for verifyAdmin
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

  try {
    const userDocRef = adminFirestore.collection('users').doc(userIdToApprove);
    await userDocRef.update({
      isApproved: true,
      pendingApproval: false,
    });
    return { message: 'Usuário aprovado com sucesso!', status: 'success' };
  } catch (error) {
    console.error('[Approve User Action] Error approving user:', error);
    return { message: 'Erro ao aprovar usuário no servidor.', status: 'error' };
  }
}
