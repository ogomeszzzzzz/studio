
'use server';

import { randomBytes } from 'crypto';
import { UserProfile } from '@/types';
import { adminAuth, adminFirestore } from '@/lib/firebase/config';
import { sendMail } from '@/lib/nodemailer';
import {FieldValue} from 'firebase-admin/firestore';

const APPROVER_EMAIL = process.env.APPROVER_EMAIL;
const APP_BASE_URL = process.env.NEXT_PUBLIC_APP_BASE_URL || 'http://localhost:9002';

if (!APPROVER_EMAIL) {
  console.error("APPROVER_EMAIL environment variable is not set. Approval emails will not work correctly.");
}

export async function registerUser(prevState: any, formData: FormData) {
  const email = formData.get('email') as string;
  const password = formData.get('password') as string;

  if (!email || !password) {
    return { message: 'Email e senha são obrigatórios.', status: 'error' };
  }
  if (password.length < 6) {
    return { message: 'A senha deve ter pelo menos 6 caracteres.', status: 'error' };
  }

  if (!adminAuth || !adminFirestore) {
    return { message: 'Configuração do servidor Firebase ausente.', status: 'error' };
  }

  try {
    const userRecord = await adminAuth.createUser({
      email,
      password,
      emailVerified: false, // Email verification handled by approval
      disabled: true, // Disable account until approved
    });

    const approvalToken = randomBytes(32).toString('hex');
    const userProfile: UserProfile = {
      uid: userRecord.uid,
      email,
      isApproved: false,
      approvalToken,
      createdAt: new Date(),
    };

    await adminFirestore.collection('users').doc(userRecord.uid).set(userProfile);

    // Send approval email
    const approvalLink = `${APP_BASE_URL}/api/auth/approve?token=${approvalToken}`;
    await sendMail({
      to: APPROVER_EMAIL!,
      subject: 'Novo Usuário Aguardando Aprovação',
      text: `Um novo usuário registrou-se e precisa de aprovação.\n\nEmail: ${email}\nUID: ${userRecord.uid}\n\nPara aprovar, clique no link: ${approvalLink}`,
      html: `<p>Um novo usuário registrou-se e precisa de aprovação.</p>
             <p><strong>Email:</strong> ${email}</p>
             <p><strong>UID:</strong> ${userRecord.uid}</p>
             <p>Para aprovar, clique no link: <a href="${approvalLink}">${approvalLink}</a></p>`,
    });

    return { message: 'Registro realizado! Aguarde a aprovação do administrador.', status: 'success' };
  } catch (error: any) {
    console.error('Error registering user:', error);
    if (error.code === 'auth/email-already-exists') {
      return { message: 'Este email já está registrado.', status: 'error' };
    }
    return { message: error.message || 'Falha ao registrar. Tente novamente.', status: 'error' };
  }
}


export async function approveUserByToken(token: string): Promise<{ success: boolean; message: string }> {
  if (!adminFirestore || !adminAuth) {
    return { success: false, message: 'Configuração do servidor Firebase ausente.' };
  }
  try {
    const usersRef = adminFirestore.collection('users');
    const snapshot = await usersRef.where('approvalToken', '==', token).limit(1).get();

    if (snapshot.empty) {
      return { success: false, message: 'Token de aprovação inválido ou já utilizado.' };
    }

    const userDoc = snapshot.docs[0];
    const userData = userDoc.data() as UserProfile;

    if (userData.isApproved) {
      return { success: false, message: 'Usuário já aprovado.' };
    }

    await adminAuth.updateUser(userData.uid, {
      disabled: false, // Enable the account
    });
    
    await userDoc.ref.update({
      isApproved: true,
      approvedAt: FieldValue.serverTimestamp(),
      approvalToken: FieldValue.delete(), // Remove token after use
    });

    // Optionally, send a confirmation email to the user
    try {
       await sendMail({
        to: userData.email,
        subject: 'Sua conta foi aprovada!',
        text: `Olá ${userData.email},\n\nSua conta no Collection Gap Analyzer foi aprovada. Agora você pode fazer login.\n\n${APP_BASE_URL}/login`,
        html: `<p>Olá ${userData.email},</p><p>Sua conta no Collection Gap Analyzer foi aprovada. Agora você pode fazer login em <a href="${APP_BASE_URL}/login">${APP_BASE_URL}/login</a>.</p>`,
      });
    } catch (emailError) {
      console.error("Failed to send approval confirmation email to user:", emailError);
      // Do not fail the whole approval process if email sending fails
    }


    return { success: true, message: `Usuário ${userData.email} aprovado com sucesso!` };
  } catch (error: any) {
    console.error('Error approving user:', error);
    return { success: false, message: error.message || 'Falha ao aprovar usuário.' };
  }
}
