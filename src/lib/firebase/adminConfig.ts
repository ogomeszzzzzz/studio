
import * as admin from 'firebase-admin';

console.log('Attempting to initialize Firebase Admin SDK...');

if (!admin.apps.length) {
  const serviceAccountString = process.env.FIREBASE_ADMIN_SDK_CONFIG;

  if (serviceAccountString) {
    console.log('FIREBASE_ADMIN_SDK_CONFIG environment variable found.');
    try {
      // Attempt to parse the service account string.
      // Common issue: newlines in private_key. The .env var should have them as \\n.
      const serviceAccount = JSON.parse(serviceAccountString);
      console.log('Successfully parsed FIREBASE_ADMIN_SDK_CONFIG string.');
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
      console.log('Firebase Admin SDK initialized successfully from FIREBASE_ADMIN_SDK_CONFIG string.');
    } catch (error: any) {
      console.error('Error initializing Firebase Admin SDK from FIREBASE_ADMIN_SDK_CONFIG string:');
      console.error('Error message:', error.message);
      console.error('Stack trace:', error.stack);
      console.warn('Please ensure FIREBASE_ADMIN_SDK_CONFIG in your .env file is a valid JSON string, with newlines in the private_key escaped as \\\\n.');
      
      // Fallback to path if string config fails
      console.log('Attempting fallback to FIREBASE_ADMIN_SDK_CONFIG_PATH...');
      const serviceAccountPath = process.env.FIREBASE_ADMIN_SDK_CONFIG_PATH;
      if (serviceAccountPath) {
        console.log('FIREBASE_ADMIN_SDK_CONFIG_PATH environment variable found:', serviceAccountPath);
        try {
          admin.initializeApp({
            credential: admin.credential.cert(serviceAccountPath),
          });
          console.log('Firebase Admin SDK initialized successfully from FIREBASE_ADMIN_SDK_CONFIG_PATH.');
        } catch (pathError: any) {
          console.error('Error initializing Firebase Admin SDK from FIREBASE_ADMIN_SDK_CONFIG_PATH:');
          console.error('Error message:', pathError.message);
          console.error('Stack trace:', pathError.stack);
        }
      } else {
        console.log('FIREBASE_ADMIN_SDK_CONFIG_PATH environment variable not found.');
      }
    }
  } else {
    console.warn('FIREBASE_ADMIN_SDK_CONFIG environment variable is not set.');
     // Fallback to path if string config is not set at all
    const serviceAccountPath = process.env.FIREBASE_ADMIN_SDK_CONFIG_PATH;
    if (serviceAccountPath) {
      console.log('FIREBASE_ADMIN_SDK_CONFIG_PATH environment variable found:', serviceAccountPath);
      try {
        admin.initializeApp({
          credential: admin.credential.cert(serviceAccountPath),
        });
        console.log('Firebase Admin SDK initialized successfully from FIREBASE_ADMIN_SDK_CONFIG_PATH.');
      } catch (pathError: any) {
        console.error('Error initializing Firebase Admin SDK from FIREBASE_ADMIN_SDK_CONFIG_PATH:');
        console.error('Error message:', pathError.message);
        console.error('Stack trace:', pathError.stack);
      }
    } else {
      console.log('FIREBASE_ADMIN_SDK_CONFIG_PATH environment variable not found.');
    }
  }

  // Emulator check
  if (!admin.apps.length && process.env.NODE_ENV !== 'production' && process.env.FIREBASE_AUTH_EMULATOR_HOST) {
    console.log('Attempting to initialize Firebase Admin SDK for emulators...');
    try {
        admin.initializeApp({
            projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID, // Make sure this is set for emulators too
        });
        console.log('Firebase Admin SDK initialized for emulators (no service account).');
    } catch(emulatorError: any) {
        console.error('Error initializing Firebase Admin SDK for emulators:');
        console.error('Error message:', emulatorError.message);
        console.error('Stack trace:', emulatorError.stack);
    }
  }
} else {
  console.log('Firebase Admin SDK already initialized.');
}

if (!admin.apps.length) {
  console.error('Firebase Admin SDK FAILED TO INITIALIZE after all attempts.');
}

console.log(`Firebase Admin SDK apps count: ${admin.apps.length}`);

const adminAuth = admin.apps.length ? admin.auth() : null;
const adminFirestore = admin.apps.length ? admin.firestore() : null;

if (!adminAuth) {
    console.warn('adminAuth is null after initialization attempts.');
}
if (!adminFirestore) {
    console.warn('adminFirestore is null after initialization attempts.');
}

export { adminAuth, adminFirestore };
