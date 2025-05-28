
import { initializeApp, getApps, getApp, type FirebaseOptions } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// CRITICAL: Ensure all these NEXT_PUBLIC_ environment variables are correctly set in your .env file
// The error "auth/api-key-not-valid" specifically points to an issue with NEXT_PUBLIC_FIREBASE_API_KEY.
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
let clientApp;
if (!getApps().length) {
  clientApp = initializeApp(firebaseConfig);
} else {
  clientApp = getApp();
}

const clientAuth = getAuth(clientApp);
const firestore = getFirestore(clientApp);

// Server-side admin SDK initialization is now in adminConfig.ts

export { clientApp, clientAuth, firestore };
