
import * as admin from 'firebase-admin';
import fs from 'fs';
import path from 'path';

console.log('--- [ADMIN SDK INIT V33 - Centralized Instance] ---');
console.log(`[Admin SDK] Node Env: ${process.env.NODE_ENV}`);
console.log(`[Admin SDK] Initial admin.apps.length: ${admin.apps ? admin.apps.length : 'admin.apps is undefined/null'}`);

const serviceAccountConfigEnv = process.env.FIREBASE_ADMIN_SDK_CONFIG;
const serviceAccountPathEnv = process.env.FIREBASE_ADMIN_SDK_CONFIG_PATH;

console.log(`[Admin SDK] Env var FIREBASE_ADMIN_SDK_CONFIG_PATH: ${serviceAccountPathEnv ? `SET: '${serviceAccountPathEnv}' (Will be tried FIRST)` : 'NOT SET'}`);
console.log(`[Admin SDK] Env var FIREBASE_ADMIN_SDK_CONFIG: ${serviceAccountConfigEnv ? 'SET (Will be tried as FALLBACK)' : 'NOT SET'}`);

let adminAppInstance: admin.app.App | undefined;
let adminSDKInitializationErrorMsg: string | null = null;
let adminAuthService: admin.auth.Auth | null = null;
let adminFirestoreDefaultDBInstance: admin.firestore.Firestore | null = null;
let adminFirestoreEcomDBInstance: admin.firestore.Firestore | null = null; // Placeholder

const expectedProjectId = "ecommerce-db-75f77";

if (!admin || !admin.credential || typeof admin.credential.cert !== 'function' || typeof admin.initializeApp !== 'function') {
  adminSDKInitializationErrorMsg = "CRITICAL: The 'firebase-admin' module is not loaded correctly or essential parts are missing.";
  console.error(`[Admin SDK Init Error] ${adminSDKInitializationErrorMsg}`);
} else {
  // Check if an app with the expected project ID already exists.
  // This handles scenarios like HMR in Next.js where this module might be re-evaluated.
  const existingApp = admin.apps.find(app => app?.options.projectId === expectedProjectId && app.name.startsWith('firebase-admin-app-'));
  
  if (existingApp) {
    adminAppInstance = existingApp;
    console.log(`[Admin SDK] Using existing initialized admin app: ${adminAppInstance.name} for project ${adminAppInstance.options.projectId}`);
    adminSDKInitializationErrorMsg = null;
  } else {
    let serviceAccountCredentials: any;
    let loadedFrom = "";

    if (serviceAccountPathEnv && serviceAccountPathEnv.trim() !== '') {
      const absolutePath = path.resolve(process.cwd(), serviceAccountPathEnv.trim());
      console.log(`[Admin SDK] Attempting to initialize from FIREBASE_ADMIN_SDK_CONFIG_PATH (ENV_PATH): ${serviceAccountPathEnv}`);
      console.log(`[Admin SDK] Resolved absolute path for service account key: ${absolutePath}`);

      if (fs.existsSync(absolutePath)) {
        console.log(`[Admin SDK] Service account file FOUND at: ${absolutePath}`);
        try {
          const serviceAccountFileContent = fs.readFileSync(absolutePath, 'utf8');
          serviceAccountCredentials = JSON.parse(serviceAccountFileContent);
          loadedFrom = `file path (ENV_PATH): ${serviceAccountPathEnv}`;
          console.log(`[Admin SDK] Successfully parsed JSON from ${loadedFrom}.`);
        } catch (e: any) {
          adminSDKInitializationErrorMsg = `Failed to read or parse service account file at ${absolutePath}. Error: ${e.message || String(e)}.`;
          console.error(`[Admin SDK Init Error] ${adminSDKInitializationErrorMsg}`);
          serviceAccountCredentials = null;
        }
      } else {
        const pathError = `Service account file NOT FOUND at: ${absolutePath} (from FIREBASE_ADMIN_SDK_CONFIG_PATH).`;
        console.warn(`[Admin SDK Init Warning] ${pathError} Will try direct ENV_STRING next if configured.`);
        if (!adminSDKInitializationErrorMsg) adminSDKInitializationErrorMsg = pathError;
        serviceAccountCredentials = null;
      }
    } else {
      console.log('[Admin SDK] FIREBASE_ADMIN_SDK_CONFIG_PATH not set or empty. Will try direct ENV_STRING next.');
    }

    if (!serviceAccountCredentials && serviceAccountConfigEnv && serviceAccountConfigEnv.trim() !== '{}' && serviceAccountConfigEnv.trim() !== '') {
      console.log('[Admin SDK] Attempting to initialize from FIREBASE_ADMIN_SDK_CONFIG (ENV_STRING) as fallback.');
      adminSDKInitializationErrorMsg = null; // Clear previous path error if any
      try {
        serviceAccountCredentials = JSON.parse(serviceAccountConfigEnv);
        loadedFrom = "env string (ENV_STRING): FIREBASE_ADMIN_SDK_CONFIG";
        if (serviceAccountCredentials && serviceAccountCredentials.private_key && typeof serviceAccountCredentials.private_key === 'string') {
          serviceAccountCredentials.private_key = serviceAccountCredentials.private_key.replace(/\\n/g, '\n');
        }
        console.log(`[Admin SDK] Successfully parsed JSON from ${loadedFrom}.`);
      } catch (e: any) {
        adminSDKInitializationErrorMsg = `Error parsing JSON from FIREBASE_ADMIN_SDK_CONFIG: ${e.message}.`;
        console.error(`[Admin SDK Init Error] ${adminSDKInitializationErrorMsg}`);
        serviceAccountCredentials = null;
      }
    }

    if (!serviceAccountCredentials && !adminSDKInitializationErrorMsg) {
      adminSDKInitializationErrorMsg = 'Admin SDK credentials not found. Neither FIREBASE_ADMIN_SDK_CONFIG_PATH nor FIREBASE_ADMIN_SDK_CONFIG provided valid credentials.';
      console.error(`[Admin SDK Init Error] ${adminSDKInitializationErrorMsg}`);
    }

    if (serviceAccountCredentials && !adminSDKInitializationErrorMsg) {
      console.log(`[Admin SDK] Credentials parsed from ${loadedFrom}. Validating essential fields...`);
      const essentialFields = ['type', 'project_id', 'private_key_id', 'private_key', 'client_email', 'client_id', 'auth_uri', 'token_uri', 'auth_provider_x509_cert_url', 'client_x509_cert_url'];
      const missingFields = essentialFields.filter(field => !(field in serviceAccountCredentials) || !serviceAccountCredentials[field]);

      if (missingFields.length > 0) {
        adminSDKInitializationErrorMsg = `Parsed service account credentials (from ${loadedFrom}) are missing or have empty essential fields: ${missingFields.join(', ')}. Cannot initialize.`;
        console.error(`[Admin SDK Init Error] ${adminSDKInitializationErrorMsg}`);
      } else if (serviceAccountCredentials.project_id !== expectedProjectId) {
        adminSDKInitializationErrorMsg = `CRITICAL MISMATCH: Project ID in credentials ('${serviceAccountCredentials.project_id}') from ${loadedFrom} does NOT match expected ('${expectedProjectId}'). Cannot initialize.`;
        console.error(`[Admin SDK Init Error] ${adminSDKInitializationErrorMsg}`);
      } else {
        console.log(`[Admin SDK] Credential details: project_id: '${serviceAccountCredentials.project_id}', client_email: '${serviceAccountCredentials.client_email}', private_key_id (first 10): '${serviceAccountCredentials.private_key_id.substring(0, 10)}...'`);
        let credential;
        try {
            credential = admin.credential.cert(serviceAccountCredentials);
        } catch (credError: any) {
            adminSDKInitializationErrorMsg = `Error creating credential object with admin.credential.cert(): ${credError.message}.`;
            console.error(`[Admin SDK Init Error] ${adminSDKInitializationErrorMsg}`);
        }
        
        if (credential) {
          const uniqueAppName = `firebase-admin-app-${expectedProjectId}-${Date.now().toString(36)}`;
          console.log(`[Admin SDK] Attempting admin.initializeApp() with unique name: ${uniqueAppName} and explicit projectId: '${serviceAccountCredentials.project_id}'`);
          try {
            adminAppInstance = admin.initializeApp({
              credential,
              projectId: serviceAccountCredentials.project_id,
            }, uniqueAppName); // Using a unique name always for new initializations
            
            if (adminAppInstance && adminAppInstance.options.projectId === expectedProjectId) {
              adminSDKInitializationErrorMsg = null; // Success!
              console.log(`[Admin SDK] Successfully initialized a NEW Firebase admin app: ${adminAppInstance.name} for project '${expectedProjectId}' via ${loadedFrom}.`);
            } else {
              const effectiveProjectId = adminAppInstance?.options.projectId || "unknown";
              adminSDKInitializationErrorMsg = `Firebase Admin SDK initialization for app '${uniqueAppName}' did not result in a retrievable app with the correct project ID. Expected '${expectedProjectId}', Got '${effectiveProjectId}'.`;
              console.error(`[Admin SDK Init Error] ${adminSDKInitializationErrorMsg}`);
              adminAppInstance = undefined;
            }
          } catch (initError: any) {
            console.error(`[Admin SDK Init Error] FAILED during admin.initializeApp() for app '${uniqueAppName}'. Error:`, initError);
            adminSDKInitializationErrorMsg = `Failed to initialize Firebase Admin App '${uniqueAppName}'. Error: ${initError.message || String(initError)}.`;
            adminAppInstance = undefined;
          }
        } else if (!adminSDKInitializationErrorMsg) {
             adminSDKInitializationErrorMsg = 'Failed to create credential object (admin.credential.cert failed silently).';
             console.error(`[Admin SDK Init Error] ${adminSDKInitializationErrorMsg}`);
        }
      }
    }
  }
}

if (adminAppInstance && !adminSDKInitializationErrorMsg) {
  try {
    adminAuthService = adminAppInstance.auth();
    console.log(`[Admin SDK] adminAuthService obtained from app: ${adminAppInstance.name}.`);
  } catch (e: any) {
    adminSDKInitializationErrorMsg = `Error getting Auth service from initialized admin app: ${e.message}`;
    console.error(`[Admin SDK Init Error] ${adminSDKInitializationErrorMsg}`);
    adminAuthService = null;
  }

  try {
    adminFirestoreDefaultDBInstance = adminAppInstance.firestore();
    console.log(`[Admin SDK] adminFirestoreDefaultDBInstance obtained from app: ${adminAppInstance.name}. DB Project ID: ${adminFirestoreDefaultDBInstance?.app?.options?.projectId}`);
  } catch (e: any) {
    adminSDKInitializationErrorMsg = (adminSDKInitializationErrorMsg ? adminSDKInitializationErrorMsg + '; ' : '') + `Error getting Firestore (default) service from initialized admin app: ${e.message}`;
    console.error(`[Admin SDK Init Error] ${adminSDKInitializationErrorMsg}`);
    adminFirestoreDefaultDBInstance = null;
  }
  
  // Placeholder for Ecom DB, not critical for auth
  try {
    // adminFirestoreEcomDBInstance = adminAppInstance.firestore("ecom"); 
    // console.log(`[Admin SDK] adminFirestoreEcomDBInstance obtained from app: ${adminAppInstance.name}.`);
  } catch (ecomDbError: any) {
    // console.warn(`[Admin SDK] Warning: Could not initialize 'ecom' named Firestore for app ${adminAppInstance.name}. Error: ${ecomDbError.message}.`);
    adminFirestoreEcomDBInstance = null;
  }
} else {
  if (!adminSDKInitializationErrorMsg) {
    adminSDKInitializationErrorMsg = 'Firebase Admin SDK app could not be initialized (adminAppInstance is undefined), and no specific error was caught. This is an unexpected state. (REF: UNKNOWN_INIT_FAIL)';
  }
  console.error(`[Admin SDK] FINAL INITIALIZATION STATE (V33): Error - ${adminSDKInitializationErrorMsg}. Auth and Firestore instances will be null.`);
  adminAuthService = null;
  adminFirestoreDefaultDBInstance = null;
  adminFirestoreEcomDBInstance = null;
}

console.log(`[Admin SDK Final Status V33] Initialization Error: ${adminSDKInitializationErrorMsg || 'None'}. adminAuthService is ${adminAuthService ? 'CONFIGURED' : 'NULL'}. adminFirestore_DefaultDB is ${adminFirestoreDefaultDBInstance ? `CONFIGURED for project: ${adminFirestoreDefaultDBInstance?.app?.options?.projectId}` : 'NULL'}.`);
console.log('--- [ADMIN SDK INIT END V33] ---');

export const adminSDKInitializationError = adminSDKInitializationErrorMsg;
export const adminAuth = adminAuthService;
export const adminFirestore_DefaultDB = adminFirestoreDefaultDBInstance;
export const adminFirestore_EcomDB = adminFirestoreEcomDBInstance; // Still exporting, though not fully used yet

    