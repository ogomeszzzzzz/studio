
import * as admin from 'firebase-admin';
import fs from 'fs';
import path from 'path';

console.log('--- [ADMIN SDK INIT - ATTEMPTING INITIALIZATION V26 - Cloud Run Debug] ---');
console.log(`[Admin SDK] Node Env: ${process.env.NODE_ENV}`);
console.log(`[Admin SDK] Initial admin.apps.length: ${admin.apps ? admin.apps.length : 'admin.apps is undefined/null'}`);

const serviceAccountConfigEnv = process.env.FIREBASE_ADMIN_SDK_CONFIG;
const serviceAccountPathEnv = process.env.FIREBASE_ADMIN_SDK_CONFIG_PATH;

console.log(`[Admin SDK] Env var FIREBASE_ADMIN_SDK_CONFIG: ${serviceAccountConfigEnv ? `SET (length: ${serviceAccountConfigEnv.length})` : 'NOT SET'}`);
console.log(`[Admin SDK] Env var FIREBASE_ADMIN_SDK_CONFIG_PATH: ${serviceAccountPathEnv || 'NOT SET'}`);


let adminApp: admin.app.App | undefined;
export let adminSDKInitializationError: string | null = null;
export let adminAuth: admin.auth.Auth | null = null;
export let adminFirestore_DefaultDB: admin.firestore.Firestore | null = null; // For auth_users
export let adminFirestore_EcomDB: admin.firestore.Firestore | null = null;    // For user_products

const expectedProjectId = "ecommerce-db-75f77"; // Your correct project ID

if (!admin || !admin.credential || typeof admin.credential.cert !== 'function' || typeof admin.initializeApp !== 'function') {
  adminSDKInitializationError = "CRITICAL: The 'firebase-admin' module is not loaded correctly or essential parts are missing.";
  console.error(`[Admin SDK Init Error] ${adminSDKInitializationError}`);
} else {
  const appName = `firebase-admin-app-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  const existingApp = admin.apps.find(app => app?.name === appName || (app?.options.projectId === expectedProjectId && app?.name.startsWith('firebase-admin-app-')));

  if (!existingApp) {
    let serviceAccountCredentials: any;
    let loadedFrom = "";

    if (serviceAccountConfigEnv && serviceAccountConfigEnv.trim() !== '{}' && serviceAccountConfigEnv.trim() !== '') {
      console.log('[Admin SDK] Attempting to initialize from FIREBASE_ADMIN_SDK_CONFIG (JSON string).');
      try {
        serviceAccountCredentials = JSON.parse(serviceAccountConfigEnv);
        loadedFrom = "env string";
        console.log(`[Admin SDK] Successfully parsed JSON from FIREBASE_ADMIN_SDK_CONFIG. Project ID from parsed string: ${serviceAccountCredentials?.project_id}`);
        if (serviceAccountCredentials && serviceAccountCredentials.private_key && typeof serviceAccountCredentials.private_key === 'string') {
          const originalPk = serviceAccountCredentials.private_key;
          serviceAccountCredentials.private_key = originalPk.replace(/\\n/g, '\n');
          if (originalPk !== serviceAccountCredentials.private_key) {
            console.log('[Admin SDK] Replaced "\\\\n" with "\\n" in private_key from ENV string.');
          }
        }
      } catch (e: any) {
        adminSDKInitializationError = `Error parsing JSON from FIREBASE_ADMIN_SDK_CONFIG: ${e.message}. Will try path next.`;
        console.warn(`[Admin SDK Init Warning] ${adminSDKInitializationError}`);
        serviceAccountCredentials = null; // Ensure it's null if parsing failed
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
          loadedFrom = "file path";
          console.log(`[Admin SDK] Successfully parsed JSON from file ${absolutePath}. Project ID: ${serviceAccountCredentials?.project_id}`);
        } catch (e: any) {
          adminSDKInitializationError = `Failed to read or parse service account file at ${absolutePath}. Error: ${e.message || String(e)}.`;
          console.error(`[Admin SDK Init Error] ${adminSDKInitializationError}`);
          serviceAccountCredentials = null; // Ensure it's null if parsing failed
        }
      } else {
        const pathError = `Service account file NOT FOUND at: ${absolutePath}.`;
        console.error(`[Admin SDK Init Error] ${pathError}`);
        if (!adminSDKInitializationError) adminSDKInitializationError = pathError; // Set if not already set by JSON parse error
        serviceAccountCredentials = null; // Ensure it's null
      }
    }

    if (!serviceAccountCredentials && !adminSDKInitializationError) {
      adminSDKInitializationError = 'Neither FIREBASE_ADMIN_SDK_CONFIG_PATH nor FIREBASE_ADMIN_SDK_CONFIG environment variables are set or provided valid credentials for Admin SDK.';
      console.error(`[Admin SDK Init Error] ${adminSDKInitializationError}`);
    }

    if (serviceAccountCredentials && !adminSDKInitializationError) {
      console.log(`[Admin SDK] Attempting to use service account credentials loaded from ${loadedFrom}. Keys: ${Object.keys(serviceAccountCredentials).join(', ')}`);
      console.log(`[Admin SDK] Credentials content (sensitive parts omitted): project_id: ${serviceAccountCredentials.project_id}, client_email: ${serviceAccountCredentials.client_email}, private_key_exists: ${!!serviceAccountCredentials.private_key}`);
      
      const essentialFields = ['type', 'project_id', 'private_key_id', 'private_key', 'client_email', 'client_id', 'auth_uri', 'token_uri', 'auth_provider_x509_cert_url', 'client_x509_cert_url'];
      const missingFields = essentialFields.filter(field => !(field in serviceAccountCredentials) || !serviceAccountCredentials[field]);

      if (missingFields.length > 0) {
        adminSDKInitializationError = `Parsed service account credentials (from ${loadedFrom}) are missing or have empty essential fields: ${missingFields.join(', ')}. Cannot initialize admin app.`;
        console.error(`[Admin SDK Init Error] ${adminSDKInitializationError}`);
      } else if (serviceAccountCredentials.project_id !== expectedProjectId) {
        adminSDKInitializationError = `CRITICAL MISMATCH: Project ID in service account credentials ('${serviceAccountCredentials.project_id}') from ${loadedFrom} does NOT match the expected project ID ('${expectedProjectId}'). Cannot initialize admin app.`;
        console.error(`[Admin SDK Init Error] ${adminSDKInitializationError}`);
      } else {
        console.log('[Admin SDK] Service account credentials appear valid and match expected project ID. Attempting to create credential object...');
        let credential;
        try {
            credential = admin.credential.cert(serviceAccountCredentials);
        } catch (credError: any) {
            adminSDKInitializationError = `Error creating credential object with admin.credential.cert(): ${credError.message}. Check private key format.`;
            console.error(`[Admin SDK Init Error] ${adminSDKInitializationError}`);
        }
        

        if (!credential && !adminSDKInitializationError) {
          adminSDKInitializationError = 'admin.credential.cert(serviceAccountCredentials) returned a falsy or empty credential object.';
          console.error(`[Admin SDK Init Error] ${adminSDKInitializationError}`);
        } else if (credential) {
          console.log(`[Admin SDK] Credential object created successfully. Type of credential: ${typeof credential}, has getAccessToken method: ${typeof (credential as any)?.getAccessToken === 'function'}`);
          console.log(`[Admin SDK] Attempting admin.initializeApp() with unique name: ${appName} and explicit projectId: '${serviceAccountCredentials.project_id}'`);

          try {
            adminApp = admin.initializeApp({
              credential,
              projectId: serviceAccountCredentials.project_id,
            }, appName);
            
            if (adminApp && adminApp.options.projectId === expectedProjectId) {
              adminSDKInitializationError = null; // Success!
              console.log(`[Admin SDK] Successfully initialized a new Firebase admin app: ${appName} for project '${expectedProjectId}' via ${loadedFrom}.`);
              console.log(`[Admin SDK] adminApp.name: ${adminApp.name}, adminApp.options.projectId: ${adminApp.options.projectId}`);
              console.log(`[Admin SDK] adminApp.options.credential type: ${typeof adminApp.options.credential}, has getAccessToken method: ${typeof (adminApp.options.credential as any)?.getAccessToken === 'function'}`);
            } else {
              const effectiveProjectId = adminApp?.options.projectId || "unknown";
              adminSDKInitializationError = `Firebase Admin SDK initialization for app '${appName}' did not result in a retrievable app with the correct project ID. Expected '${expectedProjectId}', Got '${effectiveProjectId}'.`;
              if (adminApp && adminApp.options) {
                  console.error(`[Admin SDK Init Error] Full adminApp.options object:`, JSON.stringify(adminApp.options, null, 2));
              }
              console.error(`[Admin SDK Init Error] ${adminSDKInitializationError}`);
              adminApp = undefined;
            }
          } catch (initError: any) {
            console.error(`[Admin SDK Init Error] FAILED during admin.initializeApp() for app '${appName}'. Error:`, initError);
            const errorMessageDetail = initError.message ? initError.message : String(initError);
            adminSDKInitializationError = `Failed to initialize Firebase Admin App '${appName}'. Error: ${errorMessageDetail}.`;
            adminApp = undefined;
          }
        }
      }
    }
  } else {
    adminApp = existingApp;
    console.log(`[Admin SDK] Using existing initialized admin app: ${adminApp.name} for project ${adminApp.options.projectId}`);
    // If we use an existing app, we assume it was initialized correctly with credentials.
    // If not, the UNAUTHENTICATED error will still occur, pointing to that app's initialization.
  }
}


if (adminApp && !adminSDKInitializationError) {
  adminAuth = adminApp.auth();
  adminFirestore_DefaultDB = adminApp.firestore(); // Default database
  adminFirestore_EcomDB = adminApp.firestore("ecom");   // "ecom" named database
  console.log(`[Admin SDK] Admin SDK services (Auth, Firestore Default, Firestore Ecom) set up from app: ${adminApp.name}.`);
} else {
  if (!adminSDKInitializationError) {
    adminSDKInitializationError = 'Firebase Admin SDK app could not be initialized, and no specific error was caught. adminApp is undefined.';
  }
  console.error(`[Admin SDK] FINAL INITIALIZATION STATE: Error - ${adminSDKInitializationError}. Firestore instances will be null.`);
  adminAuth = null;
  adminFirestore_DefaultDB = null;
  adminFirestore_EcomDB = null;
}

console.log(`[Admin SDK Final Status V26] Initialization Error: ${adminSDKInitializationError || 'None'}. adminFirestore_DefaultDB is ${adminFirestore_DefaultDB ? 'CONFIGURED' : 'NULL'}.`);
console.log('--- [ADMIN SDK INIT END V26] ---');
