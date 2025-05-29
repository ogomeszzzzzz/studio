
'use server';

import { adminAuth, adminFirestore } from '@/lib/firebase/adminConfig';
import type { UserProfile } from '@/types';
import { Timestamp } from 'firebase-admin/firestore';

interface AdminActionResult {
  message: string;
  status: 'success' | 'error';
  users?: UserProfile[];
}

async function verifyAdmin(adminIdToken: string | null | undefined): Promise<boolean> {
  if (!adminIdToken) {
    console.warn('Admin verification failed: No ID token provided.');
    return false;
  }
  if (!adminAuth) {
    console.error('Admin verification failed: Firebase Admin Auth SDK not initialized.');
    return false;
  }
  try {
    const decodedToken = await adminAuth.verifyIdToken(adminIdToken);
    if (decodedToken.email === process.env.ADMIN_EMAIL) {
      return true;
    }
    console.warn(`Admin verification failed: Email mismatch. Token email: ${decodedToken.email}, Expected admin: ${process.env.ADMIN_EMAIL}`);
    return false;
  } catch (error) {
    console.error('Admin verification failed: Error verifying ID token:', error);
    return false;
  }
}

export async function getPendingUsers(adminIdToken: string): Promise<AdminActionResult> {
  if (!await verifyAdmin(adminIdToken)) {
    return { message: 'Acesso não autorizado.', status: 'error' };
  }

  if (!adminFirestore) {
    console.error('Firebase Admin Firestore SDK não inicializado.');
    return { message: 'Erro no servidor. Tente novamente mais tarde. (Admin SDK Firestore)', status: 'error' };
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
        // Convert Firestore Timestamp to a serializable format (e.g., ISO string or Date object if handled by client)
        // For simplicity, we'll let client handle Date object if it's Timestamp, or pass as is.
        // Or explicitly convert:
        let createdAtDate : Date | undefined = undefined;
        if (data.createdAt && data.createdAt instanceof Timestamp) {
            createdAtDate = data.createdAt.toDate();
        } else if (data.createdAt) { // if it's already some other date format
            try { createdAtDate = new Date(data.createdAt); } catch(e) { /* ignore */}
        }

        return {
            uid: doc.id,
            name: data.name,
            email: data.email,
            isApproved: data.isApproved,
            pendingApproval: data.pendingApproval,
            createdAt: createdAtDate, // Send as Date object
        } as UserProfile;
    });
    return { message: 'Usuários pendentes carregados.', status: 'success', users };
  } catch (error) {
    console.error('Error fetching pending users:', error);
    return { message: 'Erro ao buscar usuários pendentes.', status: 'error' };
  }
}

export async function approveUser(adminIdToken: string, userIdToApprove: string): Promise<AdminActionResult> {
  if (!await verifyAdmin(adminIdToken)) {
    return { message: 'Acesso não autorizado.', status: 'error' };
  }
  
  if (!adminFirestore) {
    console.error('Firebase Admin Firestore SDK não inicializado.');
    return { message: 'Erro no servidor. Tente novamente mais tarde. (Admin SDK Firestore)', status: 'error' };
  }

  if (!userIdToApprove) {
    return { message: 'ID do usuário para aprovação é obrigatório.', status: 'error' };
  }

  try {
    const userDocRef = adminFirestore.collection('users').doc(userIdToApprove);
    await userDocRef.update({
      isApproved: true,
      pendingApproval: false,
      // Optionally: approvedAt: Timestamp.now(), approvedBy: adminUid (from decodedToken)
    });
    // Optionally, set a custom claim on Firebase Auth user
    // if (adminAuth) {
    //   await adminAuth.setCustomUserClaims(userIdToApprove, { approved: true });
    // }
    return { message: 'Usuário aprovado com sucesso!', status: 'success' };
  } catch (error) {
    console.error('Error approving user:', error);
    return { message: 'Erro ao aprovar usuário.', status: 'error' };
  }
}
