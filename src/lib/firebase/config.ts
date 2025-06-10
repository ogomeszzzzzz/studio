
import { initializeApp, getApps, getApp, type FirebaseOptions } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

console.log('[Firebase Client Config V3 - Cloud Run Debug] Reading environment variables for project setup:');
console.log('NEXT_PUBLIC_FIREBASE_API_KEY:', process.env.NEXT_PUBLIC_FIREBASE_API_KEY ? 'SET' : 'NOT SET (CRITICAL FOR CLIENT)');
console.log('NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN:', process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ? 'SET' : 'NOT SET');
console.log('NEXT_PUBLIC_FIREBASE_PROJECT_ID:', process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ? `SET: ${process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID}` : 'NOT SET (CRITICAL FOR CLIENT)');
console.log('NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET:', process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ? 'SET' : 'NOT SET');
console.log('NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID:', process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ? 'SET' : 'NOT SET');
console.log('NEXT_PUBLIC_FIREBASE_APP_ID:', process.env.NEXT_PUBLIC_FIREBASE_APP_ID ? 'SET' : 'NOT SET');

const firebaseConfig: FirebaseOptions = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

let clientApp;
export let firestoreClientInitializationError: string | null = null;

if (!firebaseConfig.projectId) {
  firestoreClientInitializationError = "CRITICAL CLIENT ERROR: NEXT_PUBLIC_FIREBASE_PROJECT_ID is not set. Firebase client cannot be initialized.";
  console.error(`[Firebase Client Config V3] ${firestoreClientInitializationError}`);
} else if (firebaseConfig.projectId !== 'ecommerce-db-75f77') {
  firestoreClientInitializationError = `CRITICAL CLIENT ERROR: NEXT_PUBLIC_FIREBASE_PROJECT_ID is '${firebaseConfig.projectId}', but it MUST be 'ecommerce-db-75f77'.`;
  console.error(`[Firebase Client Config V3] ${firestoreClientInitializationError}`);
} else if (!firebaseConfig.apiKey) {
  firestoreClientInitializationError = "CRITICAL CLIENT ERROR: NEXT_PUBLIC_FIREBASE_API_KEY is not set. Firebase client cannot be initialized.";
  console.error(`[Firebase Client Config V3] ${firestoreClientInitializationError}`);
}

if (!firestoreClientInitializationError) {
  if (!getApps().length) {
    console.log('[Firebase Client Config V3] No Firebase apps initialized. Initializing new app...');
    try {
      clientApp = initializeApp(firebaseConfig);
      console.log(`[Firebase Client Config V3] Firebase app initialized successfully. Project ID: ${clientApp.options.projectId}`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`[Firebase Client Config V3] Error initializing Firebase app:`, errorMessage);
      firestoreClientInitializationError = `Failed to initialize Firebase client app: ${errorMessage}`;
      clientApp = null; // Ensure clientApp is null if init fails
    }
  } else {
    clientApp = getApp();
    console.log(`[Firebase Client Config V3] Firebase app already initialized. Using existing app. Project ID: ${clientApp.options.projectId}`);
    if (clientApp.options.projectId !== 'ecommerce-db-75f77') {
        firestoreClientInitializationError = `CRITICAL CLIENT ERROR: Existing Firebase app is for project '${clientApp.options.projectId}', but expected 'ecommerce-db-75f77'. This can happen with HMR. Please restart the dev server.`;
        console.error(`[Firebase Client Config V3] ${firestoreClientInitializationError}`);
        clientApp = null; // Invalidate if wrong project
    }
  }
} else {
  clientApp = null; // Ensure clientApp is null if there was a config error
  console.error('[Firebase Client Config V3] Firebase app not initialized due to configuration errors listed above.');
}

// Initialize Firestore for the (default) database
const firestore = clientApp ? getFirestore(clientApp) : null;

if (clientApp && !firestore) {
    console.error('[Firebase Client Config V3] Client app initialized, but Firestore instance could not be obtained.');
    if (!firestoreClientInitializationError) {
        firestoreClientInitializationError = 'Firestore instance could not be obtained even though Firebase App seems initialized.';
    }
} else if (firestore) {
    console.log(`[Firebase Client Config V3] Firestore instance obtained for (default) database of project: ${clientApp?.options.projectId}.`);
} else {
    console.log('[Firebase Client Config V3] Firestore instance is null. This is expected if clientApp is null or initialization failed.');
}

export { clientApp, firestore };
