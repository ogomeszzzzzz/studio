
import { initializeApp, getApps, getApp, type FirebaseOptions } from 'firebase/app';
// Do NOT import getAuth from 'firebase/auth' here anymore
import { getFirestore } from 'firebase/firestore';

console.log('[Firebase Client Config] Reading environment variables:');
console.log('NEXT_PUBLIC_FIREBASE_API_KEY:', process.env.NEXT_PUBLIC_FIREBASE_API_KEY);
console.log('NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN:', process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN);
console.log('NEXT_PUBLIC_FIREBASE_PROJECT_ID:', process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID);
console.log('NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET:', process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET);
console.log('NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID:', process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID);
console.log('NEXT_PUBLIC_FIREBASE_APP_ID:', process.env.NEXT_PUBLIC_FIREBASE_APP_ID);
console.log('NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID:', process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID);


const firebaseConfig: FirebaseOptions = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

let clientApp;
if (!getApps().length) {
  console.log('[Firebase Client Config] Initializing Firebase app...');
  try {
    clientApp = initializeApp(firebaseConfig);
    console.log('[Firebase Client Config] Firebase app initialized successfully.');
  } catch (error) {
    console.error('[Firebase Client Config] Error initializing Firebase app:', error);
    throw error;
  }
} else {
  clientApp = getApp();
  console.log('[Firebase Client Config] Firebase app already initialized, getting existing app.');
}

// const clientAuth = getAuth(clientApp); // REMOVED: We are not using Firebase Auth client SDK anymore
const firestore = getFirestore(clientApp, "ecom");
console.log('[Firebase Client Config] Connected to Firestore database ID: ecom');


export { clientApp, firestore }; // REMOVED clientAuth from exports
