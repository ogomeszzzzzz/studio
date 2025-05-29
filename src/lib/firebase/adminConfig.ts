
import * as admin from 'firebase-admin';
import path from 'path';
import fs from 'fs';

console.log('--- [ADMIN SDK INIT - ATTEMPTING INITIALIZATION V8] ---');
console.log(`[Admin SDK] Node Env: ${process.env.NODE_ENV}`);
console.log(`[Admin SDK] Initial admin.apps.length: ${admin.apps ? admin.apps.length : 'admin.apps is undefined'}`);

let adminApp: admin.app.App | undefined;
export let adminSDKInitializationError: string | null = null;

const expectedProjectId = "ecommerce-db-75f77";

if (!admin || !admin.credential || typeof admin.credential.cert !== 'function' || typeof admin.initializeApp !== 'function') {
  adminSDKInitializationError = "CRITICAL: The 'firebase-admin' module is not loaded correctly or essential parts are missing.";
  console.error(`[Admin SDK Init Error] ${adminSDKInitializationError}`);
} else {
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
        console.log(`[Admin SDK] Parsed service account JSON. Project ID from file: ${serviceAccountCredentials.project_id}, Client Email: ${serviceAccountCredentials.client_email}`);

        const essentialFields = ['type', 'project_id', 'private_key', 'client_email'];
        const missingFields = essentialFields.filter(field => !(field in serviceAccountCredentials) || !serviceAccountCredentials[field]);

        if (missingFields.length > 0) {
          adminSDKInitializationError = `Parsed serviceAccountKey.json is missing or has empty essential fields: ${missingFields.join(', ')}. Path: ${absolutePath}.`;
          console.error(`[Admin SDK Init Error] ${adminSDKInitializationError}`);
        } else if (serviceAccountCredentials.project_id !== expectedProjectId) {
          adminSDKInitializationError = `CRITICAL MISMATCH: Project ID in serviceAccountKey.json ('${serviceAccountCredentials.project_id}') does NOT match the expected project ID ('${expectedProjectId}').`;
          console.error(`[Admin SDK Init Error] ${adminSDKInitializationError}`);
        } else {
          console.log(`[Admin SDK] Service account credentials appear valid and match expected project ID. Attempting to create credential object...`);
          const credential = admin.credential.cert(serviceAccountCredentials);

          if (!credential || Object.keys(credential).length === 0) {
            adminSDKInitializationError = `admin.credential.cert(serviceAccountCredentials) returned a falsy or empty credential object. Path: ${absolutePath}`;
            console.error(`[Admin SDK Init Error] ${adminSDKInitializationError}`);
          } else {
            console.log('[Admin SDK] Credential object created successfully by admin.credential.cert().');
            
            const appName = `firebase-admin-app-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
            console.log(`[Admin SDK] Attempting admin.initializeApp() with unique name: ${appName} and explicit projectId: '${serviceAccountCredentials.project_id}'`);

            try {
              adminApp = admin.initializeApp({
                credential,
                projectId: serviceAccountCredentials.project_id,
              }, appName);

              console.log(`[Admin SDK] admin.initializeApp() called for app name: ${appName}. Resulting adminApp: ${adminApp ? 'Assigned' : 'NOT Assigned'}`);
              
              if (adminApp) {
                console.log(`[Admin SDK] adminApp.name: ${adminApp.name}`);
                console.log(`[Admin SDK] adminApp.options.projectId: ${adminApp.options.projectId}`);
              }
              console.log(`[Admin SDK] Total admin apps after initialization attempt: ${admin.apps.length}`);

              if (adminApp && adminApp.options.projectId === expectedProjectId) {
                adminSDKInitializationError = null;
                console.log(`[Admin SDK] Successfully initialized a new Firebase admin app: ${appName} for project '${expectedProjectId}'.`);
              } else {
                const effectiveProjectId = adminApp?.options.projectId || "unknown";
                adminSDKInitializationError = `Firebase Admin SDK initialization for app '${appName}' did not result in a retrievable app with the correct project ID. Expected '${expectedProjectId}', Got '${effectiveProjectId}'. Make sure the service account key is valid and has not been revoked.`;
                if (adminApp && adminApp.options) {
                    console.error(`[Admin SDK Init Error] Full adminApp.options object:`, JSON.stringify(adminApp.options, null, 2));
                }
                console.error(`[Admin SDK Init Error] ${adminSDKInitializationError}`);
                adminApp = undefined;
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
        adminSDKInitializationError = `Failed to initialize Admin SDK from service account file. Path: ${absolutePath}. Error: ${e.message || String(e)}.`;
      }
    } else {
      console.error(`[Admin SDK Init Error] Service account file NOT FOUND at: ${absolutePath}.`);
      adminSDKInitializationError = `Service account file not found at: ${absolutePath}. Check FIREBASE_ADMIN_SDK_CONFIG_PATH. CWD: ${process.cwd()}`;
    }
  } else {
    adminSDKInitializationError = 'FIREBASE_ADMIN_SDK_CONFIG_PATH environment variable not set or empty. Cannot initialize Admin SDK.';
    console.log(`[Admin SDK] ${adminSDKInitializationError}`);
  }
}

if (!adminApp && !adminSDKInitializationError) {
  adminSDKInitializationError = 'Firebase Admin SDK app could not be initialized, and no specific error was caught during the file-based attempt.';
  console.error(`[Admin SDK Init Error] ${adminSDKInitializationError}`);
}

export const adminAuth = adminApp ? adminApp.auth() : null;
export const adminFirestore = adminApp ? adminApp.firestore("ecom") : null;

if (adminSDKInitializationError) {
  console.error(`[Admin SDK] Final Initialization Error State: ${adminSDKInitializationError}`);
} else if (adminApp) {
  console.log(`[Admin SDK] Admin SDK services (Auth, Firestore) should be available. App name: ${adminApp.name}. Project ID: ${adminApp.options.projectId}. Firestore targeting 'ecom' database. Total apps in admin.apps: ${admin.apps.length}`);
} else {
  console.error("[Admin SDK] Final State: Admin SDK not initialized, and adminApp is undefined, and no specific error string was set (this is unexpected).");
}
console.log('--- [ADMIN SDK INIT END V8] ---');
