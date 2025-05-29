
import * as admin from 'firebase-admin';
import path from 'path';
import fs from 'fs';

console.log('--- [ADMIN SDK INIT - DETAILED CHECK] ---');
console.log(`[Admin SDK] Node Env: ${process.env.NODE_ENV}`);
console.log(`[Admin SDK] Initial admin.apps.length: ${admin.apps ? admin.apps.length : 'admin.apps is undefined'}`);

let adminApp: admin.app.App | undefined;
let adminSDKInitializationError: string | null = null;

// Check if the admin object itself or critical parts are missing
if (!admin || !admin.credential || typeof admin.credential.cert !== 'function' || typeof admin.initializeApp !== 'function') {
  adminSDKInitializationError = "CRITICAL: The 'firebase-admin' module is not loaded correctly. 'admin', 'admin.credential', 'admin.credential.cert', or 'admin.initializeApp' is undefined. This might indicate a corrupted 'firebase-admin' package installation or a critical environment issue.";
  console.error(`[Admin SDK Init Error] ${adminSDKInitializationError}`);
} else if (admin.apps.length > 0) {
  adminApp = admin.apps.find(app => app?.name === '[DEFAULT]') || admin.apps[0];
  if (adminApp) {
    console.log(`[Admin SDK] Using existing Firebase admin app: ${adminApp.name}. Total apps: ${admin.apps.length}`);
    adminSDKInitializationError = null;
  } else {
    console.warn("[Admin SDK] admin.apps array is not empty, but no suitable default app found. Will attempt new initialization.");
  }
}

if (!adminApp && !adminSDKInitializationError) {
  console.log("[Admin SDK] No existing admin app. Attempting new initialization from service account file.");
  const serviceAccountPath = process.env.FIREBASE_ADMIN_SDK_CONFIG_PATH;
  console.log(`[Admin SDK] FIREBASE_ADMIN_SDK_CONFIG_PATH: '${serviceAccountPath}'`);

  if (serviceAccountPath && serviceAccountPath.trim() !== '') {
    const currentWorkingDirectory = process.cwd();
    const absolutePath = path.resolve(currentWorkingDirectory, serviceAccountPath.trim());
    console.log(`[Admin SDK] Resolved absolute path for service account key: ${absolutePath}`);

    if (fs.existsSync(absolutePath)) {
      console.log(`[Admin SDK] Service account file FOUND at: ${absolutePath}`);
      try {
        const serviceAccountFileContent = fs.readFileSync(absolutePath, 'utf8');
        console.log('[Admin SDK] Service account file content read successfully.');
        
        const serviceAccountCredentials = JSON.parse(serviceAccountFileContent);
        console.log('[Admin SDK] Service account file content parsed as JSON successfully.');

        // Detailed check for essential properties
        const essentialFields = ['type', 'project_id', 'private_key', 'client_email'];
        const missingFields = essentialFields.filter(field => !(field in serviceAccountCredentials) || !serviceAccountCredentials[field]);

        if (missingFields.length > 0) {
          adminSDKInitializationError = `Parsed service account JSON is missing or has empty essential fields: ${missingFields.join(', ')}. Path: ${absolutePath}. Please verify the content of your serviceAccountKey.json.`;
          console.error(`[Admin SDK Init Error] ${adminSDKInitializationError}`);
        } else {
          console.log(`[Admin SDK] Parsed credentials seem to have essential fields. Project ID: ${serviceAccountCredentials.project_id}, Type: ${serviceAccountCredentials.type}.`);
          console.log('[Admin SDK] Attempting to create credential with admin.credential.cert()...');
          
          const credential = admin.credential.cert(serviceAccountCredentials);
          
          if (!credential) {
            adminSDKInitializationError = `admin.credential.cert(serviceAccountCredentials) returned a falsy value (e.g., undefined or null). This indicates a problem with the service account credentials object passed to it, even if it parsed as JSON. Path: ${absolutePath}`;
            console.error(`[Admin SDK Init Error] ${adminSDKInitializationError}`);
          } else {
            console.log('[Admin SDK] Credential object created successfully by admin.credential.cert().');
            console.log('[Admin SDK] Attempting admin.initializeApp()...');
            
            // Try to initialize with a unique app name to avoid conflicts if a "[DEFAULT]" app somehow exists but wasn't detected.
            const appName = `firebase-admin-app-${Date.now()}`;
            adminApp = admin.initializeApp({
              credential,
            }, appName);
            
            console.log(`[Admin SDK] admin.initializeApp() called for app name: ${appName}. Resulting adminApp: ${adminApp ? 'Assigned' : 'NOT Assigned'}`);
            console.log(`[Admin SDK] Total admin apps after initialization attempt: ${admin.apps.length}`);
            
            // Verify if the app was actually initialized and is retrievable
            if (admin.apps.some(app => app?.name === appName)) {
                adminSDKInitializationError = null; // Clear error on success
                console.log(`[Admin SDK] Successfully initialized Firebase Admin SDK with app name: ${appName}.`);
            } else {
                adminSDKInitializationError = `Firebase Admin SDK initialization for app '${appName}' did not result in a retrievable app, though initializeApp did not throw immediately. This is an unusual state.`;
                console.error(`[Admin SDK Init Error] ${adminSDKInitializationError}`);
                adminApp = undefined; // Ensure adminApp is undefined if init wasn't truly successful
            }
          }
        }
      } catch (e: any) {
        console.error(`[Admin SDK Init Error] FAILED during initialization from file path: ${absolutePath}. Error:`, e);
        adminSDKInitializationError = `Failed to initialize Admin SDK from service account file. Path: ${absolutePath}. Error: ${e.message || String(e)}. Stack: ${e.stack || 'No stack trace'}. Ensure the file exists, is readable, and contains valid JSON credentials.`;
      }
    } else {
      console.error(`[Admin SDK Init Error] Service account file NOT FOUND at: ${absolutePath}.`);
      adminSDKInitializationError = `Service account file not found at: ${absolutePath}. Check FIREBASE_ADMIN_SDK_CONFIG_PATH in .env and file location. CWD: ${currentWorkingDirectory}`;
    }
  } else {
    console.log('[Admin SDK] FIREBASE_ADMIN_SDK_CONFIG_PATH not set or is empty. Cannot initialize Admin SDK from file.');
    adminSDKInitializationError = 'FIREBASE_ADMIN_SDK_CONFIG_PATH environment variable not set or empty. Cannot initialize Admin SDK.';
  }
}

if (!adminApp && !adminSDKInitializationError) {
  adminSDKInitializationError = 'Firebase Admin SDK app could not be initialized, and no specific error was caught during the file path attempt. This usually means the firebase-admin module check failed or an existing app was expected but not found suitable.';
  console.error(`[Admin SDK Init Error] ${adminSDKInitializationError}`);
}


const adminAuth = adminApp ? adminApp.auth() : null;
const adminFirestore = adminApp ? adminApp.firestore() : null;

if (!adminApp) {
  console.error("[Admin SDK] CRITICAL: adminApp is still undefined after all initialization attempts. Admin SDK is NOT operational.");
}
if (!adminAuth && adminApp) { // If adminApp exists but auth is null (shouldn't happen with proper init)
  console.warn("[Admin SDK] WARNING: adminAuth is null, but adminApp exists. This is unexpected. Authentication-related server actions will fail.");
}
if (!adminFirestore && adminApp) { // If adminApp exists but firestore is null
  console.warn("[Admin SDK] WARNING: adminFirestore is null, but adminApp exists. This is unexpected. Firestore-related server actions will fail.");
}

if (adminSDKInitializationError) {
  console.error(`[Admin SDK] Final Initialization Error State: ${adminSDKInitializationError}`);
} else if (adminApp) {
  console.log(`[Admin SDK] Admin SDK services (Auth, Firestore) should be available. App name: ${adminApp.name}. Total apps in admin.apps: ${admin.apps.length}`);
} else {
  console.error("[Admin SDK] Final State: Admin SDK not initialized, and no specific error string was set, or adminApp is undefined despite no error. This is unexpected.");
}

console.log('--- [ADMIN SDK INIT END - DETAILED CHECK] ---');

export { adminAuth, adminFirestore, adminSDKInitializationError };
