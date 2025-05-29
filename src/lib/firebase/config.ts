
import { initializeApp, getApps, getApp, type FirebaseOptions } from 'firebase/app';
// Do NOT import getAuth from 'firebase/auth' here anymore
import { getFirestore } from 'firebase/firestore';

console.log('[Firebase Client Config] Reading environment variables for project setup:');
console.log('NEXT_PUBLIC_FIREBASE_API_KEY:', process.env.NEXT_PUBLIC_FIREBASE_API_KEY ? 'SET' : 'NOT SET');
console.log('NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN:', process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ? 'SET' : 'NOT SET');
console.log('NEXT_PUBLIC_FIREBASE_PROJECT_ID:', process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID);
console.log('NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET:', process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ? 'SET' : 'NOT SET');
console.log('NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID:', process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ? 'SET' : 'NOT SET');
console.log('NEXT_PUBLIC_FIREBASE_APP_ID:', process.env.NEXT_PUBLIC_FIREBASE_APP_ID ? 'SET' : 'NOT SET');
// console.log('NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID:', process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID ? 'SET' : 'NOT SET');


const firebaseConfig: FirebaseOptions = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID, // THIS MUST BE 'ecommerce-db-75f77'
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  // measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID, // Optional
};

let clientApp;
export let firestoreClientInitializationError: string | null = null;

if (!firebaseConfig.projectId) {
  firestoreClientInitializationError = "CRITICAL CLIENT ERROR: NEXT_PUBLIC_FIREBASE_PROJECT_ID is not set in .env. Firebase client cannot be initialized.";
  console.error(`[Firebase Client Config] ${firestoreClientInitializationError}`);
} else if (firebaseConfig.projectId !== 'ecommerce-db-75f77') {
  firestoreClientInitializationError = `CRITICAL CLIENT ERROR: NEXT_PUBLIC_FIREBASE_PROJECT_ID is '${firebaseConfig.projectId}', but it MUST be 'ecommerce-db-75f77'. Please correct your .env file.`;
  console.error(`[Firebase Client Config] ${firestoreClientInitializationError}`);
} else if (!firebaseConfig.apiKey) {
  firestoreClientInitializationError = "CRITICAL CLIENT ERROR: NEXT_PUBLIC_FIREBASE_API_KEY is not set in .env. Firebase client cannot be initialized.";
  console.error(`[Firebase Client Config] ${firestoreClientInitializationError}`);
}


if (!firestoreClientInitializationError) {
  if (!getApps().length) {
    console.log('[Firebase Client Config] Initializing Firebase app...');
    try {
      clientApp = initializeApp(firebaseConfig);
      console.log(`[Firebase Client Config] Firebase app initialized successfully for project: ${firebaseConfig.projectId}.`);
    } catch (error) {
      console.error(`[Firebase Client Config] Error initializing Firebase app for project '${firebaseConfig.projectId}':`, error);
      firestoreClientInitializationError = `Failed to initialize Firebase client app: ${(error as Error).message}`;
      // throw error; // Don't throw, let pages handle the error state
    }
  } else {
    clientApp = getApp();
    console.log(`[Firebase Client Config] Firebase app already initialized, getting existing app for project: ${clientApp.options.projectId}.`);
    if (clientApp.options.projectId !== 'ecommerce-db-75f77') {
        firestoreClientInitializationError = `CRITICAL CLIENT ERROR: Existing Firebase app is for project '${clientApp.options.projectId}', but expected 'ecommerce-db-75f77'. This can happen with HMR. Please restart the dev server.`;
        console.error(`[Firebase Client Config] ${firestoreClientInitializationError}`);
        clientApp = undefined; // Invalidate if wrong project
    }
  }
}

const firestore = clientApp && !firestoreClientInitializationError ? getFirestore(clientApp, "ecom") : null;
if (firestore) {
  console.log(`[Firebase Client Config] Connected to Firestore database ID: ecom for project: ${clientApp?.options.projectId}.`);
} else if (!firestoreClientInitializationError) {
  console.error(`[Firebase Client Config] Firestore could not be initialized for client. clientApp valid: ${!!clientApp}`);
  if (!firestoreClientInitializationError) { // Set error if not already set by config issues
    firestoreClientInitializationError = "Firestore client could not be initialized. Check Firebase app initialization.";
  }
}


export { clientApp, firestore };

    
