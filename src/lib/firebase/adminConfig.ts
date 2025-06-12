
import * as admin from 'firebase-admin';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import fs from 'fs';
import path from 'path';

console.log('--- [ADMIN SDK INIT V35 - Explicit Modular Services] ---');
console.log(`[Admin SDK V35] Node Env: ${process.env.NODE_ENV}`);
console.log(`[Admin SDK V35] Initial admin.apps.length: ${admin.apps ? admin.apps.length : 'admin.apps is undefined/null'}`);

const serviceAccountConfigEnv = process.env.FIREBASE_ADMIN_SDK_CONFIG;
const serviceAccountPathEnv = process.env.FIREBASE_ADMIN_SDK_CONFIG_PATH;

console.log(`[Admin SDK V35] Env var FIREBASE_ADMIN_SDK_CONFIG_PATH: ${serviceAccountPathEnv ? `SET: '${serviceAccountPathEnv}' (Will be tried FIRST)` : 'NOT SET'}`);
console.log(`[Admin SDK V35] Env var FIREBASE_ADMIN_SDK_CONFIG: ${serviceAccountConfigEnv ? 'SET (Will be tried as FALLBACK)' : 'NOT SET'}`);

let adminAppInstance: admin.app.App | undefined;
let adminSDKInitializationErrorMsg: string | null = null;
let adminAuthService: admin.auth.Auth | null = null;
let adminFirestoreDefaultDBInstance: admin.firestore.Firestore | null = null;
// Placeholder for Ecom DB, not currently used for separate init
// let adminFirestoreEcomDBInstance: admin.firestore.Firestore | null = null;

const expectedProjectId = "ecommerce-db-75f77";
const uniqueAppPrefix = `firebase-admin-app-${expectedProjectId}`; // Prefix to find an already initialized app for this project

if (!admin || !admin.credential || typeof admin.credential.cert !== 'function' || typeof admin.initializeApp !== 'function') {
  adminSDKInitializationErrorMsg = "CRITICAL: The 'firebase-admin' module is not loaded correctly or essential parts (like credential.cert or initializeApp) are missing.";
  console.error(`[Admin SDK Init Error V35] ${adminSDKInitializationErrorMsg}`);
} else {
  // Try to find an already initialized app for this project to prevent re-initialization errors
  adminAppInstance = admin.apps.find(app => app?.name.startsWith(uniqueAppPrefix) && app?.options.projectId === expectedProjectId);

  if (adminAppInstance) {
    console.log(`[Admin SDK V35] Using existing initialized admin app: ${adminAppInstance.name} for project ${adminAppInstance.options.projectId}`);
    adminSDKInitializationErrorMsg = null; // Reset error if we found a valid existing app
  } else {
    console.log(`[Admin SDK V35] No existing app found for prefix '${uniqueAppPrefix}' and project '${expectedProjectId}'. Attempting new initialization.`);
    let serviceAccountCredentials: any;
    let loadedFrom = "";

    if (serviceAccountPathEnv && serviceAccountPathEnv.trim() !== '') {
      const absolutePath = path.resolve(process.cwd(), serviceAccountPathEnv.trim());
      console.log(`[Admin SDK V35] Attempting to initialize from FIREBASE_ADMIN_SDK_CONFIG_PATH (ENV_PATH): ${serviceAccountPathEnv}`);
      console.log(`[Admin SDK V35] Resolved absolute path for service account key: ${absolutePath}`);

      if (fs.existsSync(absolutePath)) {
        console.log(`[Admin SDK V35] Service account file FOUND at: ${absolutePath}`);
        try {
          const serviceAccountFileContent = fs.readFileSync(absolutePath, 'utf8');
          serviceAccountCredentials = JSON.parse(serviceAccountFileContent);
          loadedFrom = `file path (ENV_PATH): ${serviceAccountPathEnv}`;
          console.log(`[Admin SDK V35] Successfully parsed JSON from ${loadedFrom}.`);
        } catch (e: any) {
          adminSDKInitializationErrorMsg = `Failed to read or parse service account file at ${absolutePath}. Error: ${e.message || String(e)}.`;
          console.error(`[Admin SDK Init Error V35] ${adminSDKInitializationErrorMsg}`);
          serviceAccountCredentials = null;
        }
      } else {
        const pathError = `Service account file NOT FOUND at: ${absolutePath} (from FIREBASE_ADMIN_SDK_CONFIG_PATH).`;
        console.warn(`[Admin SDK Init Warning V35] ${pathError} Will try direct ENV_STRING next if configured.`);
        if (!adminSDKInitializationErrorMsg) adminSDKInitializationErrorMsg = pathError; // Set error only if not already set by a parse failure
        serviceAccountCredentials = null;
      }
    } else {
      console.log('[Admin SDK V35] FIREBASE_ADMIN_SDK_CONFIG_PATH not set or empty. Will try direct ENV_STRING next.');
    }

    if (!serviceAccountCredentials && serviceAccountConfigEnv && serviceAccountConfigEnv.trim() !== '{}' && serviceAccountConfigEnv.trim() !== '') {
      console.log('[Admin SDK V35] Attempting to initialize from FIREBASE_ADMIN_SDK_CONFIG (ENV_STRING) as fallback.');
      adminSDKInitializationErrorMsg = null; // Clear previous path error if any
      try {
        serviceAccountCredentials = JSON.parse(serviceAccountConfigEnv);
        loadedFrom = "env string (ENV_STRING): FIREBASE_ADMIN_SDK_CONFIG";
        if (serviceAccountCredentials && serviceAccountCredentials.private_key && typeof serviceAccountCredentials.private_key === 'string') {
          serviceAccountCredentials.private_key = serviceAccountCredentials.private_key.replace(/\\n/g, '\n');
        }
        console.log(`[Admin SDK V35] Successfully parsed JSON from ${loadedFrom}.`);
      } catch (e: any) {
        adminSDKInitializationErrorMsg = `Error parsing JSON from FIREBASE_ADMIN_SDK_CONFIG: ${e.message}.`;
        console.error(`[Admin SDK Init Error V35] ${adminSDKInitializationErrorMsg}`);
        serviceAccountCredentials = null;
      }
    }

    if (!serviceAccountCredentials && !adminSDKInitializationErrorMsg) {
      adminSDKInitializationErrorMsg = 'Admin SDK credentials not found. Neither FIREBASE_ADMIN_SDK_CONFIG_PATH nor FIREBASE_ADMIN_SDK_CONFIG provided valid credentials.';
      console.error(`[Admin SDK Init Error V35] ${adminSDKInitializationErrorMsg}`);
    }

    if (serviceAccountCredentials && !adminSDKInitializationErrorMsg) {
      console.log(`[Admin SDK V35] Credentials parsed from ${loadedFrom}. Validating essential fields...`);
      const essentialFields = ['type', 'project_id', 'private_key_id', 'private_key', 'client_email', 'client_id', 'auth_uri', 'token_uri', 'auth_provider_x509_cert_url', 'client_x509_cert_url'];
      const missingFields = essentialFields.filter(field => !(field in serviceAccountCredentials) || !serviceAccountCredentials[field]);

      if (missingFields.length > 0) {
        adminSDKInitializationErrorMsg = `Parsed service account credentials (from ${loadedFrom}) are missing or have empty essential fields: ${missingFields.join(', ')}. Cannot initialize.`;
        console.error(`[Admin SDK Init Error V35] ${adminSDKInitializationErrorMsg}`);
      } else if (serviceAccountCredentials.project_id !== expectedProjectId) {
        adminSDKInitializationErrorMsg = `CRITICAL MISMATCH: Project ID in credentials ('${serviceAccountCredentials.project_id}') from ${loadedFrom} does NOT match expected ('${expectedProjectId}'). Cannot initialize.`;
        console.error(`[Admin SDK Init Error V35] ${adminSDKInitializationErrorMsg}`);
      } else {
        console.log(`[Admin SDK V35] Credential details: project_id: '${serviceAccountCredentials.project_id}', client_email: '${serviceAccountCredentials.client_email}', private_key_id (first 10): '${serviceAccountCredentials.private_key_id.substring(0, 10)}...'`);
        let credential;
        try {
            credential = admin.credential.cert(serviceAccountCredentials);
            console.log(`[Admin SDK V35] Credential object created successfully by admin.credential.cert().`);
        } catch (credError: any) {
            adminSDKInitializationErrorMsg = `Error creating credential object with admin.credential.cert(): ${credError.message}.`;
            console.error(`[Admin SDK Init Error V35] ${adminSDKInitializationErrorMsg}`);
        }

        if (credential) {
          const uniqueAppNameWithTimestamp = `${uniqueAppPrefix}-${Date.now().toString(36)}`;
          console.log(`[Admin SDK V35] Attempting admin.initializeApp() with unique name: ${uniqueAppNameWithTimestamp} and explicit projectId: '${serviceAccountCredentials.project_id}'`);
          try {
            adminAppInstance = admin.initializeApp({
              credential,
              projectId: serviceAccountCredentials.project_id,
            }, uniqueAppNameWithTimestamp);
            
            if (adminAppInstance && adminAppInstance.options.projectId === expectedProjectId) {
              adminSDKInitializationErrorMsg = null; 
              console.log(`[Admin SDK V35] Successfully initialized a NEW Firebase admin app: ${adminAppInstance.name} for project '${expectedProjectId}' via ${loadedFrom}.`);
            } else {
              const effectiveProjectId = adminAppInstance?.options.projectId || "unknown";
              adminSDKInitializationErrorMsg = `Firebase Admin SDK initialization for app '${uniqueAppNameWithTimestamp}' did not result in a retrievable app with the correct project ID. Expected '${expectedProjectId}', Got '${effectiveProjectId}'.`;
              console.error(`[Admin SDK Init Error V35] ${adminSDKInitializationErrorMsg}`);
              adminAppInstance = undefined; // Ensure it's undefined on failure
            }
          } catch (initError: any) {
            console.error(`[Admin SDK Init Error V35] FAILED during admin.initializeApp() for app '${uniqueAppNameWithTimestamp}'. Error:`, initError);
            adminSDKInitializationErrorMsg = `Failed to initialize Firebase Admin App '${uniqueAppNameWithTimestamp}'. Error: ${initError.message || String(initError)}.`;
            adminAppInstance = undefined; // Ensure it's undefined on failure
          }
        } else if (!adminSDKInitializationErrorMsg) { // If credential object creation failed silently
             adminSDKInitializationErrorMsg = 'Failed to create credential object (admin.credential.cert failed silently).';
             console.error(`[Admin SDK Init Error V35] ${adminSDKInitializationErrorMsg}`);
        }
      }
    }
  }
}

// Get services only if app instance is valid and no init error occurred
if (adminAppInstance && !adminSDKInitializationErrorMsg) {
  console.log(`[Admin SDK V35] adminAppInstance valid (${adminAppInstance.name}). Attempting to get Auth and Firestore services.`);
  try {
    if (!adminAuthService) { // Initialize only if not already initialized (e.g., by a previous import cycle)
        adminAuthService = getAuth(adminAppInstance);
        console.log(`[Admin SDK V35] adminAuthService obtained explicitly from app: ${adminAppInstance.name}.`);
    }
  } catch (e: any) {
    const authServiceError = `Error getting Auth service from initialized admin app: ${e.message}`;
    console.error(`[Admin SDK Init Error V35] ${authServiceError}`);
    adminSDKInitializationErrorMsg = (adminSDKInitializationErrorMsg ? adminSDKInitializationErrorMsg + '; ' : '') + authServiceError;
    adminAuthService = null;
  }

  try {
    if (!adminFirestoreDefaultDBInstance) { // Initialize only if not already initialized
        adminFirestoreDefaultDBInstance = getFirestore(adminAppInstance);
        console.log(`[Admin SDK V35] adminFirestoreDefaultDBInstance obtained explicitly from app: ${adminAppInstance.name}. DB Project ID: ${adminFirestoreDefaultDBInstance?.app?.options?.projectId}`);
    }
  } catch (e: any) {
    const firestoreServiceError = `Error getting Firestore (default) service from initialized admin app: ${e.message}`;
    console.error(`[Admin SDK Init Error V35] ${firestoreServiceError}`);
    adminSDKInitializationErrorMsg = (adminSDKInitializationErrorMsg ? adminSDKInitializationErrorMsg + '; ' : '') + firestoreServiceError;
    adminFirestoreDefaultDBInstance = null;
  }
} else {
  if (!adminSDKInitializationErrorMsg) { // If app instance is undefined for some reason not caught
    adminSDKInitializationErrorMsg = 'Firebase Admin SDK app could not be initialized (adminAppInstance is undefined after init block), and no specific error was caught. This is an unexpected state. (REF: UNKNOWN_INIT_FAIL_V35)';
  }
  console.error(`[Admin SDK V35] FINAL INITIALIZATION STATE: Error - ${adminSDKInitializationErrorMsg}. Auth and Firestore instances will be null.`);
  adminAuthService = null;
  adminFirestoreDefaultDBInstance = null;
  // adminFirestoreEcomDBInstance = null;
}

console.log(`[Admin SDK Final Status V35] Initialization Error: ${adminSDKInitializationErrorMsg || 'None'}. adminAuth is ${adminAuthService ? 'CONFIGURED' : 'NULL'}. adminFirestore_DefaultDB is ${adminFirestoreDefaultDBInstance ? `CONFIGURED for project: ${adminFirestoreDefaultDBInstance?.app?.options?.projectId}` : 'NULL'}.`);
console.log('--- [ADMIN SDK INIT END V35] ---');

export const adminSDKInitializationError = adminSDKInitializationErrorMsg;
export const adminAuth = adminAuthService;
export const adminFirestore_DefaultDB = adminFirestoreDefaultDBInstance;
// export const adminFirestore_EcomDB = adminFirestoreEcomDBInstance; // Still exporting, though not fully used yet

    