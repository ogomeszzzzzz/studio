
import * as admin from 'firebase-admin';

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
    console.error('Error initializing Firebase Admin SDK from string config:', error);
    // Fallback to path if string config fails or is not preferred.
    const serviceAccountPath = process.env.FIREBASE_ADMIN_SDK_CONFIG_PATH;
    if (serviceAccountPath) {
      try {
        admin.initializeApp({
          credential: admin.credential.cert(serviceAccountPath),
        });
        console.log('Firebase Admin SDK initialized successfully from path.');
      } catch (pathError) {
        console.error('Error initializing Firebase Admin SDK from path:', pathError);
      }
    } else if (process.env.NODE_ENV !== 'production' && process.env.FIREBASE_AUTH_EMULATOR_HOST) {
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

export { adminAuth, adminFirestore };
