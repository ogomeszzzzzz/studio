
import * as admin from 'firebase-admin';

console.log('Attempting to initialize Firebase Admin SDK...');

if (!admin.apps.length) {
  let initialized = false;
  const serviceAccountString = process.env.FIREBASE_ADMIN_SDK_CONFIG;
  const serviceAccountPath = process.env.FIREBASE_ADMIN_SDK_CONFIG_PATH;

  // Attempt 1: Try with JSON string from FIREBASE_ADMIN_SDK_CONFIG
  if (serviceAccountString) {
    console.log('FIREBASE_ADMIN_SDK_CONFIG environment variable found. Attempting to parse and initialize...');
    try {
      const serviceAccount = JSON.parse(serviceAccountString);
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
      console.log('Firebase Admin SDK initialized successfully from FIREBASE_ADMIN_SDK_CONFIG string.');
      initialized = true;
    } catch (error: any) {
      console.error('Error initializing Firebase Admin SDK from FIREBASE_ADMIN_SDK_CONFIG string:');
      console.error('Error message:', error.message);
      console.warn('Please ensure FIREBASE_ADMIN_SDK_CONFIG in your .env file is a valid JSON string, with newlines in the private_key escaped as \\\\n if using this method.');
    }
  } else {
    console.log('FIREBASE_ADMIN_SDK_CONFIG environment variable not set. Skipping direct string initialization.');
  }

  // Attempt 2: Try with file path from FIREBASE_ADMIN_SDK_CONFIG_PATH (if not already initialized)
  if (!initialized && serviceAccountPath) {
    console.log('FIREBASE_ADMIN_SDK_CONFIG_PATH environment variable found:', serviceAccountPath, '. Attempting to initialize...');
    try {
      // The path should be relative to the project root where the Next.js server runs.
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccountPath),
      });
      console.log('Firebase Admin SDK initialized successfully from FIREBASE_ADMIN_SDK_CONFIG_PATH.');
      initialized = true;
    } catch (pathError: any) {
      console.error('Error initializing Firebase Admin SDK from FIREBASE_ADMIN_SDK_CONFIG_PATH:');
      console.error('Error message:', pathError.message);
      console.error('Stack trace:', pathError.stack);
      console.warn(`Ensure the file at '${serviceAccountPath}' exists and is a valid service account JSON key file.`);
    }
  } else if (!initialized) {
    console.log('FIREBASE_ADMIN_SDK_CONFIG_PATH environment variable not set, or already attempted string init.');
  }
  
  // Attempt 3: Emulator check (if not already initialized and in non-production environment)
  if (!initialized && process.env.NODE_ENV !== 'production' && process.env.FIREBASE_AUTH_EMULATOR_HOST) {
    console.log('Attempting to initialize Firebase Admin SDK for emulators (no service account)...');
    try {
        admin.initializeApp({
            projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID, // Make sure this is set for emulators too
        });
        console.log('Firebase Admin SDK initialized for emulators.');
        initialized = true;
    } catch(emulatorError: any) {
        console.error('Error initializing Firebase Admin SDK for emulators:');
        console.error('Error message:', emulatorError.message);
    }
  }
} else {
  console.log('Firebase Admin SDK already initialized.');
}

if (!admin.apps.length) {
  console.error('Firebase Admin SDK FAILED TO INITIALIZE after all attempts. Check server logs for details.');
  console.error('Ensure either FIREBASE_ADMIN_SDK_CONFIG (as a valid JSON string) or FIREBASE_ADMIN_SDK_CONFIG_PATH (to a valid key file) is correctly set in your environment variables.');
}

console.log(`Firebase Admin SDK apps count: ${admin.apps.length}`);

const adminAuth = admin.apps.length ? admin.auth() : null;
const adminFirestore = admin.apps.length ? admin.firestore() : null;

if (!adminAuth) {
    console.warn('adminAuth is null. User registration and approval will fail.');
}
if (!adminFirestore) {
    console.warn('adminFirestore is null. User profile operations will fail.');
}

export { adminAuth, adminFirestore };
