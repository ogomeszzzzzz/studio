
'use server';

import { getAdminAuthInstance, getAdminFirestoreInstance, getAdminSDKInitializationError } from '@/lib/firebase/adminConfig';
import type { UserProfile } from '@/types';
import { Timestamp } from 'firebase-admin/firestore'; // Explicitly import Timestamp from admin SDK

interface UserActionResult {
  message: string;
  status: 'success' | 'error';
  user?: UserProfile;
}

const LOG_VERSION_TAG_ACTION = "V41"; 

export async function updateUserProfile(
  currentUserEmail: string,
  updates: { name?: string; photoURL?: string }
): Promise<UserActionResult> {
  const initialErrorMsg = await getAdminSDKInitializationError();
  const adminAuth = await getAdminAuthInstance();
  const adminFirestore_DefaultDB = await getAdminFirestoreInstance();

  console.log(`[Update User Profile Action ${LOG_VERSION_TAG_ACTION} - PRE-CHECK] Initial SDK Error: ${initialErrorMsg}`);
  console.log(`[Update User Profile Action ${LOG_VERSION_TAG_ACTION} - PRE-CHECK] adminAuth is null: ${adminAuth === null}`);
  console.log(`[Update User Profile Action ${LOG_VERSION_TAG_ACTION} - PRE-CHECK] adminFirestore_DefaultDB is null: ${adminFirestore_DefaultDB === null}`);

  if (initialErrorMsg || !adminAuth || !adminFirestore_DefaultDB) {
    const errorDetail = initialErrorMsg || "Serviços Admin (Auth ou Firestore) não disponíveis.";
    const finalMessage = `Erro Crítico de Inicialização do Servidor (Admin SDK): ${errorDetail}. Verifique os logs ${LOG_VERSION_TAG_ACTION} do servidor. (REF: SDK_INIT_FAIL_IN_ACTION_UUP_${LOG_VERSION_TAG_ACTION})`;
    console.error(`[Update User Profile Action ${LOG_VERSION_TAG_ACTION} - CRITICAL_FAILURE] ${finalMessage}`);
    return { message: finalMessage, status: 'error' };
  }
  
  if (!currentUserEmail) {
    console.error(`[Update User Profile Action ${LOG_VERSION_TAG_ACTION}] Failing because currentUserEmail was not provided.`);
    return { message: "Email do usuário não fornecido para a ação.", status: "error" };
  }
  if (!updates || (updates.name === undefined && updates.photoURL === undefined)) {
    return { message: "Nenhuma atualização fornecida.", status: "error" };
  }

  if (!adminFirestore_DefaultDB.app || !adminFirestore_DefaultDB.app.options || adminFirestore_DefaultDB.app.options.projectId !== "ecommerce-db-75f77") {
    console.error(`[Update User Profile Action ${LOG_VERSION_TAG_ACTION} - CRITICAL FAILURE AT FS CHECK] Firestore instance is invalid or for wrong project.`);
    return { message: `Erro crítico: Configuração do banco de dados inválida no servidor (Update). (REF: FS_INTEGRITY_FAIL_UUP_${LOG_VERSION_TAG_ACTION})`, status: 'error' };
  }

  try {
    const userDocRef = adminFirestore_DefaultDB.collection('auth_users').doc(currentUserEmail.toLowerCase());
    const userDocSnap = await userDocRef.get();

    if (!userDocSnap.exists) {
      console.error(`[Update User Profile Action ${LOG_VERSION_TAG_ACTION}] User document not found for email: ${currentUserEmail}`);
      return { message: "Usuário não encontrado.", status: "error" };
    }

    const updateData: Partial<UserProfile> = {};
    if (updates.name !== undefined) {
      updateData.name = updates.name;
    }
    if (updates.photoURL !== undefined) {
      updateData.photoURL = updates.photoURL;
    }

    await userDocRef.update(updateData);
    console.log(`[Update User Profile Action ${LOG_VERSION_TAG_ACTION}] Profile updated successfully for: ${currentUserEmail}`);

    const updatedUserDocSnap = await userDocRef.get(); // Re-fetch to get the latest data including any server-side transformations
    const updatedUserData = updatedUserDocSnap.data();

    if (!updatedUserData) { // Should not happen if update was successful and doc exists
        return { message: "Perfil atualizado, mas não foi possível buscar os dados atualizados.", status: "error" };
    }
    
    const userProfileToReturn: UserProfile = {
        uid: updatedUserDocSnap.id,
        email: updatedUserData.email,
        name: updatedUserData.name,
        isApproved: updatedUserData.isApproved,
        pendingApproval: updatedUserData.pendingApproval,
        isAdmin: updatedUserData.isAdmin,
        createdAt: updatedUserData.createdAt instanceof Timestamp ? updatedUserData.createdAt.toDate() : new Date(), // Ensure it's a Date object
        photoURL: updatedUserData.photoURL,
      };


    return { message: 'Perfil atualizado com sucesso!', status: 'success', user: userProfileToReturn };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Erro desconhecido ao atualizar perfil.";
    console.error(`[Update User Profile Action ${LOG_VERSION_TAG_ACTION}] Error updating profile for ${currentUserEmail}:`, error);
    return { message: `Erro ao atualizar perfil: ${errorMessage.substring(0, 200)}`, status: 'error' };
  }
}
