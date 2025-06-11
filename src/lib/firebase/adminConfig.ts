
import * as admin from 'firebase-admin';
import fs from 'fs';
import path from 'path';

// --- INSTRUCTIONS FOR SETTING UP ADMIN SDK CREDENTIALS ---
// 1. **RECOMMENDED FOR PRODUCTION (Cloud Run, etc.): Use Google Secret Manager.**
//    a. Store your service account JSON key content as a secret in Secret Manager.
//    b. In your Cloud Run service configuration, expose this secret as an environment variable named `FIREBASE_ADMIN_SDK_CONFIG`.
//       The value of this variable will be the JSON string itself.
// 2. **FOR LOCAL DEVELOPMENT (or environments where Secret Manager isn't used for this):**
//    You can set environment variables directly:
//    a. `FIREBASE_ADMIN_SDK_CONFIG`: Set this to the entire JSON content of your service account key.
//       (Ensure newlines in the private_key are handled, e.g., as `\n` or by minifying the JSON to a single line).
//    b. `FIREBASE_ADMIN_SDK_CONFIG_PATH`: Set this to the file system path of your service account JSON key.
//       (e.g., `FIREBASE_ADMIN_SDK_CONFIG_PATH=./path/to/your/serviceAccountKey.json`).
//
// This script will prioritize `FIREBASE_ADMIN_SDK_CONFIG` if both are set.
// The direct file loading fallback (`serviceAccountKey.json` from root) has been removed
// as environment variables are a more robust approach for different environments.
// --- END INSTRUCTIONS ---

console.log('--- [ADMIN SDK INIT V27 - Cloud Run Focused] ---');
console.log(`[Admin SDK] Node Env: ${process.env.NODE_ENV}`);
console.log(`[Admin SDK] Initial admin.apps.length: ${admin.apps ? admin.apps.length : 'admin.apps is undefined/null'}`);

const serviceAccountConfigEnv = process.env.FIREBASE_ADMIN_SDK_CONFIG;
const serviceAccountPathEnv = process.env.FIREBASE_ADMIN_SDK_CONFIG_PATH;

console.log(`[Admin SDK] Env var FIREBASE_ADMIN_SDK_CONFIG: ${serviceAccountConfigEnv ? 'SET (will be used)' : 'NOT SET'}`);
console.log(`[Admin SDK] Env var FIREBASE_ADMIN_SDK_CONFIG_PATH: ${serviceAccountPathEnv ? 'SET (used if FIREBASE_ADMIN_SDK_CONFIG is not set or fails)' : 'NOT SET'}`);

let adminApp: admin.app.App | undefined;
export let adminSDKInitializationError: string | null = null;
export let adminAuth: admin.auth.Auth | null = null;
export let adminFirestore_DefaultDB: admin.firestore.Firestore | null = null;
export let adminFirestore_EcomDB: admin.firestore.Firestore | null = null;

const expectedProjectId = "ecommerce-db-75f77";

if (!admin || !admin.credential || typeof admin.credential.cert !== 'function' || typeof admin.initializeApp !== 'function') {
  adminSDKInitializationError = "CRITICAL: The 'firebase-admin' module is not loaded correctly or essential parts are missing.";
  console.error(`[Admin SDK Init Error] ${adminSDKInitializationError}`);
} else {
  const appName = `firebase-admin-app-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  // Check if an app with the correct project ID already exists to avoid re-initialization errors.
  // This is more robust than checking by a dynamically generated name if hot-reloading or multiple calls occur.
  const existingApp = admin.apps.find(app => app?.options.projectId === expectedProjectId);

  if (existingApp) {
    adminApp = existingApp;
    console.log(`[Admin SDK] Using existing initialized admin app: ${adminApp.name} for project ${adminApp.options.projectId}`);
    adminSDKInitializationError = null; // Assume existing app was initialized correctly
  } else {
    let serviceAccountCredentials: any;
    let loadedFrom = "";

    if (serviceAccountConfigEnv && serviceAccountConfigEnv.trim() !== '{}' && serviceAccountConfigEnv.trim() !== '') {
      console.log('[Admin SDK] Attempting to initialize from FIREBASE_ADMIN_SDK_CONFIG (JSON string).');
      try {
        serviceAccountCredentials = JSON.parse(serviceAccountConfigEnv);
        loadedFrom = "env string: FIREBASE_ADMIN_SDK_CONFIG";
        if (serviceAccountCredentials && serviceAccountCredentials.private_key && typeof serviceAccountCredentials.private_key === 'string') {
          const originalPk = serviceAccountCredentials.private_key;
          serviceAccountCredentials.private_key = originalPk.replace(/\\n/g, '\n');
          if (originalPk !== serviceAccountCredentials.private_key) {
            console.log('[Admin SDK] Replaced "\\\\n" with "\\n" in private_key from FIREBASE_ADMIN_SDK_CONFIG.');
          }
        }
        console.log(`[Admin SDK] Successfully parsed JSON from ${loadedFrom}.`);
      } catch (e: any) {
        adminSDKInitializationError = `Error parsing JSON from FIREBASE_ADMIN_SDK_CONFIG: ${e.message}.`;
        console.warn(`[Admin SDK Init Warning] ${adminSDKInitializationError} Will try path next if configured.`);
        serviceAccountCredentials = null;
      }
    }

    if (!serviceAccountCredentials && serviceAccountPathEnv && serviceAccountPathEnv.trim() !== '') {
      const absolutePath = path.resolve(process.cwd(), serviceAccountPathEnv.trim());
      console.log(`[Admin SDK] Attempting to initialize from FIREBASE_ADMIN_SDK_CONFIG_PATH: ${serviceAccountPathEnv}`);
      console.log(`[Admin SDK] Resolved absolute path for service account key: ${absolutePath}`);

      if (fs.existsSync(absolutePath)) {
        console.log(`[Admin SDK] Service account file FOUND at: ${absolutePath}`);
        try {
          const serviceAccountFileContent = fs.readFileSync(absolutePath, 'utf8');
          serviceAccountCredentials = JSON.parse(serviceAccountFileContent);
          loadedFrom = `file path: ${serviceAccountPathEnv}`;
          console.log(`[Admin SDK] Successfully parsed JSON from ${loadedFrom}.`);
        } catch (e: any) {
          adminSDKInitializationError = `Failed to read or parse service account file at ${absolutePath}. Error: ${e.message || String(e)}.`;
          console.error(`[Admin SDK Init Error] ${adminSDKInitializationError}`);
          serviceAccountCredentials = null;
        }
      } else {
        const pathError = `Service account file NOT FOUND at: ${absolutePath} (from FIREBASE_ADMIN_SDK_CONFIG_PATH).`;
        console.error(`[Admin SDK Init Error] ${pathError}`);
        if (!adminSDKInitializationError) adminSDKInitializationError = pathError;
        serviceAccountCredentials = null;
      }
    }

    if (!serviceAccountCredentials && !adminSDKInitializationError) {
      adminSDKInitializationError = 'Admin SDK credentials not found. Neither FIREBASE_ADMIN_SDK_CONFIG nor FIREBASE_ADMIN_SDK_CONFIG_PATH provided valid credentials.';
      console.error(`[Admin SDK Init Error] ${adminSDKInitializationError}`);
    }

    if (serviceAccountCredentials && !adminSDKInitializationError) {
      console.log(`[Admin SDK] Credentials parsed from ${loadedFrom}. Validating essential fields...`);
      const essentialFields = ['type', 'project_id', 'private_key_id', 'private_key', 'client_email', 'client_id', 'auth_uri', 'token_uri', 'auth_provider_x509_cert_url', 'client_x509_cert_url'];
      const missingFields = essentialFields.filter(field => !(field in serviceAccountCredentials) || !serviceAccountCredentials[field]);

      if (missingFields.length > 0) {
        adminSDKInitializationError = `Parsed service account credentials (from ${loadedFrom}) are missing or have empty essential fields: ${missingFields.join(', ')}. Cannot initialize.`;
        console.error(`[Admin SDK Init Error] ${adminSDKInitializationError}`);
      } else if (serviceAccountCredentials.project_id !== expectedProjectId) {
        adminSDKInitializationError = `CRITICAL MISMATCH: Project ID in credentials ('${serviceAccountCredentials.project_id}') from ${loadedFrom} does NOT match expected ('${expectedProjectId}'). Cannot initialize.`;
        console.error(`[Admin SDK Init Error] ${adminSDKInitializationError}`);
      } else {
        console.log(`[Admin SDK] Credential details: project_id: '${serviceAccountCredentials.project_id}', client_email: '${serviceAccountCredentials.client_email}', private_key_id: '${serviceAccountCredentials.private_key_id.substring(0, 10)}...'`);
        console.log('[Admin SDK] Essential fields present and project ID matches. Attempting to create credential object...');
        
        let credential;
        try {
            credential = admin.credential.cert(serviceAccountCredentials);
            console.log(`[Admin SDK] Credential object created successfully.`);
        } catch (credError: any) {
            adminSDKInitializationError = `Error creating credential object with admin.credential.cert(): ${credError.message}. Check private key format or other credential fields.`;
            console.error(`[Admin SDK Init Error] ${adminSDKInitializationError}`);
        }
        
        if (credential) {
          console.log(`[Admin SDK] Attempting admin.initializeApp() with unique name: ${appName} and explicit projectId: '${serviceAccountCredentials.project_id}'`);
          try {
            adminApp = admin.initializeApp({
              credential,
              projectId: serviceAccountCredentials.project_id, // Explicitly set projectId
            }, appName);
            
            if (adminApp && adminApp.options.projectId === expectedProjectId) {
              adminSDKInitializationError = null; // Success!
              console.log(`[Admin SDK] Successfully initialized a new Firebase admin app: ${appName} for project '${expectedProjectId}'.`);
            } else {
              const effectiveProjectId = adminApp?.options.projectId || "unknown";
              adminSDKInitializationError = `Firebase Admin SDK initialization for app '${appName}' did not result in a retrievable app with the correct project ID. Expected '${expectedProjectId}', Got '${effectiveProjectId}'.`;
              console.error(`[Admin SDK Init Error] ${adminSDKInitializationError}`);
              adminApp = undefined;
            }
          } catch (initError: any) {
            console.error(`[Admin SDK Init Error] FAILED during admin.initializeApp() for app '${appName}'. Error:`, initError);
            adminSDKInitializationError = `Failed to initialize Firebase Admin App '${appName}'. Error: ${initError.message || String(initError)}.`;
            adminApp = undefined;
          }
        } else if (!adminSDKInitializationError) {
             adminSDKInitializationError = 'Failed to create credential object, but no specific error was caught from admin.credential.cert().';
             console.error(`[Admin SDK Init Error] ${adminSDKInitializationError}`);
        }
      }
    }
  }
}


if (adminApp && !adminSDKInitializationError) {
  adminAuth = adminApp.auth();
  adminFirestore_DefaultDB = adminApp.firestore();
  // Assuming "ecom" database is not strictly needed for this specific auth flow or has separate error handling.
  // If it is needed, ensure its initialization and error handling are robust.
  try {
    adminFirestore_EcomDB = adminApp.firestore("ecom"); 
    console.log(`[Admin SDK] Admin SDK services (Auth, Firestore Default, Firestore Ecom) set up from app: ${adminApp.name}.`);
  } catch (ecomDbError: any) {
    console.warn(`[Admin SDK] Warning: Could not initialize 'ecom' named Firestore database for app ${adminApp.name}. Error: ${ecomDbError.message}. Operations relying on it may fail. Default Firestore is still available.`);
    adminFirestore_EcomDB = null; 
  }
} else {
  if (!adminSDKInitializationError) {
    adminSDKInitializationError = 'Firebase Admin SDK app could not be initialized (adminApp is undefined), and no specific error was caught. This is an unexpected state.';
  }
  console.error(`[Admin SDK] FINAL INITIALIZATION STATE: Error - ${adminSDKInitializationError}. Auth and Firestore instances will be null.`);
  adminAuth = null;
  adminFirestore_DefaultDB = null;
  adminFirestore_EcomDB = null;
}

console.log(`[Admin SDK Final Status V27] Initialization Error: ${adminSDKInitializationError || 'None'}. adminFirestore_DefaultDB is ${adminFirestore_DefaultDB ? 'CONFIGURED' : 'NULL'}.`);
console.log('--- [ADMIN SDK INIT END V27] ---');
