
'use server';

import { adminFirestore_DefaultDB, adminSDKInitializationError as adminSDKAuthError } from '@/lib/firebase/adminConfig';
import { Timestamp } from 'firebase-admin/firestore';
import type { UserProfile } from '@/types';
import bcrypt from 'bcrypt';

interface ActionResult {
  message: string;
  status: 'success' | 'error' | 'pending';
  user?: UserProfile;
}

const ADMIN_PRIMARY_EMAIL = process.env.ADMIN_EMAIL || "gustavo.cordeiro@altenburg.com.br";
const SALT_ROUNDS = 10;

export async function registerUserInFirestore(prevState: any, formData: FormData): Promise<ActionResult> {
  if (adminSDKAuthError) {
    return { message: `Erro Crítico no Servidor (Admin SDK): ${adminSDKAuthError}`, status: 'error' };
  }
  if (!adminFirestore_DefaultDB) {
    return { message: "Erro Crítico no Servidor: Conexão com Firestore (Default DB) para usuários não está disponível.", status: 'error' };
  }

  const name = formData.get('name') as string;
  const email = formData.get('email') as string;
  const password = formData.get('password') as string;

  if (!name || !email || !password) {
    return { message: 'Nome, email e senha são obrigatórios.', status: 'error' };
  }
  if (password.length < 6) {
    return { message: 'A senha deve ter pelo menos 6 caracteres.', status: 'error' };
  }

  try {
    const userDocRef = adminFirestore_DefaultDB.collection('auth_users').doc(email.toLowerCase());
    const userDoc = await userDocRef.get();

    if (userDoc.exists) {
      return { message: 'Este email já está registrado.', status: 'error' };
    }

    const salt = await bcrypt.genSalt(SALT_ROUNDS);
    const hashedPassword = await bcrypt.hash(password, salt);

    const isAdminUser = email.toLowerCase() === ADMIN_PRIMARY_EMAIL.toLowerCase();
    const newUserProfile: Omit<UserProfile, 'uid'> & { password?: string; createdAt: Timestamp } = {
      email: email.toLowerCase(),
      name,
      password: hashedPassword, // Store hashed password
      isApproved: isAdminUser,
      pendingApproval: !isAdminUser,
      isAdmin: isAdminUser,
      createdAt: Timestamp.now(),
    };

    await userDocRef.set(newUserProfile);

    return {
      message: isAdminUser
        ? 'Conta de administrador registrada e aprovada automaticamente!'
        : 'Registro realizado com sucesso! Sua conta está pendente de aprovação pelo administrador.',
      status: 'success'
    };
  } catch (error: any) {
    console.error('[Register User Firestore Action] Error:', error);
    return { message: `Ocorreu um erro ao registrar: ${error.message || 'Erro desconhecido'}.`, status: 'error' };
  }
}

export async function loginUserWithFirestore(prevState: any, formData: FormData): Promise<ActionResult> {
  console.log('[Login User Firestore Action] Attempting login...');
  if (adminSDKAuthError) {
    console.error('[Login User Firestore Action] Admin SDK Error:', adminSDKAuthError);
    return { message: `Erro Crítico no Servidor (Admin SDK): ${adminSDKAuthError}`, status: 'error' };
  }
  if (!adminFirestore_DefaultDB) {
     console.error('[Login User Firestore Action] Firestore Default DB not available.');
     return { message: "Erro Crítico no Servidor: Conexão com Firestore (Default DB) para usuários não está disponível.", status: 'error' };
  }

  const email = formData.get('email') as string;
  const rawSubmittedPassword = formData.get('password') as string;
  
  console.log(`[Login User Firestore Action] Email submitted: '${email}'`);
  console.log(`[Login User Firestore Action] Raw submitted password type: ${typeof rawSubmittedPassword}, length: ${rawSubmittedPassword?.length}`);

  if (!email || !rawSubmittedPassword) {
    console.warn('[Login User Firestore Action] Email or password not provided.');
    return { message: 'Email e senha são obrigatórios.', status: 'error' };
  }

  const submittedPasswordTrimmed = rawSubmittedPassword.trim();
  console.log(`[Login User Firestore Action] Submitted password (trimmed) type: ${typeof submittedPasswordTrimmed}, length: ${submittedPasswordTrimmed.length}, value: '${submittedPasswordTrimmed}'`);


  try {
    const userDocRef = adminFirestore_DefaultDB.collection('auth_users').doc(email.toLowerCase());
    const userDocSnap = await userDocRef.get();

    if (!userDocSnap.exists) {
      console.log(`[Login User Firestore Action] User document not found for email: ${email.toLowerCase()}`);
      return { message: 'Email não encontrado.', status: 'error' };
    }

    const userDataFromDb = userDocSnap.data();
    if (!userDataFromDb || userDataFromDb.password === undefined || userDataFromDb.password === null) {
        console.warn(`[Login User Firestore Action] User ${email} has invalid or missing password data in DB. userDataFromDb.password is: ${userDataFromDb?.password}`);
        return { message: 'Dados do usuário inválidos ou senha não configurada.', status: 'error' };
    }

    const storedPasswordValue = userDataFromDb.password;
    console.log(`[Login User Firestore Action] User ${email}. Stored password (raw from DB) type: ${typeof storedPasswordValue}, value (first 10 chars if string): '${String(storedPasswordValue).substring(0,10)}...'`);
    
    let isMatch = false;
    let needsPasswordUpdate = false;

    try {
      console.log(`[Login User Firestore Action] Attempting bcrypt.compare for user ${email}.`);
      // bcrypt.compare takes the raw password and the hash
      isMatch = await bcrypt.compare(submittedPasswordTrimmed, String(storedPasswordValue));
      if (isMatch) {
         console.log(`[Login User Firestore Action] User ${email} logged in with hashed password.`);
      } else {
         console.log(`[Login User Firestore Action] Hashed password comparison FAILED for user ${email}.`);
      }
    } catch (e: any) {
      // This block is entered if bcrypt.compare throws, likely due to stored password not being a valid hash (i.e., it's plaintext)
      console.warn(`[Login User Firestore Action] bcrypt.compare threw for user ${email}. Error: ${e.message}. This indicates the stored password is likely plaintext. Attempting direct plaintext comparison.`);
      
      const storedPasswordStringTrimmed = String(storedPasswordValue).trim();

      console.log(`[Login User Firestore Action] Plaintext comparison details for user ${email}:`);
      console.log(`  - Submitted (trimmed) password type: ${typeof submittedPasswordTrimmed}, length: ${submittedPasswordTrimmed.length}, value: '${submittedPasswordTrimmed}'`);
      console.log(`  - Stored (trimmed from DB) password type: ${typeof storedPasswordStringTrimmed}, length: ${storedPasswordStringTrimmed.length}, value: '${storedPasswordStringTrimmed}'`);

      const directComparisonResult = submittedPasswordTrimmed === storedPasswordStringTrimmed;
      console.log(`[Login User Firestore Action] Result of direct trimmed string comparison (submittedPasswordTrimmed === storedPasswordStringTrimmed): ${directComparisonResult}`);

      if (directComparisonResult) {
        isMatch = true;
        needsPasswordUpdate = true;
        console.log(`[Login User Firestore Action] User ${email} logged in with plaintext-equivalent password (after trimming both). Password will be updated to hash.`);
      } else {
        console.log(`[Login User Firestore Action] Plaintext-equivalent password comparison (after trimming both) FAILED for user ${email}. isMatch remains false.`);
      }
    }

    if (!isMatch) {
      console.log(`[Login User Firestore Action] Final isMatch is false for user ${email}. Returning 'Senha incorreta'.`);
      return { message: 'Senha incorreta.', status: 'error' };
    }

    // If login was successful and password needs update (was plaintext)
    if (needsPasswordUpdate) {
      try {
        console.log(`[Login User Firestore Action] Attempting to update password to hash for user ${email}.`);
        const salt = await bcrypt.genSalt(SALT_ROUNDS);
        const hashedPassword = await bcrypt.hash(submittedPasswordTrimmed, salt); // Hash the submitted (and now verified) password
        await userDocRef.update({ password: hashedPassword });
        console.log(`[Login User Firestore Action] Password for user ${email} successfully updated to hash in Firestore.`);
      } catch (updateError: any) {
        console.error(`[Login User Firestore Action] FAILED to update password to hash for user ${email}:`, updateError.message);
        // Non-critical error for login flow, user is already authenticated. Log and continue.
      }
    }

    // Post-authentication checks
    if (!userDataFromDb.isApproved && userDataFromDb.pendingApproval) {
      console.log(`[Login User Firestore Action] User ${email} login attempt: pending approval.`);
      return { message: 'Sua conta está pendente de aprovação pelo administrador.', status: 'pending' };
    }

    if (!userDataFromDb.isApproved && !userDataFromDb.pendingApproval) {
      console.log(`[Login User Firestore Action] User ${email} login attempt: not approved.`);
      return { message: 'Sua conta não foi aprovada. Contate o administrador.', status: 'error'};
    }

    const userProfileToReturn: UserProfile = {
      uid: userDocSnap.id, 
      email: userDataFromDb.email,
      name: userDataFromDb.name,
      isApproved: userDataFromDb.isApproved,
      pendingApproval: userDataFromDb.pendingApproval,
      isAdmin: userDataFromDb.isAdmin,
      createdAt: userDataFromDb.createdAt ? (userDataFromDb.createdAt as Timestamp).toDate() : new Date(),
      photoURL: userDataFromDb.photoURL,
    };
    console.log(`[Login User Firestore Action] User ${email} login successful. Status: Approved.`);
    return { message: 'Login bem-sucedido!', status: 'success', user: userProfileToReturn };

  } catch (error: any) {
    console.error('[Login User Firestore Action] Outer catch block error:', error);
    return { message: `Erro no login: ${error.message || 'Erro desconhecido no servidor.'}.`, status: 'error' };
  }
}
    