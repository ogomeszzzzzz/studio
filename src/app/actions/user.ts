
'use server';

import { adminFirestore_DefaultDB, adminSDKInitializationError } from '@/lib/firebase/adminConfig';
import type { UserProfile } from '@/types';

interface UserActionResult {
  message: string;
  status: 'success' | 'error';
  user?: UserProfile;
}

export async function updateUserProfile(
  currentUserEmail: string,
  updates: { name?: string; photoURL?: string }
): Promise<UserActionResult> {
  console.log(`[Update User Profile Action] Request for user: ${currentUserEmail}, Updates:`, updates);

  if (adminSDKInitializationError) {
    console.error(`[Update User Profile Action] Failing due to Admin SDK init error: ${adminSDKInitializationError}`);
    return { message: `Erro Crítico no Servidor (Admin SDK): ${adminSDKInitializationError}`, status: 'error' };
  }
  if (!adminFirestore_DefaultDB) {
    console.error("[Update User Profile Action] Failing because Firestore Admin (Default DB) is not available.");
    return { message: "Erro Crítico no Servidor: Firestore Admin (Default DB) não está disponível.", status: 'error' };
  }
  if (!currentUserEmail) {
    console.error("[Update User Profile Action] Failing because currentUserEmail was not provided.");
    return { message: "Email do usuário não fornecido para a ação.", status: "error" };
  }
  if (!updates || (updates.name === undefined && updates.photoURL === undefined)) {
    return { message: "Nenhuma atualização fornecida.", status: "error" };
  }

  try {
    const userDocRef = adminFirestore_DefaultDB.collection('auth_users').doc(currentUserEmail.toLowerCase());
    const userDocSnap = await userDocRef.get();

    if (!userDocSnap.exists) {
      console.error(`[Update User Profile Action] User document not found for email: ${currentUserEmail}`);
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
    console.log(`[Update User Profile Action] Profile updated successfully for: ${currentUserEmail}`);

    // Fetch the updated user data to return
    const updatedUserDocSnap = await userDocRef.get();
    const updatedUserData = updatedUserDocSnap.data();

    if (!updatedUserData) {
        return { message: "Perfil atualizado, mas não foi possível buscar os dados atualizados.", status: "error" };
    }
    
    const userProfileToReturn: UserProfile = {
        uid: updatedUserDocSnap.id,
        email: updatedUserData.email,
        name: updatedUserData.name,
        isApproved: updatedUserData.isApproved,
        pendingApproval: updatedUserData.pendingApproval,
        isAdmin: updatedUserData.isAdmin,
        createdAt: updatedUserData.createdAt ? (updatedUserData.createdAt as any).toDate() : new Date(),
        photoURL: updatedUserData.photoURL,
      };


    return { message: 'Perfil atualizado com sucesso!', status: 'success', user: userProfileToReturn };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Erro desconhecido ao atualizar perfil.";
    console.error(`[Update User Profile Action] Error updating profile for ${currentUserEmail}:`, error);
    return { message: `Erro ao atualizar perfil: ${errorMessage.substring(0, 200)}`, status: 'error' };
  }
}
