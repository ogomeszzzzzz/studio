
'use server';

import { adminAuth } from '@/lib/firebase/adminConfig'; // Ensure adminConfig is set up
import { FirebaseError } from 'firebase-admin/app'; // For type checking

const ADMIN_EMAIL_ADDRESS = process.env.ADMIN_EMAIL;

type FormState = {
  message: string;
  status: 'success' | 'error' | '';
};

export async function createUserByAdmin(prevState: FormState, formData: FormData): Promise<FormState> {
  if (!adminAuth) {
    console.error('[Admin Action] Firebase Admin SDK (adminAuth) is not initialized.');
    return { message: 'Erro de servidor: Admin SDK não inicializado.', status: 'error' };
  }
  if (!ADMIN_EMAIL_ADDRESS) {
    console.error('[Admin Action] ADMIN_EMAIL environment variable is not set.');
    return { message: 'Erro de configuração do servidor: Email do administrador não definido.', status: 'error' };
  }

  const adminIdToken = formData.get('adminIdToken') as string;
  const newUserEmail = formData.get('newUserEmail') as string;
  const newPassword = formData.get('newPassword') as string;

  if (!adminIdToken || !newUserEmail || !newPassword) {
    return { message: 'Todos os campos são obrigatórios, incluindo o token do admin.', status: 'error' };
  }

  if (newPassword.length < 6) {
    return { message: 'A senha deve ter pelo menos 6 caracteres.', status: 'error' };
  }

  try {
    // 1. Verify the admin's ID token
    const decodedToken = await adminAuth.verifyIdToken(adminIdToken);
    
    // 2. Check if the verified token's email matches the configured admin email
    if (decodedToken.email !== ADMIN_EMAIL_ADDRESS) {
      console.warn(`[Admin Action] Unauthorized attempt to create user by ${decodedToken.email}`);
      return { message: 'Não autorizado: Apenas o administrador pode criar usuários.', status: 'error' };
    }

    // 3. If authorized, create the new user
    await adminAuth.createUser({
      email: newUserEmail,
      password: newPassword,
      emailVerified: true, // Or false, depending on your flow
      // You can add more properties like displayName, photoURL, disabled, etc.
    });

    console.log(`[Admin Action] User ${newUserEmail} created successfully by admin ${decodedToken.email}`);
    return { message: `Usuário ${newUserEmail} criado com sucesso!`, status: 'success' };

  } catch (error: unknown) {
    let errorMessage = 'Ocorreu um erro desconhecido ao criar o usuário.';
    if (error instanceof FirebaseError) { // Use FirebaseError from firebase-admin/app
      console.error('[Admin Action] Firebase error creating user:', error.code, error.message);
      if (error.code === 'auth/email-already-exists') {
        errorMessage = 'Este email já está em uso por outra conta.';
      } else if (error.code === 'auth/invalid-password') {
        errorMessage = 'A senha fornecida é inválida. Deve ter pelo menos 6 caracteres.';
      } else if (error.code === 'auth/id-token-expired' || error.code === 'auth/argument-error') {
        errorMessage = 'Sessão do administrador inválida ou expirada. Por favor, recarregue a página e tente novamente.';
      } else {
        errorMessage = `Erro do Firebase: ${error.message} (código: ${error.code})`;
      }
    } else if (error instanceof Error) {
      console.error('[Admin Action] Generic error creating user:', error.message);
      errorMessage = error.message;
    } else {
      console.error('[Admin Action] Unknown error structure creating user:', error);
    }
    return { message: errorMessage, status: 'error' };
  }
}
