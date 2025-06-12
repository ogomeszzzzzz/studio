
'use server';

import { adminFirestore_DefaultDB, adminSDKInitializationError, adminAuth } from '@/lib/firebase/adminConfig';
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
  console.log('[Register User Firestore Action - PRE-CHECK V33] adminSDKInitializationError:', adminSDKInitializationError);
  console.log('[Register User Firestore Action - PRE-CHECK V33] adminAuth is null:', adminAuth === null);
  console.log('[Register User Firestore Action - PRE-CHECK V33] adminFirestore_DefaultDB is null:', adminFirestore_DefaultDB === null);
  if (adminFirestore_DefaultDB) {
    console.log('[Register User Firestore Action - PRE-CHECK V33] adminFirestore_DefaultDB.app.options.projectId:', adminFirestore_DefaultDB?.app?.options?.projectId);
  }


  if (adminSDKInitializationError) {
    console.error('[Register User Firestore Action - CRITICAL_FAILURE] Aborting due to Admin SDK init error:', adminSDKInitializationError, '(REF: SDK_INIT_FAIL_REG)');
    return { message: `Erro Crítico no Servidor (Admin SDK): ${adminSDKInitializationError.substring(0,100)} (REF: SDK_INIT_FAIL_REG)`, status: 'error' };
  }
  if (!adminFirestore_DefaultDB) {
    console.error('[Register User Firestore Action - CRITICAL_FAILURE] adminFirestore_DefaultDB is null. This means the Admin SDK did not initialize Firestore correctly. (REF: FS_INSTANCE_NULL_REG)');
    return { message: 'Erro crítico na configuração do servidor: Acesso ao banco de dados não está disponível. (REF: FS_INSTANCE_NULL_REG)', status: 'error' };
  }
   if (!adminAuth) {
    console.error('[Register User Firestore Action - CRITICAL_FAILURE] adminAuth is null. This means the Admin SDK did not initialize Auth service correctly. (REF: AUTH_SVC_NULL_REG)');
    return { message: 'Erro crítico na configuração do servidor: Serviço de autenticação não disponível. (REF: AUTH_SVC_NULL_REG)', status: 'error' };
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
  console.log('[Login User Firestore Action - PRE-CHECK V33] adminSDKInitializationError:', adminSDKInitializationError);
  console.log('[Login User Firestore Action - PRE-CHECK V33] adminAuth is null:', adminAuth === null);
  console.log('[Login User Firestore Action - PRE-CHECK V33] adminFirestore_DefaultDB is null:', adminFirestore_DefaultDB === null);
  if (adminFirestore_DefaultDB) {
    console.log('[Login User Firestore Action - PRE-CHECK V33] adminFirestore_DefaultDB.app.options.projectId:', adminFirestore_DefaultDB?.app?.options?.projectId);
  }

  if (adminSDKInitializationError) {
    console.error('[Login User Firestore Action - CRITICAL_FAILURE] Aborting due to Admin SDK init error:', adminSDKInitializationError, '(REF: SDK_INIT_FAIL_LOGIN)');
    return { message: `Erro Crítico no Servidor (Admin SDK): ${adminSDKInitializationError.substring(0,100)} (REF: SDK_INIT_FAIL_LOGIN)`, status: 'error' };
  }
  if (!adminFirestore_DefaultDB) {
    console.error('[Login User Firestore Action - CRITICAL_FAILURE] adminFirestore_DefaultDB is null. This means the Admin SDK did not initialize Firestore correctly. (REF: FS_INSTANCE_NULL_LOGIN)');
    return { message: 'Erro crítico na configuração do servidor: Acesso ao banco de dados não está disponível. (REF: FS_INSTANCE_NULL_LOGIN)', status: 'error' };
  }
  if (!adminAuth) { // Added this check as well
    console.error('[Login User Firestore Action - CRITICAL_FAILURE] adminAuth is null. This means the Admin SDK did not initialize Auth service correctly. (REF: AUTH_SVC_NULL_LOGIN)');
    return { message: 'Erro crítico na configuração do servidor: Serviço de autenticação não disponível. (REF: AUTH_SVC_NULL_LOGIN)', status: 'error' };
  }

  console.log('[Login User Firestore Action - Definitive Fix Attempt] Attempting login...');
  const email = formData.get('email') as string;
  const rawSubmittedPassword = formData.get('password') as string;
  
  console.log(`[Login User Firestore Action] Email submitted: '${email}'`);

  if (!email || !rawSubmittedPassword) {
    console.warn('[Login User Firestore Action] Email or password not provided.');
    return { message: 'Email e senha são obrigatórios.', status: 'error' };
  }

  const submittedPasswordTrimmed = rawSubmittedPassword.trim();
  console.log(`[Login User Firestore Action] Submitted password (trimmed): type: ${typeof submittedPasswordTrimmed}, length: ${submittedPasswordTrimmed.length}, value: '${submittedPasswordTrimmed}'`);

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

    console.log(`[Login User Firestore Action] Attempting bcrypt.compare for user ${email}.`);
    try {
        isMatch = await bcrypt.compare(submittedPasswordTrimmed, String(storedPasswordValue));
        if (isMatch) {
            console.log(`[Login User Firestore Action] Hashed password match SUCCESS for user ${email}.`);
        } else {
            console.log(`[Login User Firestore Action] bcrypt.compare returned false for user ${email}. Proceeding to plaintext check.`);
        }
    } catch (bcryptError: any) {
        console.warn(`[Login User Firestore Action] bcrypt.compare threw an error for user ${email}: ${bcryptError.message}. This is unexpected if storedPasswordValue is a simple string. Will proceed to plaintext check anyway.`);
        isMatch = false; 
    }

    if (!isMatch) {
        console.log(`[Login User Firestore Action] --- PLAINTEXT COMPARISON BLOCK FOR USER: ${email} ---`);
        const storedPasswordStringTrimmed = String(storedPasswordValue).trim();
        const plaintextMatch = submittedPasswordTrimmed === storedPasswordStringTrimmed;
        console.log(`  - RESULT OF ('${submittedPasswordTrimmed}' === '${storedPasswordStringTrimmed}'): ${plaintextMatch}`);
        
        if (plaintextMatch) {
            isMatch = true;
            needsPasswordUpdate = true;
            console.log(`[Login User Firestore Action] Plaintext match SUCCESS for user ${email}. Password will be updated to hash.`);
        } else {
            console.log(`[Login User Firestore Action] Plaintext match FAILED for user ${email}.`);
        }
        console.log(`[Login User Firestore Action] --- END PLAINTEXT COMPARISON BLOCK ---`);
    }


    if (!isMatch) {
      console.log(`[Login User Firestore Action] Final isMatch is false for user ${email}. Returning 'Senha incorreta'.`);
      return { message: 'Senha incorreta.', status: 'error' };
    }

    if (needsPasswordUpdate) {
      try {
        console.log(`[Login User Firestore Action] Attempting to update password to hash for user ${email}.`);
        const salt = await bcrypt.genSalt(SALT_ROUNDS);
        const hashedPassword = await bcrypt.hash(submittedPasswordTrimmed, salt); 
        await userDocRef.update({ password: hashedPassword });
        console.log(`[Login User Firestore Action] Password for user ${email} successfully updated to hash in Firestore.`);
      } catch (updateError: any) {
        console.error(`[Login User Firestore Action] FAILED to update password to hash for user ${email}:`, updateError.message);
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
    // Log the specific error code and details if available
    if (error.code) {
        console.error(`[Login User Firestore Action] Firestore Error Code: ${error.code}, Details: ${error.details}`);
    }
    return { message: `Erro no login: ${error.message || 'Erro desconhecido no servidor.'}. (Code: ${error.code || 'N/A'})`, status: 'error' };
  }
}

    