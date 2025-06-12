
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
  console.log('[Register User Firestore Action - PRE-CHECK V35] adminSDKInitializationError:', adminSDKInitializationError);
  if (adminSDKInitializationError) {
    console.error('[Register User Firestore Action - CRITICAL_FAILURE] Aborting due to Admin SDK init error:', adminSDKInitializationError, '(REF: SDK_INIT_FAIL_REG_V35)');
    return { message: `Erro Crítico no Servidor (Admin SDK): ${adminSDKInitializationError.substring(0,100)} (REF: SDK_INIT_FAIL_REG_V35)`, status: 'error' };
  }
  console.log('[Register User Firestore Action - PRE-CHECK V35] adminFirestore_DefaultDB is null:', adminFirestore_DefaultDB === null);
  if (!adminFirestore_DefaultDB) {
    console.error('[Register User Firestore Action - CRITICAL_FAILURE] adminFirestore_DefaultDB is null. (REF: FS_INSTANCE_NULL_REG_V35)');
    return { message: 'Erro crítico na configuração do servidor: Acesso ao banco de dados não está disponível. (REF: FS_INSTANCE_NULL_REG_V35)', status: 'error' };
  }
  console.log('[Register User Firestore Action - PRE-CHECK V35] adminAuth is null:', adminAuth === null);
  if (!adminAuth) {
    console.error('[Register User Firestore Action - CRITICAL_FAILURE] adminAuth is null. (REF: AUTH_SVC_NULL_REG_V35)');
    return { message: 'Erro crítico na configuração do servidor: Serviço de autenticação não disponível. (REF: AUTH_SVC_NULL_REG_V35)', status: 'error' };
  }
  if (adminFirestore_DefaultDB) { // Check again before using, though already checked above
    console.log('[Register User Firestore Action - PRE-CHECK V35] adminFirestore_DefaultDB.app.options.projectId:', adminFirestore_DefaultDB?.app?.options?.projectId);
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
      password: hashedPassword,
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
    console.error('[Register User Firestore Action V35] Error:', error);
    return { message: `Ocorreu um erro ao registrar: ${error.message || 'Erro desconhecido'}.`, status: 'error' };
  }
}

export async function loginUserWithFirestore(prevState: any, formData: FormData): Promise<ActionResult> {
  console.log('[Login User Firestore Action - PRE-CHECK V35] adminSDKInitializationError:', adminSDKInitializationError);
  if (adminSDKInitializationError) {
    console.error('[Login User Firestore Action - CRITICAL_FAILURE] Aborting due to Admin SDK init error:', adminSDKInitializationError, '(REF: SDK_INIT_FAIL_LOGIN_V35)');
    return { message: `Erro Crítico no Servidor (Admin SDK): ${adminSDKInitializationError.substring(0,100)} (REF: SDK_INIT_FAIL_LOGIN_V35)`, status: 'error' };
  }

  console.log('[Login User Firestore Action - PRE-CHECK V35] adminFirestore_DefaultDB is null:', adminFirestore_DefaultDB === null);
  if (!adminFirestore_DefaultDB) {
    console.error('[Login User Firestore Action - CRITICAL_FAILURE] adminFirestore_DefaultDB is null. This means the Admin SDK did not initialize Firestore correctly. REF: FS_INSTANCE_NULL_LOGIN_V35');
    return {
      message: 'Erro crítico na configuração do servidor: Acesso ao banco de dados não está disponível. Contate o suporte. (REF: FS_INSTANCE_NULL_LOGIN_V35)',
      status: 'error',
    };
  }

  console.log('[Login User Firestore Action - PRE-CHECK V35] adminAuth is null:', adminAuth === null);
  if (!adminAuth) {
    console.error('[Login User Firestore Action - CRITICAL_FAILURE] adminAuth is null. This means the Admin SDK did not initialize Auth correctly. REF: AUTH_SVC_NULL_LOGIN_V35');
    return {
      message: 'Erro crítico na configuração do servidor: Serviço de autenticação não disponível. Contate o suporte. (REF: AUTH_SVC_NULL_LOGIN_V35)',
      status: 'error',
    };
  }

  // Log projectId if adminFirestore_DefaultDB is not null
  console.log('[Login User Firestore Action - PRE-CHECK V35] adminFirestore_DefaultDB.app.options.projectId:', adminFirestore_DefaultDB?.app?.options?.projectId);


  console.log('[Login User Firestore Action V35] Attempting login...');
  const email = formData.get('email') as string;
  const rawSubmittedPassword = formData.get('password') as string;
  
  console.log(`[Login User Firestore Action V35] Email submitted: '${email}'`);

  if (!email || !rawSubmittedPassword) {
    console.warn('[Login User Firestore Action V35] Email or password not provided.');
    return { message: 'Email e senha são obrigatórios.', status: 'error' };
  }

  const submittedPasswordTrimmed = rawSubmittedPassword.trim();
  console.log(`[Login User Firestore Action V35] Submitted password (trimmed): type: ${typeof submittedPasswordTrimmed}, length: ${submittedPasswordTrimmed.length}, value: '${submittedPasswordTrimmed.substring(0,10)}...'`);

  // --- FINAL CHECK BEFORE Firestore .get() call ---
  console.log(`[Login Action V35 - FINAL CHECK BEFORE GET] Firestore DB Project ID: ${adminFirestore_DefaultDB?.app?.options?.projectId}, Firestore Instance Valid: ${!!adminFirestore_DefaultDB}`);
  if (!adminFirestore_DefaultDB || !adminFirestore_DefaultDB.app || !adminFirestore_DefaultDB.app.options || adminFirestore_DefaultDB.app.options.projectId !== "ecommerce-db-75f77") {
      console.error(`[Login Action V35 - CRITICAL FAILURE AT GET] Firestore instance is invalid, or its 'app' or 'options' property is undefined, or it's for the wrong project. Expected 'ecommerce-db-75f77', got '${adminFirestore_DefaultDB?.app?.options?.projectId}'.`);
      return { message: `Erro crítico: Configuração do banco de dados inválida no servidor. Contate o suporte. (REF: FS_GET_PRECHECK_FAIL_V35)`, status: 'error' };
  }
  // --- END FINAL CHECK ---

  try {
    const userDocRef = adminFirestore_DefaultDB.collection('auth_users').doc(email.toLowerCase());
    const userDocSnap = await userDocRef.get();

    if (!userDocSnap.exists) {
      console.log(`[Login User Firestore Action V35] User document not found for email: ${email.toLowerCase()}`);
      return { message: 'Email não encontrado.', status: 'error' };
    }

    const userDataFromDb = userDocSnap.data();
    if (!userDataFromDb || userDataFromDb.password === undefined || userDataFromDb.password === null) {
        console.warn(`[Login User Firestore Action V35] User ${email} has invalid or missing password data in DB. userDataFromDb.password is: ${userDataFromDb?.password}`);
        return { message: 'Dados do usuário inválidos ou senha não configurada.', status: 'error' };
    }

    const storedPasswordValue = userDataFromDb.password;
    console.log(`[Login User Firestore Action V35] User ${email}. Stored password (raw from DB) type: ${typeof storedPasswordValue}, value (first 10 chars if string): '${String(storedPasswordValue).substring(0,10)}...'`);
    
    let isMatch = false;
    let needsPasswordUpdate = false;

    console.log(`[Login User Firestore Action V35] Attempting bcrypt.compare for user ${email}.`);
    try {
        isMatch = await bcrypt.compare(submittedPasswordTrimmed, String(storedPasswordValue));
        if (isMatch) {
            console.log(`[Login User Firestore Action V35] Hashed password match SUCCESS for user ${email}.`);
        } else {
            console.log(`[Login User Firestore Action V35] bcrypt.compare returned false for user ${email}. Proceeding to plaintext check.`);
        }
    } catch (bcryptError: any) {
        console.warn(`[Login User Firestore Action V35] bcrypt.compare threw an error for user ${email}: ${bcryptError.message}. This is unexpected if storedPasswordValue is a simple string. Will proceed to plaintext check anyway.`);
        isMatch = false; 
    }

    if (!isMatch) {
        console.log(`[Login User Firestore Action V35] --- PLAINTEXT COMPARISON BLOCK FOR USER: ${email} ---`);
        const storedPasswordStringTrimmed = String(storedPasswordValue).trim();
        const plaintextMatch = submittedPasswordTrimmed === storedPasswordStringTrimmed;
        console.log(`  - RESULT OF ('${submittedPasswordTrimmed}' === '${storedPasswordStringTrimmed}'): ${plaintextMatch}`);
        
        if (plaintextMatch) {
            isMatch = true;
            needsPasswordUpdate = true;
            console.log(`[Login User Firestore Action V35] Plaintext match SUCCESS for user ${email}. Password will be updated to hash.`);
        } else {
            console.log(`[Login User Firestore Action V35] Plaintext match FAILED for user ${email}.`);
        }
        console.log(`[Login User Firestore Action V35] --- END PLAINTEXT COMPARISON BLOCK ---`);
    }


    if (!isMatch) {
      console.log(`[Login User Firestore Action V35] Final isMatch is false for user ${email}. Returning 'Senha incorreta'.`);
      return { message: 'Senha incorreta.', status: 'error' };
    }

    if (needsPasswordUpdate) {
      try {
        console.log(`[Login User Firestore Action V35] Attempting to update password to hash for user ${email}.`);
        const salt = await bcrypt.genSalt(SALT_ROUNDS);
        const hashedPassword = await bcrypt.hash(submittedPasswordTrimmed, salt); 
        await userDocRef.update({ password: hashedPassword });
        console.log(`[Login User Firestore Action V35] Password for user ${email} successfully updated to hash in Firestore.`);
      } catch (updateError: any) {
        console.error(`[Login User Firestore Action V35] FAILED to update password to hash for user ${email}:`, updateError.message);
        // Non-critical for login flow if update fails, proceed with login
      }
    }

    if (!userDataFromDb.isApproved && userDataFromDb.pendingApproval) {
      console.log(`[Login User Firestore Action V35] User ${email} login attempt: pending approval.`);
      return { message: 'Sua conta está pendente de aprovação pelo administrador.', status: 'pending' };
    }

    if (!userDataFromDb.isApproved && !userDataFromDb.pendingApproval) {
      console.log(`[Login User Firestore Action V35] User ${email} login attempt: not approved.`);
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
    console.log(`[Login User Firestore Action V35] User ${email} login successful. Status: Approved.`);
    return { message: 'Login bem-sucedido!', status: 'success', user: userProfileToReturn };

  } catch (error: any) {
    console.error('[Login User Firestore Action V35] Outer catch block error:', error);
    if (error.code) {
        console.error(`[Login User Firestore Action V35] Firestore Error Code: ${error.code}, Details: ${error.details}`);
    }
    return { message: `Erro no login: ${error.message || 'Erro desconhecido no servidor.'}. (Code: ${error.code || 'N/A'})`, status: 'error' };
  }
}
