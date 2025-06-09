
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

    const isAdmin = email.toLowerCase() === ADMIN_PRIMARY_EMAIL.toLowerCase();
    const newUserProfile: Omit<UserProfile, 'uid'> & { password?: string; createdAt: Timestamp } = {
      email: email.toLowerCase(),
      name,
      password: hashedPassword, // Store hashed password
      isApproved: isAdmin,
      pendingApproval: !isAdmin,
      isAdmin: isAdmin,
      createdAt: Timestamp.now(),
    };

    await userDocRef.set(newUserProfile);

    return {
      message: isAdmin
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
  if (adminSDKAuthError) {
    return { message: `Erro Crítico no Servidor (Admin SDK): ${adminSDKAuthError}`, status: 'error' };
  }
  if (!adminFirestore_DefaultDB) {
     return { message: "Erro Crítico no Servidor: Conexão com Firestore (Default DB) para usuários não está disponível.", status: 'error' };
  }

  const email = formData.get('email') as string;
  const password = formData.get('password') as string;

  if (!email || !password) {
    return { message: 'Email e senha são obrigatórios.', status: 'error' };
  }

  try {
    const userDocRef = adminFirestore_DefaultDB.collection('auth_users').doc(email.toLowerCase());
    const userDocSnap = await userDocRef.get();

    if (!userDocSnap.exists) {
      console.log(`[Login User Firestore Action] User document not found for email: ${email.toLowerCase()}`);
      return { message: 'Email não encontrado.', status: 'error' };
    }

    const userDataFromDb = userDocSnap.data();
    if (!userDataFromDb || userDataFromDb.password === undefined || userDataFromDb.password === null) { // Check for undefined or null
        console.warn(`[Login User Firestore Action] User ${email} has invalid or missing password data in DB.`);
        return { message: 'Dados do usuário inválidos ou senha não configurada.', status: 'error' };
    }

    const storedPasswordValue = userDataFromDb.password;
    let storedPasswordString: string;

    if (typeof storedPasswordValue !== 'string') {
      storedPasswordString = String(storedPasswordValue);
      console.warn(`[Login User Firestore Action] Stored password for user ${email} was not a string (type: ${typeof storedPasswordValue}). Converted to: '${storedPasswordString}'`);
    } else {
      storedPasswordString = storedPasswordValue;
    }
    
    // Handle case where stored password might be an empty string after conversion or originally
    if (storedPasswordString === "") {
       console.warn(`[Login User Firestore Action] User ${email} has an empty string as stored password.`);
       // If user also submits an empty password (though form validation should prevent this), it might match.
       // However, our initial check `if (!email || !password)` should prevent empty submitted passwords.
       // So, if stored is empty, and submitted is not, it will fail the match, which is correct.
    }


    let isMatch = false;
    let needsPasswordUpdate = false;

    try {
      // bcrypt.compare will throw an error if storedPasswordString is not a valid hash.
      console.log(`[Login User Firestore Action] Attempting bcrypt.compare for user ${email}.`);
      isMatch = await bcrypt.compare(password, storedPasswordString);
      if (isMatch) {
         console.log(`[Login User Firestore Action] User ${email} logged in with hashed password.`);
      } else {
         console.log(`[Login User Firestore Action] Hashed password comparison failed for user ${email}.`);
      }
    } catch (e: any) {
      // This block executes if storedPasswordString is NOT a valid bcrypt hash (e.g., it's plaintext)
      console.warn(`[Login User Firestore Action] bcrypt.compare threw for user ${email}. Assuming plaintext or malformed stored password. Error: ${e.message}`);
      if (password === storedPasswordString) { // Plaintext comparison
        isMatch = true;
        needsPasswordUpdate = true; // Mark for update to hash
        console.log(`[Login User Firestore Action] User ${email} logged in with plaintext-equivalent password. Password will be updated to hash.`);
      } else {
        console.log(`[Login User Firestore Action] Plaintext-equivalent password comparison failed for user ${email}.`);
      }
    }

    if (!isMatch) {
      console.log(`[Login User Firestore Action] Final isMatch is false for user ${email}. Returning 'Senha incorreta'.`);
      return { message: 'Senha incorreta.', status: 'error' };
    }

    // If login was successful with a password that needs hashing (plaintext or malformed that matched plaintext)
    if (needsPasswordUpdate) {
      try {
        console.log(`[Login User Firestore Action] Attempting to update password to hash for user ${email}.`);
        const salt = await bcrypt.genSalt(SALT_ROUNDS);
        const hashedPassword = await bcrypt.hash(password, salt);
        await userDocRef.update({ password: hashedPassword });
        console.log(`[Login User Firestore Action] Password for user ${email} successfully updated to hash in Firestore.`);
      } catch (updateError: any) {
        console.error(`[Login User Firestore Action] FAILED to update password to hash for user ${email}:`, updateError.message);
        // Decide on policy: proceed with login or block? For now, proceed but log error.
        // toast({ title: "Aviso de Segurança", description: "Não foi possível atualizar sua senha para o formato seguro. Contate o suporte.", variant: "destructive" }); // This toast won't work here.
      }
    }

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
    