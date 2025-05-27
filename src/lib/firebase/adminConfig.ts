
import * as admin from 'firebase-admin';
import path from 'path';
import fs from 'fs';

console.log('[Firebase Admin SDK] Attempting to initialize...');

let initialized = false;

if (admin.apps.length > 0) {
  console.log('[Firebase Admin SDK] Already initialized.');
  initialized = true;
}

// Log environment variables related to Firebase Admin SDK
const serviceAccountPathEnv = process.env.FIREBASE_ADMIN_SDK_CONFIG_PATH;
const serviceAccountStringEnv = process.env.FIREBASE_ADMIN_SDK_CONFIG;
const projectIdEnv = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
const emulatorHostEnv = process.env.FIREBASE_AUTH_EMULATOR_HOST;

console.log(`[Firebase Admin SDK] FIREBASE_ADMIN_SDK_CONFIG_PATH: ${serviceAccountPathEnv}`);
console.log(`[Firebase Admin SDK] FIREBASE_ADMIN_SDK_CONFIG (length): ${serviceAccountStringEnv ? serviceAccountStringEnv.length : 'Not set'}`);
console.log(`[Firebase Admin SDK] NEXT_PUBLIC_FIREBASE_PROJECT_ID: ${projectIdEnv}`);
console.log(`[Firebase Admin SDK] FIREBASE_AUTH_EMULATOR_HOST: ${emulatorHostEnv}`);

// Attempt 1: Initialize from file path (FIREBASE_ADMIN_SDK_CONFIG_PATH)
if (!initialized && serviceAccountPathEnv) {
  console.log(`[Firebase Admin SDK] Attempting initialization from file path: ${serviceAccountPathEnv}`);
  try {
    const absolutePath = path.resolve(process.cwd(), serviceAccountPathEnv);
    console.log(`[Firebase Admin SDK] Resolved absolute path: ${absolutePath}`);

    if (fs.existsSync(absolutePath)) {
      console.log(`[Firebase Admin SDK] Service account file found at: ${absolutePath}`);
      admin.initializeApp({
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
    console.error('Stack:', error.stack);
  }
} else if (!initialized) {
  console.log('[Firebase Admin SDK] FIREBASE_ADMIN_SDK_CONFIG_PATH not set or already initialized. Skipping file path initialization.');
}

// Attempt 2: Initialize from JSON string (FIREBASE_ADMIN_SDK_CONFIG)
// Only attempt if not already initialized and the string is actually provided
if (!initialized && serviceAccountStringEnv && serviceAccountStringEnv.trim() !== '') {
  console.log('[Firebase Admin SDK] Attempting initialization from JSON string (FIREBASE_ADMIN_SDK_CONFIG)...');
  try {
    const serviceAccount = JSON.parse(serviceAccountStringEnv);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
    console.log('[Firebase Admin SDK] Initialized successfully from JSON string.');
    initialized = true;
  } catch (error: any) {
    console.error('[Firebase Admin SDK] Error initializing from JSON string:');
    console.error('Error Name:', error.name);
    console.error('Error Message:', error.message);
    console.error('Error Code:', error.code);
    console.error('Stack:', error.stack);
    console.warn('[Firebase Admin SDK] Ensure FIREBASE_ADMIN_SDK_CONFIG in your .env file is a valid JSON string, with newlines in private_key escaped as \\\\n if using this method.');
  }
} else if (!initialized) {
  console.log('[Firebase Admin SDK] FIREBASE_ADMIN_SDK_CONFIG not set, is empty, or already initialized. Skipping JSON string initialization.');
}

// Attempt 3: Emulator check (if not initialized and in non-production environment)
if (!initialized && process.env.NODE_ENV !== 'production' && emulatorHostEnv) {
  console.log('[Firebase Admin SDK] Attempting initialization for emulators (no service account)...');
  if (!projectIdEnv) {
    console.error('[Firebase Admin SDK] NEXT_PUBLIC_FIREBASE_PROJECT_ID is required for emulator initialization but not set.');
  } else {
    try {
      admin.initializeApp({
        projectId: projectIdEnv,
      });
      console.log(`[Firebase Admin SDK] Initialized for emulators with projectId: ${projectIdEnv}.`);
      initialized = true;
    } catch (emulatorError: any) {
      console.error('[Firebase Admin SDK] Error initializing for emulators:');
      console.error('Error Name:', emulatorError.name);
      console.error('Error Message:', emulatorError.message);
      console.error('Error Code:', emulatorError.code);
      console.error('Stack:', emulatorError.stack);
    }
  }
} else if (!initialized) {
  console.log('[Firebase Admin SDK] Not in development with emulator, or already initialized. Skipping emulator initialization.');
}


if (!initialized) {
  console.error('--------------------------------------------------------------------');
  console.error('[Firebase Admin SDK] FAILED TO INITIALIZE after all attempts.');
  console.error('Please check server logs for details and ensure your environment variables are correctly set.');
  console.error('Most common issues:');
  console.error('1. If using FIREBASE_ADMIN_SDK_CONFIG_PATH: Ensure the path is correct and the JSON file is valid.');
  console.error('2. If using FIREBASE_ADMIN_SDK_CONFIG (string): Ensure it\'s a valid JSON string with properly escaped newlines (\\\\n for \\n).');
  console.error('--------------------------------------------------------------------');
} else {
  console.log(`[Firebase Admin SDK] Successfully initialized. Total apps: ${admin.apps.length}.`);
}

const adminAuth = admin.apps.length ? admin.auth() : null;
const adminFirestore = admin.apps.length ? admin.firestore() : null;

if (!adminAuth) {
  console.warn('[Firebase Admin SDK] adminAuth is null. User registration and approval might fail if SDK did not initialize.');
}
if (!adminFirestore) {
  console.warn('[Firebase Admin SDK] adminFirestore is null. User profile operations might fail if SDK did not initialize.');
}

export { adminAuth, adminFirestore };
