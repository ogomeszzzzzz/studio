
import { initializeApp, getApps, getApp, type FirebaseOptions } from 'firebase/app';
// Do NOT import getAuth from 'firebase/auth' here anymore
import { getFirestore } from 'firebase/firestore';

console.log('[Firebase Client Config] Reading environment variables for project setup:');
console.log('NEXT_PUBLIC_FIREBASE_API_KEY:', process.env.NEXT_PUBLIC_FIREBASE_API_KEY ? 'SET' : 'NOT SET');
console.log('NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN:', process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ? 'SET' : 'NOT SET');
console.log('NEXT_PUBLIC_FIREBASE_PROJECT_ID:', process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID); // Log the actual value for this
console.log('NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET:', process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ? 'SET' : 'NOT SET');
console.log('NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID:', process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ? 'SET' : 'NOT SET');
console.log('NEXT_PUBLIC_FIREBASE_APP_ID:', process.env.NEXT_PUBLIC_FIREBASE_APP_ID ? 'SET' : 'NOT SET');
console.log('NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID:', process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID ? 'SET' : 'NOT SET');


const firebaseConfig: FirebaseOptions = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID, // THIS MUST BE 'ecommerce-db-75f77'
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

let clientApp;

if (!firebaseConfig.projectId || firebaseConfig.projectId !== 'ecommerce-db-75f77') {
  console.error(`[Firebase Client Config] CRITICAL ERROR: NEXT_PUBLIC_FIREBASE_PROJECT_ID is '${firebaseConfig.projectId}', but it MUST be 'ecommerce-db-75f77'. Please correct your .env file.`);
  // Optionally throw an error or prevent initialization if the projectId is wrong.
}


if (!getApps().length) {
  console.log('[Firebase Client Config] Initializing Firebase app...');
  try {
    clientApp = initializeApp(firebaseConfig);
    console.log(`[Firebase Client Config] Firebase app initialized successfully for project: ${firebaseConfig.projectId}.`);
  } catch (error) {
    console.error(`[Firebase Client Config] Error initializing Firebase app for project '${firebaseConfig.projectId}':`, error);
    throw error;
  }
} else {
  clientApp = getApp();
  console.log(`[Firebase Client Config] Firebase app already initialized, getting existing app for project: ${clientApp.options.projectId}.`);
}

const firestore = getFirestore(clientApp, "ecom"); // Explicitly connect to "ecom" database
console.log(`[Firebase Client Config] Connected to Firestore database ID: ecom for project: ${clientApp.options.projectId}`);


export { clientApp, firestore };

    