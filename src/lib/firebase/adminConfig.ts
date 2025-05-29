
// REMOVED: 'use server'; directive. This file is a server-side utility, not a Server Actions module.

import * as admin from 'firebase-admin';
import path from 'path';
import fs from 'fs';

console.log('--- [ADMIN SDK INIT - ATTEMPTING INITIALIZATION] ---');
console.log(`[Admin SDK] Node Env: ${process.env.NODE_ENV}`);
console.log(`[Admin SDK] Initial admin.apps.length: ${admin.apps ? admin.apps.length : 'admin.apps is undefined'}`);

let adminApp: admin.app.App | undefined;
export let adminSDKInitializationError: string | null = null;

// Check if the firebase-admin module itself and essential functions are loaded
if (!admin || !admin.credential || typeof admin.credential.cert !== 'function' || typeof admin.initializeApp !== 'function') {
  adminSDKInitializationError = "CRITICAL: The 'firebase-admin' module is not loaded correctly or essential parts are missing.";
  console.error(`[Admin SDK Init Error] ${adminSDKInitializationError}`);
} else if (admin.apps.length > 0) {
  adminApp = admin.apps.find(app => app?.name === '[DEFAULT]') || admin.apps[0];
  if (adminApp) {
    console.log(`[Admin SDK] Using existing Firebase admin app: ${adminApp.name}. Project ID from existing app: ${adminApp.options.projectId}. Total apps: ${admin.apps.length}`);
    if (adminApp.options.projectId !== process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID) {
        console.warn(`[Admin SDK] WARNING: Existing default app's projectId ('${adminApp.options.projectId}') does not match NEXT_PUBLIC_FIREBASE_PROJECT_ID ('${process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID}'). This might indicate a configuration mismatch if a new initialization was expected.`);
    }
    adminSDKInitializationError = null;
  } else {
    adminSDKInitializationError = "[Admin SDK] admin.apps array is not empty, but no suitable default app found. This is an unusual state.";
    console.warn(`[Admin SDK Init Warning] ${adminSDKInitializationError}`);
    // Attempt to initialize a new one if no default is truly usable.
  }
}

// If no app is effectively initialized yet, attempt to initialize from service account file
if (!adminApp && !adminSDKInitializationError) {
  console.log("[Admin SDK] No existing admin app identified or usable. Attempting new initialization from service account file.");
  const serviceAccountPath = process.env.FIREBASE_ADMIN_SDK_CONFIG_PATH;
  console.log(`[Admin SDK] FIREBASE_ADMIN_SDK_CONFIG_PATH environment variable: '${serviceAccountPath}'`);

  if (serviceAccountPath && serviceAccountPath.trim() !== '') {
    const absolutePath = path.resolve(process.cwd(), serviceAccountPath.trim());
    console.log(`[Admin SDK] Resolved absolute path for service account key: ${absolutePath}`);

    if (fs.existsSync(absolutePath)) {
      console.log(`[Admin SDK] Service account file FOUND at: ${absolutePath}`);
      try {
        const serviceAccountFileContent = fs.readFileSync(absolutePath, 'utf8');
        console.log('[Admin SDK] Service account file content read successfully.');

        const serviceAccountCredentials = JSON.parse(serviceAccountFileContent);
        console.log('[Admin SDK] Service account file content parsed as JSON successfully.');

        const expectedProjectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
        console.log(`[Admin SDK] Project ID from serviceAccountKey.json: ${serviceAccountCredentials.project_id}`);
        console.log(`[Admin SDK] Expected Project ID from NEXT_PUBLIC_FIREBASE_PROJECT_ID: ${expectedProjectId}`);

        const essentialFields = ['type', 'project_id', 'private_key', 'client_email'];
        const missingFields = essentialFields.filter(field => !(field in serviceAccountCredentials) || !serviceAccountCredentials[field]);

        if (missingFields.length > 0) {
          adminSDKInitializationError = `Parsed service account JSON is missing or has empty essential fields: ${missingFields.join(', ')}. Path: ${absolutePath}. Please verify the content of your serviceAccountKey.json.`;
          console.error(`[Admin SDK Init Error] ${adminSDKInitializationError}`);
        } else if (expectedProjectId && serviceAccountCredentials.project_id !== expectedProjectId) {
          adminSDKInitializationError = `CRITICAL MISMATCH: Project ID in serviceAccountKey.json ('${serviceAccountCredentials.project_id}') does NOT match the expected project ID from NEXT_PUBLIC_FIREBASE_PROJECT_ID ('${expectedProjectId}'). Please ensure you are using the service account key for the correct Firebase project.`;
          console.error(`[Admin SDK Init Error] ${adminSDKInitializationError}`);
        } else {
          console.log(`[Admin SDK] Parsed credentials have essential fields. Project ID: ${serviceAccountCredentials.project_id}, Type: ${serviceAccountCredentials.type}.`);
          console.log('[Admin SDK] Attempting to create credential with admin.credential.cert()...');

          const credential = admin.credential.cert(serviceAccountCredentials);

          if (!credential) {
            adminSDKInitializationError = `admin.credential.cert(serviceAccountCredentials) returned a falsy value. This indicates a problem with the service account credentials object. Path: ${absolutePath}`;
            console.error(`[Admin SDK Init Error] ${adminSDKInitializationError}`);
          } else {
            console.log('[Admin SDK] Credential object created successfully by admin.credential.cert().');
            console.log('[Admin SDK] Attempting admin.initializeApp() with a unique name...');

            const appName = `firebase-admin-app-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
            adminApp = admin.initializeApp({
              credential,
            }, appName); // Use a unique name to avoid conflicts

            console.log(`[Admin SDK] admin.initializeApp() called for app name: ${appName}. Resulting adminApp: ${adminApp ? 'Assigned' : 'NOT Assigned'}`);
            console.log(`[Admin SDK] Project ID from initialized app: ${adminApp?.options.projectId}`);
            console.log(`[Admin SDK] Total admin apps after initialization attempt: ${admin.apps.length}`);

            if (adminApp && adminApp.options.projectId === serviceAccountCredentials.project_id) {
                adminSDKInitializationError = null;
                console.log(`[Admin SDK] Successfully initialized a new Firebase admin app: ${appName} for project '${serviceAccountCredentials.project_id}'.`);
            } else {
                adminSDKInitializationError = `Firebase Admin SDK initialization for app '${appName}' did not result in a retrievable app or has incorrect project ID. Expected '${serviceAccountCredentials.project_id}', Got '${adminApp?.options.projectId}'.`;
                console.error(`[Admin SDK Init Error] ${adminSDKInitializationError}`);
                adminApp = undefined; // Ensure adminApp is undefined if init failed
            }
          }
        }
      } catch (e: any) {
        console.error(`[Admin SDK Init Error] FAILED during initialization from file path: ${absolutePath}. Error:`, e);
        adminSDKInitializationError = `Failed to initialize Admin SDK from service account file. Path: ${absolutePath}. Error: ${e.message || String(e)}. Stack: ${e.stack || 'No stack trace'}. Ensure the file exists, is readable, and contains valid JSON.`;
      }
    } else {
      console.error(`[Admin SDK Init Error] Service account file NOT FOUND at: ${absolutePath}.`);
      adminSDKInitializationError = `Service account file not found at: ${absolutePath}. Check FIREBASE_ADMIN_SDK_CONFIG_PATH in .env and file location. CWD: ${process.cwd()}`;
    }
  } else if (!adminSDKInitializationError) { // Only set this if no other error has occurred
    console.log('[Admin SDK] FIREBASE_ADMIN_SDK_CONFIG_PATH not set or is empty. Cannot initialize Admin SDK from file.');
    adminSDKInitializationError = 'FIREBASE_ADMIN_SDK_CONFIG_PATH environment variable not set or empty. Cannot initialize Admin SDK.';
  }
}


if (!adminApp && !adminSDKInitializationError) {
  // This is a fallback error if somehow no app was initialized and no specific error was caught.
  adminSDKInitializationError = 'Firebase Admin SDK app could not be initialized, and no specific error was caught during the file path attempt. This usually means the initial module check failed or an existing app was expected but not found suitable.';
  console.error(`[Admin SDK Init Error] ${adminSDKInitializationError}`);
}

export const adminAuth = adminApp ? adminApp.auth() : null;
export const adminFirestore = adminApp ? adminApp.firestore() : null;

if (!adminApp) {
  console.error("[Admin SDK] CRITICAL: adminApp is undefined after all initialization attempts. Admin SDK is NOT operational.");
}
if (adminApp && !adminAuth) {
  console.warn("[Admin SDK] WARNING: adminAuth is null, but adminApp exists. Authentication-related server actions will likely fail.");
}
if (adminApp && !adminFirestore) {
  console.warn("[Admin SDK] WARNING: adminFirestore is null, but adminApp exists. Firestore-related server actions will likely fail.");
}

if (adminSDKInitializationError) {
  console.error(`[Admin SDK] Final Initialization Error State: ${adminSDKInitializationError}`);
} else if (adminApp) {
  console.log(`[Admin SDK] Admin SDK services (Auth, Firestore) should be available. App name: ${adminApp.name}. Project ID: ${adminApp.options.projectId}. Total apps in admin.apps: ${admin.apps.length}`);
} else {
  // Should be caught by the specific error message for adminSDKInitializationError being set
  console.error("[Admin SDK] Final State: Admin SDK not initialized, and adminApp is undefined, and no specific error string was set (this is unexpected).");
}
console.log('--- [ADMIN SDK INIT END] ---');
    