
import * as admin from 'firebase-admin';
import path from 'path';
import fs from 'fs';

console.log('--- [ADMIN SDK INIT START] ---');
console.log(`[Admin SDK] Node Env: ${process.env.NODE_ENV}`);
console.log(`[Admin SDK] Initial admin.apps.length: ${admin.apps.length}`);

let adminApp: admin.app.App | undefined;
let adminSDKInitializationError: string | null = null;

// Prioritize using an existing default app if available
if (admin.apps.length > 0) {
  adminApp = admin.apps.find(app => app?.name === '[DEFAULT]') || admin.apps[0];
  if (adminApp) {
    console.log(`[Admin SDK] Using existing Firebase admin app: ${adminApp.name}.`);
  } else {
    // This case is highly unlikely if admin.apps.length > 0
    console.log("[Admin SDK] admin.apps array is not empty, but no suitable default app found. Will attempt new initialization.");
  }
}

// If no existing app was found or suitable, attempt to initialize a new one.
if (!adminApp) {
  const serviceAccountPath = process.env.FIREBASE_ADMIN_SDK_CONFIG_PATH;
  console.log(`[Admin SDK] FIREBASE_ADMIN_SDK_CONFIG_PATH environment variable: '${serviceAccountPath}'`);

  if (serviceAccountPath && serviceAccountPath.trim() !== '') {
    const currentWorkingDirectory = process.cwd();
    console.log(`[Admin SDK] Current working directory (process.cwd()): ${currentWorkingDirectory}`);
    const absolutePath = path.resolve(currentWorkingDirectory, serviceAccountPath.trim());
    console.log(`[Admin SDK] Resolved absolute path for service account key: ${absolutePath}`);

    if (fs.existsSync(absolutePath)) {
      console.log(`[Admin SDK] Service account file FOUND at: ${absolutePath}`);
      try {
        // Read the file content as a string, then parse it to ensure it's valid JSON.
        const serviceAccountFileContent = fs.readFileSync(absolutePath, 'utf8');
        const serviceAccountCredentials = JSON.parse(serviceAccountFileContent); // This will throw if JSON is malformed

        adminApp = admin.initializeApp({
          credential: admin.credential.cert(serviceAccountCredentials),
        });
        console.log('[Admin SDK] Successfully initialized a new Firebase admin app from file path.');
      } catch (e: any) {
        console.error(`[Admin SDK] FAILED to initialize from file path: ${absolutePath}. Error:`, e);
        adminSDKInitializationError = `Failed to initialize Admin SDK from service account file. Path: ${absolutePath}. Error: ${e.message}. Ensure the file exists, is readable, and contains valid JSON credentials.`;
      }
    } else {
      console.error(`[Admin SDK] Service account file NOT FOUND at: ${absolutePath}.`);
      adminSDKInitializationError = `Service account file not found at: ${absolutePath}. Check FIREBASE_ADMIN_SDK_CONFIG_PATH in .env and file location. CWD: ${currentWorkingDirectory}`;
    }
  } else {
    console.log('[Admin SDK] FIREBASE_ADMIN_SDK_CONFIG_PATH not set or is empty. Cannot initialize Admin SDK from file.');
    adminSDKInitializationError = 'FIREBASE_ADMIN_SDK_CONFIG_PATH environment variable not set or empty. Cannot initialize Admin SDK.';
  }
}

if (!adminApp && !adminSDKInitializationError) {
  // Fallback error if initialization failed silently
  adminSDKInitializationError = 'Firebase Admin SDK app could not be initialized, and no specific error was caught during file path attempt. Check previous logs and admin.apps length.';
  console.error(`[Admin SDK] ${adminSDKInitializationError}`);
} else if(adminApp) {
  // Clear error if app was found or initialized successfully
  adminSDKInitializationError = null;
}


const adminAuth = adminApp ? adminApp.auth() : null;
const adminFirestore = adminApp ? adminApp.firestore() : null;

if (!adminAuth || !adminFirestore) {
  const finalErrorMessage = adminSDKInitializationError || "Unknown reason (adminApp might be undefined after all attempts)";
  console.warn(`[Admin SDK] CRITICAL WARNING: adminAuth or adminFirestore is null. Initialization has FAILED. Error: ${finalErrorMessage}`);
  // Ensure adminSDKInitializationError reflects this critical failure state if it wasn't set before
  if (!adminSDKInitializationError) adminSDKInitializationError = finalErrorMessage;
} else {
  console.log(`[Admin SDK] Admin SDK services (Auth, Firestore) are available. App name: ${adminApp?.name}`);
}

console.log('--- [ADMIN SDK INIT END] ---');

export { adminAuth, adminFirestore, adminSDKInitializationError };
