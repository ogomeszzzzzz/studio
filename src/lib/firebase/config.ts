
import { initializeApp, getApps, getApp, FirebaseOptions } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import * as admin from 'firebase-admin';

const firebaseConfig: FirebaseOptions = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID, // Optional
};

// Initialize Firebase for client-side
const clientApp = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const clientAuth = getAuth(clientApp);
const firestore = getFirestore(clientApp);

// Initialize Firebase Admin SDK for server-side
if (!admin.apps.length) {
  try {
    const serviceAccountString = process.env.FIREBASE_ADMIN_SDK_CONFIG;
    if (!serviceAccountString) {
      console.warn(
        'FIREBASE_ADMIN_SDK_CONFIG is not set. Admin SDK features will be limited.'
      );
    } else {
      const serviceAccount = JSON.parse(serviceAccountString);
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
       console.log('Firebase Admin SDK initialized successfully.');
    }
  } catch (error) {
    console.error('Error initializing Firebase Admin SDK:', error);
    const serviceAccount = process.env.FIREBASE_ADMIN_SDK_CONFIG_PATH;
    if(serviceAccount) {
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
    } else if (process.env.NODE_ENV !== 'production' && process.env.FIREBASE_AUTH_EMULATOR_HOST) {
      // This is a common setup for local development with emulators
      // if you're not using a service account file.
      // For actual admin operations, a service account is typically needed.
      admin.initializeApp({
        projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      });
      console.log('Firebase Admin SDK initialized for emulators (no service account).');
    } else {
       console.warn('Firebase Admin SDK could not be initialized. Ensure FIREBASE_ADMIN_SDK_CONFIG or FIREBASE_ADMIN_SDK_CONFIG_PATH is set for admin operations or emulators are configured.');
    }
  }
}

const adminAuth = admin.apps.length ? admin.auth() : null;
const adminFirestore = admin.apps.length ? admin.firestore() : null;


export { clientApp, clientAuth, firestore, adminAuth, adminFirestore };
