
import * as admin from 'firebase-admin';
import path from 'path';
import fs from 'fs';

console.log('[Firebase Admin SDK] Attempting to initialize...');

let initialized = false;
let adminApp: admin.app.App | undefined;

if (admin.apps.length > 0) {
  adminApp = admin.apps.find(app => app?.name === '[DEFAULT]'); // Or your specific app name if not default
  if (adminApp) {
    console.log('[Firebase Admin SDK] Already initialized, using existing default app.');
    initialized = true;
  } else {
    // This case is unlikely if admin.apps.length > 0 but good to be defensive
    console.log('[Firebase Admin SDK] Apps exist, but default app not found. Will attempt re-initialization.');
  }
}

// Log environment variables related to Firebase Admin SDK
const serviceAccountPathEnv = process.env.FIREBASE_ADMIN_SDK_CONFIG_PATH;
const serviceAccountStringEnv = process.env.FIREBASE_ADMIN_SDK_CONFIG;
const projectIdEnv = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID; // Used for emulator or if no service account
const emulatorHostEnv = process.env.FIREBASE_AUTH_EMULATOR_HOST;

console.log(`[Firebase Admin SDK] FIREBASE_ADMIN_SDK_CONFIG_PATH: ${serviceAccountPathEnv}`);
console.log(`[Firebase Admin SDK] FIREBASE_ADMIN_SDK_CONFIG (length): ${serviceAccountStringEnv ? serviceAccountStringEnv.length : 'Not set'}`);
console.log(`[Firebase Admin SDK] NEXT_PUBLIC_FIREBASE_PROJECT_ID: ${projectIdEnv}`);
console.log(`[Firebase Admin SDK] FIREBASE_AUTH_EMULATOR_HOST: ${emulatorHostEnv}`);


// Attempt 1: Initialize from file path (FIREBASE_ADMIN_SDK_CONFIG_PATH)
if (!initialized && serviceAccountPathEnv) {
  console.log(`[Firebase Admin SDK] Attempting initialization from file path: ${serviceAccountPathEnv}`);
  try {
    const absolutePath = path.isAbsolute(serviceAccountPathEnv) ? serviceAccountPathEnv : path.resolve(process.cwd(), serviceAccountPathEnv);
    console.log(`[Firebase Admin SDK] Resolved absolute path: ${absolutePath}`);

    if (fs.existsSync(absolutePath)) {
      console.log(`[Firebase Admin SDK] Service account file found at: ${absolutePath}`);
      adminApp = admin.initializeApp({
        credential: admin.credential.cert(absolutePath),
      });
      console.log('[Firebase Admin SDK] Initialized successfully from file path.');
      initialized = true;
    } else {
      console.error(`[Firebase Admin SDK] Service account file NOT FOUND at: ${absolutePath}`);
    }
  } catch (error: any) {
    console.error('[Firebase Admin SDK] Error initializing from file path:');
    console.error('Error Name:', error.name);
    console.error('Error Message:', error.message);
    console.error('Error Code:', error.code);
    // console.error('Stack:', error.stack); // Can be very verbose
  }
} else if (!initialized) {
  console.log('[Firebase Admin SDK] FIREBASE_ADMIN_SDK_CONFIG_PATH not set or already initialized. Skipping file path initialization.');
}

// Attempt 2: Initialize from JSON string (FIREBASE_ADMIN_SDK_CONFIG)
if (!initialized && serviceAccountStringEnv && serviceAccountStringEnv.trim() !== '') {
  console.log('[Firebase Admin SDK] Attempting initialization from JSON string (FIREBASE_ADMIN_SDK_CONFIG)...');
  try {
    const serviceAccount = JSON.parse(serviceAccountStringEnv);
    adminApp = admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
    console.log('[Firebase Admin SDK] Initialized successfully from JSON string.');
    initialized = true;
  } catch (error: any) {
    console.error('[Firebase Admin SDK] Error initializing from JSON string:');
    console.error('Error Name:', error.name);
    console.error('Error Message:', error.message);
    console.error('Error Code:', error.code);
    // console.error('Stack:', error.stack);
    console.warn('[Firebase Admin SDK] Ensure FIREBASE_ADMIN_SDK_CONFIG in your .env file is a valid JSON string, with newlines in private_key escaped as \\\\n if using this method.');
  }
} else if (!initialized) {
  console.log('[Firebase Admin SDK] FIREBASE_ADMIN_SDK_CONFIG not set, is empty, or already initialized. Skipping JSON string initialization.');
}


// Attempt 3: Emulator check or default initialization (if not initialized and in non-production environment)
if (!initialized && process.env.NODE_ENV !== 'production') {
    if (emulatorHostEnv) {
        console.log('[Firebase Admin SDK] Attempting initialization for emulators (no service account)...');
        if (!projectIdEnv) {
            console.error('[Firebase Admin SDK] NEXT_PUBLIC_FIREBASE_PROJECT_ID is required for emulator initialization but not set.');
        } else {
            try {
                adminApp = admin.initializeApp({ projectId: projectIdEnv });
                console.log(`[Firebase Admin SDK] Initialized for emulators with projectId: ${projectIdEnv}.`);
                initialized = true;
            } catch (emulatorError: any) {
                console.error('[Firebase Admin SDK] Error initializing for emulators:');
                // console.error(emulatorError);
            }
        }
    } else if (admin.apps.length === 0) { // Fallback to default init if no specific config found and no apps exist
        console.log('[Firebase Admin SDK] No service account or emulator config found. Attempting default initialization (useful for some Google Cloud environments)...');
        try {
            adminApp = admin.initializeApp();
            console.log('[Firebase Admin SDK] Default initialization successful.');
            initialized = true;
        } catch (defaultInitError: any) {
            console.error('[Firebase Admin SDK] Default initialization failed:');
             // console.error(defaultInitError);
        }
    }
} else if (!initialized) {
  console.log('[Firebase Admin SDK] Not in development with emulator, or already initialized, or in production without explicit config. Skipping this initialization block.');
}


if (!initialized && admin.apps.length > 0) {
    console.warn('[Firebase Admin SDK] Initialization attempts failed, but admin.apps array is not empty. This state is unusual.');
    // Attempt to get the default app if it exists
    adminApp = admin.apps.find(app => app?.name === '[DEFAULT]') || admin.apps[0];
    if(adminApp) {
        console.log(`[Firebase Admin SDK] Using a pre-existing app: ${adminApp.name}`);
        initialized = true;
    }
}


if (!initialized) {
  console.error('--------------------------------------------------------------------');
  console.error('[Firebase Admin SDK] FAILED TO INITIALIZE after all attempts.');
  console.error('Please check server logs for details and ensure your environment variables are correctly set.');
  console.error('Most common issues:');
  console.error('1. If using FIREBASE_ADMIN_SDK_CONFIG_PATH: Ensure the path is correct and the JSON file is valid.');
  console.error('2. If using FIREBASE_ADMIN_SDK_CONFIG (string): Ensure it\'s a valid JSON string with properly escaped newlines (\\\\n for \\n).');
  console.error('3. If in a Google Cloud environment, ensure the service account has appropriate IAM permissions for Firebase.');
  console.error('--------------------------------------------------------------------');
} else {
  console.log(`[Firebase Admin SDK] Successfully initialized or using existing app. Total apps: ${admin.apps.length}. App name: ${adminApp?.name}`);
}

// Use the potentially initialized adminApp
const adminAuth = adminApp ? adminApp.auth() : null;
const adminFirestore = adminApp ? adminApp.firestore() : null;

if (!adminAuth && initialized) { // Only warn if initialized but auth is still null (should not happen)
  console.warn('[Firebase Admin SDK] adminAuth is null despite SDK appearing initialized.');
}
if (!adminFirestore && initialized) {
  console.warn('[Firebase Admin SDK] adminFirestore is null despite SDK appearing initialized.');
}

export { adminAuth, adminFirestore };
