
'use server';

import { adminFirestore_DefaultDB, adminSDKInitializationError, adminAuth } from '@/lib/firebase/adminConfig';
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
  console.log(`[Update User Profile Action - PRE-CHECK V35] adminSDKInitializationError: ${adminSDKInitializationError}`);
  if (adminSDKInitializationError) {
    console.error('[Update User Profile Action - CRITICAL_FAILURE] Aborting due to Admin SDK init error:', adminSDKInitializationError, '(REF: SDK_INIT_FAIL_UUP_V35)');
    return { message: `Erro Crítico no Servidor (Admin SDK): ${adminSDKInitializationError.substring(0,100)} (REF: SDK_INIT_FAIL_UUP_V35)`, status: 'error' };
  }
  console.log(`[Update User Profile Action - PRE-CHECK V35] adminFirestore_DefaultDB is null: ${adminFirestore_DefaultDB === null}`);
  if (!adminFirestore_DefaultDB) {
    console.error("[Update User Profile Action - CRITICAL_FAILURE] adminFirestore_DefaultDB is null. (REF: FS_INSTANCE_NULL_UUP_V35)");
    return { message: "Erro Crítico no Servidor: Acesso ao banco de dados não está disponível. (REF: FS_INSTANCE_NULL_UUP_V35)", status: 'error' };
  }
  console.log(`[Update User Profile Action - PRE-CHECK V35] adminAuth is null: ${adminAuth === null}`);
  if (!adminAuth) { 
    console.error('[Update User Profile Action - CRITICAL_FAILURE] adminAuth is null. (REF: AUTH_SVC_NULL_UUP_V35)');
    return { message: 'Erro crítico na configuração do servidor: Serviço de autenticação não disponível. (REF: AUTH_SVC_NULL_UUP_V35)', status: 'error' };
  }
  if (adminFirestore_DefaultDB) {
    console.log('[Update User Profile Action - PRE-CHECK V35] adminFirestore_DefaultDB.app.options.projectId:', adminFirestore_DefaultDB?.app?.options?.projectId);
  }

  if (!currentUserEmail) {
    console.error("[Update User Profile Action V35] Failing because currentUserEmail was not provided.");
    return { message: "Email do usuário não fornecido para a ação.", status: "error" };
  }
  if (!updates || (updates.name === undefined && updates.photoURL === undefined)) {
    return { message: "Nenhuma atualização fornecida.", status: "error" };
  }

  try {
    const userDocRef = adminFirestore_DefaultDB.collection('auth_users').doc(currentUserEmail.toLowerCase());
    const userDocSnap = await userDocRef.get();

    if (!userDocSnap.exists) {
      console.error(`[Update User Profile Action V35] User document not found for email: ${currentUserEmail}`);
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
    console.log(`[Update User Profile Action V35] Profile updated successfully for: ${currentUserEmail}`);

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
    console.error(`[Update User Profile Action V35] Error updating profile for ${currentUserEmail}:`, error);
    return { message: `Erro ao atualizar perfil: ${errorMessage.substring(0, 200)}`, status: 'error' };
  }
}

    