
'use server';

import { getAdminAuthInstance, getAdminFirestoreInstance, getAdminSDKInitializationError } from '@/lib/firebase/adminConfig';
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
const LOG_VERSION_TAG_ACTION = "V36"; 

export async function registerUserInFirestore(prevState: any, formData: FormData): Promise<ActionResult> {
  const adminAuth = await getAdminAuthInstance();
  const adminFirestore_DefaultDB = await getAdminFirestoreInstance();
  const adminSDKInitError = await getAdminSDKInitializationError();

  console.log(`[Register User Action - PRE-CHECK ${LOG_VERSION_TAG_ACTION}] adminSDKInitError (from getter): ${adminSDKInitError}`);
  console.log(`[Register User Action - PRE-CHECK ${LOG_VERSION_TAG_ACTION}] adminAuth is null: ${adminAuth === null}`);
  console.log(`[Register User Action - PRE-CHECK ${LOG_VERSION_TAG_ACTION}] adminFirestore_DefaultDB is null: ${adminFirestore_DefaultDB === null}`);

  if (adminSDKInitError || !adminAuth || !adminFirestore_DefaultDB) {
    const errorMsg = `Erro Crítico de Inicialização do Servidor (Admin SDK): ${adminSDKInitError || 'Serviços Admin não disponíveis'}. Verifique os logs V36 do servidor. (REF: SDK_INIT_FAIL_IN_ACTION_REG_${LOG_VERSION_TAG_ACTION})`;
    console.error(`[Register User Action - CRITICAL_FAILURE] ${errorMsg}`);
    return { message: errorMsg, status: 'error' };
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
    console.error(`[Register User Action ${LOG_VERSION_TAG_ACTION}] Error:`, error);
    return { message: `Ocorreu um erro ao registrar: ${error.message || 'Erro desconhecido'}.`, status: 'error' };
  }
}

export async function loginUserWithFirestore(prevState: any, formData: FormData): Promise<ActionResult> {
  const adminAuth = await getAdminAuthInstance();
  const adminFirestore_DefaultDB = await getAdminFirestoreInstance();
  const adminSDKInitError = await getAdminSDKInitializationError();

  console.log(`[Login Action ${LOG_VERSION_TAG_ACTION} - PRE-CHECK] adminSDKInitError (from getter): ${adminSDKInitError}`);
  console.log(`[Login Action ${LOG_VERSION_TAG_ACTION} - PRE-CHECK] adminAuth is null: ${adminAuth === null}`);
  console.log(`[Login Action ${LOG_VERSION_TAG_ACTION} - PRE-CHECK] adminFirestore_DefaultDB is null: ${adminFirestore_DefaultDB === null}`);
  
  if (adminSDKInitError || !adminAuth || !adminFirestore_DefaultDB) {
    const errorMsg = `Erro Crítico de Inicialização do Servidor (Admin SDK): ${adminSDKInitError || 'Serviços Admin não disponíveis'}. Verifique os logs V36 do servidor. (REF: SDK_INIT_FAIL_IN_ACTION_LOGIN_${LOG_VERSION_TAG_ACTION})`;
    console.error(`[Login Action ${LOG_VERSION_TAG_ACTION} - CRITICAL_FAILURE] ${errorMsg}`);
    return { message: errorMsg, status: 'error' };
  }
  
  console.log(`[Login User Firestore Action ${LOG_VERSION_TAG_ACTION}] Attempting login...`);
  const email = formData.get('email') as string;
  const rawSubmittedPassword = formData.get('password') as string;
  
  console.log(`[Login User Firestore Action ${LOG_VERSION_TAG_ACTION}] Email submitted: '${email}'`);

  if (!email || !rawSubmittedPassword) {
    console.warn(`[Login User Firestore Action ${LOG_VERSION_TAG_ACTION}] Email or password not provided.`);
    return { message: 'Email e senha são obrigatórios.', status: 'error' };
  }

  const submittedPasswordTrimmed = rawSubmittedPassword.trim();
  console.log(`[Login User Firestore Action ${LOG_VERSION_TAG_ACTION}] Submitted password (trimmed): type: string, length: ${submittedPasswordTrimmed.length}, value: 'Log Redacted'`);
  
  // --- FINAL CHECK BEFORE Firestore .get() call ---
  console.log(`[Login Action ${LOG_VERSION_TAG_ACTION} - DETAIL CHECK 1] adminFirestore_DefaultDB is null/undefined: ${!adminFirestore_DefaultDB}`);
  console.log(`[Login Action ${LOG_VERSION_TAG_ACTION} - DETAIL CHECK 2] adminFirestore_DefaultDB.app is null/undefined: ${adminFirestore_DefaultDB ? !adminFirestore_DefaultDB.app : 'N/A (adminFirestore_DefaultDB is null)'}`);
  console.log(`[Login Action ${LOG_VERSION_TAG_ACTION} - DETAIL CHECK 3] adminFirestore_DefaultDB.app.options is null/undefined: ${adminFirestore_DefaultDB && adminFirestore_DefaultDB.app ? !adminFirestore_DefaultDB.app.options : 'N/A (app or adminFirestore_DefaultDB is null)'}`);
  if (adminFirestore_DefaultDB && adminFirestore_DefaultDB.app && adminFirestore_DefaultDB.app.options) {
      console.log(`[Login Action ${LOG_VERSION_TAG_ACTION} - DETAIL CHECK 4] adminFirestore_DefaultDB.app.options.projectId value: '${adminFirestore_DefaultDB.app.options.projectId}'`);
  }

  if (!adminFirestore_DefaultDB || !adminFirestore_DefaultDB.app || !adminFirestore_DefaultDB.app.options || adminFirestore_DefaultDB.app.options.projectId !== "ecommerce-db-75f77") {
      console.error(`[Login Action ${LOG_VERSION_TAG_ACTION} - CRITICAL FAILURE AT GET] Firestore instance is invalid or for wrong project. Expected 'ecommerce-db-75f77', got '${adminFirestore_DefaultDB?.app?.options?.projectId}'.`);
      return { message: `Erro crítico: Configuração do banco de dados inválida no servidor. Contate o suporte. (REF: FS_GET_PRECHECK_FAIL_${LOG_VERSION_TAG_ACTION})`, status: 'error' };
  }

  try {
    const userDocRef = adminFirestore_DefaultDB.collection('auth_users').doc(email.toLowerCase());
    const userDocSnap = await userDocRef.get();

    if (!userDocSnap.exists) {
      console.log(`[Login User Firestore Action ${LOG_VERSION_TAG_ACTION}] User document not found for email: ${email.toLowerCase()}`);
      return { message: 'Email não encontrado.', status: 'error' };
    }

    const userDataFromDb = userDocSnap.data();
    if (!userDataFromDb || userDataFromDb.password === undefined || userDataFromDb.password === null) {
        console.warn(`[Login User Firestore Action ${LOG_VERSION_TAG_ACTION}] User ${email} has invalid or missing password data in DB. userDataFromDb.password is: ${userDataFromDb?.password}`);
        return { message: 'Dados do usuário inválidos ou senha não configurada.', status: 'error' };
    }

    const storedPasswordValue = userDataFromDb.password;
    let isMatch = false;
    let needsPasswordUpdate = false;

    try {
        isMatch = await bcrypt.compare(submittedPasswordTrimmed, String(storedPasswordValue));
    } catch (bcryptError: any) {
        console.warn(`[Login User Firestore Action ${LOG_VERSION_TAG_ACTION}] bcrypt.compare threw an error for user ${email}: ${bcryptError.message}. This is unexpected if storedPasswordValue is a simple string. Will proceed to plaintext check anyway.`);
        isMatch = false; 
    }

    if (!isMatch) {
        const storedPasswordStringTrimmed = String(storedPasswordValue).trim();
        const plaintextMatch = submittedPasswordTrimmed === storedPasswordStringTrimmed;
        if (plaintextMatch) {
            isMatch = true;
            needsPasswordUpdate = true;
            console.log(`[Login User Firestore Action ${LOG_VERSION_TAG_ACTION}] Plaintext match SUCCESS for user ${email}. Password will be updated to hash.`);
        }
    }

    if (!isMatch) {
      console.log(`[Login User Firestore Action ${LOG_VERSION_TAG_ACTION}] Final isMatch is false for user ${email}. Returning 'Senha incorreta'.`);
      return { message: 'Senha incorreta.', status: 'error' };
    }

    if (needsPasswordUpdate) {
      try {
        const salt = await bcrypt.genSalt(SALT_ROUNDS);
        const hashedPassword = await bcrypt.hash(submittedPasswordTrimmed, salt); 
        await userDocRef.update({ password: hashedPassword });
        console.log(`[Login User Firestore Action ${LOG_VERSION_TAG_ACTION}] Password for user ${email} successfully updated to hash in Firestore.`);
      } catch (updateError: any) {
        console.error(`[Login User Firestore Action ${LOG_VERSION_TAG_ACTION}] FAILED to update password to hash for user ${email}:`, updateError.message);
      }
    }

    if (!userDataFromDb.isApproved && userDataFromDb.pendingApproval) {
      console.log(`[Login User Firestore Action ${LOG_VERSION_TAG_ACTION}] User ${email} login attempt: pending approval.`);
      return { message: 'Sua conta está pendente de aprovação pelo administrador.', status: 'pending' };
    }

    if (!userDataFromDb.isApproved && !userDataFromDb.pendingApproval) {
      console.log(`[Login User Firestore Action ${LOG_VERSION_TAG_ACTION}] User ${email} login attempt: not approved.`);
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
    console.log(`[Login User Firestore Action ${LOG_VERSION_TAG_ACTION}] User ${email} login successful. Status: Approved.`);
    return { message: 'Login bem-sucedido!', status: 'success', user: userProfileToReturn };

  } catch (error: any) {
    console.error(`[Login User Firestore Action ${LOG_VERSION_TAG_ACTION}] Outer catch block error:`, error);
    if (error.code) {
        console.error(`[Login User Firestore Action ${LOG_VERSION_TAG_ACTION}] Firestore Error Code: ${error.code}, Details: ${error.details}`);
    }
    return { message: `Erro no login: ${error.message || 'Erro desconhecido no servidor.'}. (Code: ${error.code || 'N/A'})`, status: 'error' };
  }
}
