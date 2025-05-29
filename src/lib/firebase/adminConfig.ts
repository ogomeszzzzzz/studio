
// REMOVED: 'use server'; directive. This file is a server-side utility, not a Server Actions module.

import * as admin from 'firebase-admin';
import path from 'path';
import fs from 'fs';

console.log('--- [ADMIN SDK INIT - ATTEMPTING INITIALIZATION V5] ---');
console.log(`[Admin SDK] Node Env: ${process.env.NODE_ENV}`);
console.log(`[Admin SDK] Initial admin.apps.length: ${admin.apps ? admin.apps.length : 'admin.apps is undefined'}`);

let adminApp: admin.app.App | undefined;
export let adminSDKInitializationError: string | null = null;

const expectedProjectId = "ecommerce-db-75f77"; // Define the expected project ID

if (!admin || !admin.credential || typeof admin.credential.cert !== 'function' || typeof admin.initializeApp !== 'function') {
  adminSDKInitializationError = "CRITICAL: The 'firebase-admin' module is not loaded correctly or essential parts are missing.";
  console.error(`[Admin SDK Init Error] ${adminSDKInitializationError}`);
} else {
  console.log("[Admin SDK] Attempting new initialization from service account file, ignoring existing apps to ensure correct project.");
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
        console.log(`[Admin SDK] Project ID from serviceAccountKey.json: ${serviceAccountCredentials.project_id}`);
        console.log(`[Admin SDK] Expected Project ID: ${expectedProjectId}`);

        const essentialFields = ['type', 'project_id', 'private_key', 'client_email'];
        const missingFields = essentialFields.filter(field => !(field in serviceAccountCredentials) || !serviceAccountCredentials[field]);

        if (missingFields.length > 0) {
          adminSDKInitializationError = `Parsed service account JSON is missing or has empty essential fields: ${missingFields.join(', ')}. Path: ${absolutePath}. Please verify the content of your serviceAccountKey.json.`;
          console.error(`[Admin SDK Init Error] ${adminSDKInitializationError}`);
        } else if (serviceAccountCredentials.project_id !== expectedProjectId) {
          adminSDKInitializationError = `CRITICAL MISMATCH: Project ID in serviceAccountKey.json ('${serviceAccountCredentials.project_id}') does NOT match the expected project ID ('${expectedProjectId}'). Please ensure you are using the service account key for the correct Firebase project.`;
          console.error(`[Admin SDK Init Error] ${adminSDKInitializationError}`);
        } else {
          console.log(`[Admin SDK] Parsed credentials have essential fields and correct Project ID: ${serviceAccountCredentials.project_id}.`);
          console.log('[Admin SDK] Attempting to create credential with admin.credential.cert()...');

          const credential = admin.credential.cert(serviceAccountCredentials);

          if (!credential) {
            adminSDKInitializationError = `admin.credential.cert(serviceAccountCredentials) returned a falsy value. This indicates a problem with the service account credentials object. Path: ${absolutePath}`;
            console.error(`[Admin SDK Init Error] ${adminSDKInitializationError}`);
          } else {
            console.log('[Admin SDK] Credential object created successfully by admin.credential.cert().');
            
            // Generate a unique app name to force a new instance
            const appName = `firebase-admin-app-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
            console.log(`[Admin SDK] Attempting admin.initializeApp() with unique name: ${appName}`);

            try {
              adminApp = admin.initializeApp({
                credential,
                // Optionally, you can force the projectId here if really needed, but cert() should handle it
                // projectId: expectedProjectId, 
              }, appName); // Use a unique name

              console.log(`[Admin SDK] admin.initializeApp() called for app name: ${appName}. Resulting adminApp: ${adminApp ? 'Assigned' : 'NOT Assigned'}`);
              console.log(`[Admin SDK] Project ID from initialized app: ${adminApp?.options.projectId}`);
              console.log(`[Admin SDK] Total admin apps after initialization attempt: ${admin.apps.length}`);

              if (adminApp && adminApp.options.projectId === expectedProjectId) {
                  adminSDKInitializationError = null;
                  console.log(`[Admin SDK] Successfully initialized a new Firebase admin app: ${appName} for project '${expectedProjectId}'.`);
              } else {
                  const effectiveProjectId = adminApp?.options.projectId || "unknown";
                  adminSDKInitializationError = `Firebase Admin SDK initialization for app '${appName}' did not result in a retrievable app with the correct project ID. Expected '${expectedProjectId}', Got '${effectiveProjectId}'.`;
                  console.error(`[Admin SDK Init Error] ${adminSDKInitializationError}`);
                  adminApp = undefined; // Ensure adminApp is undefined if init failed
              }
            } catch (initError: any) {
                console.error(`[Admin SDK Init Error] FAILED during admin.initializeApp() for app '${appName}'. Error:`, initError);
                adminSDKInitializationError = `Failed to initialize Firebase Admin App '${appName}'. Error: ${initError.message || String(initError)}.`;
                adminApp = undefined;
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
  } else if (!adminSDKInitializationError) {
    console.log('[Admin SDK] FIREBASE_ADMIN_SDK_CONFIG_PATH not set or is empty. Cannot initialize Admin SDK from file.');
    adminSDKInitializationError = 'FIREBASE_ADMIN_SDK_CONFIG_PATH environment variable not set or empty. Cannot initialize Admin SDK.';
  }
}


if (!adminApp && !adminSDKInitializationError) {
  adminSDKInitializationError = 'Firebase Admin SDK app could not be initialized, and no specific error was caught. This usually means the initial module check failed or an existing app was expected but not found suitable.';
  console.error(`[Admin SDK Init Error] ${adminSDKInitializationError}`);
}

export const adminAuth = adminApp ? adminApp.auth() : null;
export const adminFirestore = adminApp ? adminApp.firestore() : null; // Firestore will be for the same project as adminApp

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
  console.error("[Admin SDK] Final State: Admin SDK not initialized, and adminApp is undefined, and no specific error string was set (this is unexpected).");
}
console.log('--- [ADMIN SDK INIT END V5] ---');
    