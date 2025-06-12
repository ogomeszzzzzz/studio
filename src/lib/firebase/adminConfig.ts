
'use server';

import * as admin from 'firebase-admin';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import fs from 'fs';
import path from 'path';

const LOG_VERSION_TAG = "V36"; // Incremented version tag for logs

console.log(`--- [ADMIN SDK INIT ${LOG_VERSION_TAG} - Integrity Check Added] ---`);
console.log(`[Admin SDK ${LOG_VERSION_TAG}] Node Env: ${process.env.NODE_ENV}`);
console.log(`[Admin SDK ${LOG_VERSION_TAG}] Initial admin.apps.length: ${admin.apps ? admin.apps.length : 'admin.apps is undefined/null'}`);

const serviceAccountConfigEnv = process.env.FIREBASE_ADMIN_SDK_CONFIG;
const serviceAccountPathEnv = process.env.FIREBASE_ADMIN_SDK_CONFIG_PATH;

console.log(`[Admin SDK ${LOG_VERSION_TAG}] Env var FIREBASE_ADMIN_SDK_CONFIG_PATH: ${serviceAccountPathEnv ? `SET: '${serviceAccountPathEnv}' (Will be tried FIRST)` : 'NOT SET'}`);
console.log(`[Admin SDK ${LOG_VERSION_TAG}] Env var FIREBASE_ADMIN_SDK_CONFIG: ${serviceAccountConfigEnv ? 'SET (Will be tried as FALLBACK)' : 'NOT SET'}`);

let adminAppInstance: admin.app.App | undefined;
let adminSDKInitializationErrorMsg: string | null = null;
let adminAuthService: admin.auth.Auth | null = null;
let adminFirestoreDefaultDBInstance: admin.firestore.Firestore | null = null;

const expectedProjectId = "ecommerce-db-75f77";
const uniqueAppPrefix = `firebase-admin-app-${expectedProjectId}`;

if (!admin || !admin.credential || typeof admin.credential.cert !== 'function' || typeof admin.initializeApp !== 'function') {
  adminSDKInitializationErrorMsg = `CRITICAL: The 'firebase-admin' module is not loaded correctly or essential parts are missing. (REF: SDK_LOAD_FAIL_${LOG_VERSION_TAG})`;
  console.error(`[Admin SDK Init Error ${LOG_VERSION_TAG}] ${adminSDKInitializationErrorMsg}`);
} else {
  adminAppInstance = admin.apps.find(app => app?.name.startsWith(uniqueAppPrefix) && app?.options.projectId === expectedProjectId);

  if (adminAppInstance) {
    console.log(`[Admin SDK ${LOG_VERSION_TAG}] Using existing initialized admin app: ${adminAppInstance.name} for project ${adminAppInstance.options.projectId}`);
    adminSDKInitializationErrorMsg = null;
  } else {
    console.log(`[Admin SDK ${LOG_VERSION_TAG}] No existing app found for prefix '${uniqueAppPrefix}' and project '${expectedProjectId}'. Attempting new initialization.`);
    let serviceAccountCredentials: any;
    let loadedFrom = "";

    if (serviceAccountPathEnv && serviceAccountPathEnv.trim() !== '') {
      const absolutePath = path.resolve(process.cwd(), serviceAccountPathEnv.trim());
      console.log(`[Admin SDK ${LOG_VERSION_TAG}] Attempting to initialize from FIREBASE_ADMIN_SDK_CONFIG_PATH (ENV_PATH): ${serviceAccountPathEnv}`);
      console.log(`[Admin SDK ${LOG_VERSION_TAG}] Resolved absolute path: ${absolutePath}`);
      if (fs.existsSync(absolutePath)) {
        console.log(`[Admin SDK ${LOG_VERSION_TAG}] Service account file FOUND at: ${absolutePath}`);
        try {
          const fileContent = fs.readFileSync(absolutePath, 'utf8');
          serviceAccountCredentials = JSON.parse(fileContent);
          loadedFrom = `file path (ENV_PATH): ${serviceAccountPathEnv}`;
          console.log(`[Admin SDK ${LOG_VERSION_TAG}] Successfully parsed JSON from ${loadedFrom}.`);
        } catch (e: any) {
          adminSDKInitializationErrorMsg = `Failed to read/parse service account file at ${absolutePath}. Error: ${e.message || String(e)}. (REF: PARSE_FAIL_${LOG_VERSION_TAG})`;
          console.error(`[Admin SDK Init Error ${LOG_VERSION_TAG}] ${adminSDKInitializationErrorMsg}`);
          serviceAccountCredentials = null;
        }
      } else {
        const pathError = `Service account file NOT FOUND at: ${absolutePath} (from FIREBASE_ADMIN_SDK_CONFIG_PATH). (REF: PATH_NOT_FOUND_${LOG_VERSION_TAG})`;
        console.warn(`[Admin SDK Init Warning ${LOG_VERSION_TAG}] ${pathError} Will try ENV_STRING if configured.`);
        if (!adminSDKInitializationErrorMsg) adminSDKInitializationErrorMsg = pathError;
        serviceAccountCredentials = null;
      }
    }

    if (!serviceAccountCredentials && serviceAccountConfigEnv && serviceAccountConfigEnv.trim() !== '{}' && serviceAccountConfigEnv.trim() !== '') {
      console.log(`[Admin SDK ${LOG_VERSION_TAG}] Attempting to initialize from FIREBASE_ADMIN_SDK_CONFIG (ENV_STRING).`);
      adminSDKInitializationErrorMsg = null; // Clear path error
      try {
        serviceAccountCredentials = JSON.parse(serviceAccountConfigEnv);
        loadedFrom = "env string (ENV_STRING): FIREBASE_ADMIN_SDK_CONFIG";
        if (serviceAccountCredentials.private_key && typeof serviceAccountCredentials.private_key === 'string') {
          serviceAccountCredentials.private_key = serviceAccountCredentials.private_key.replace(/\\n/g, '\n');
        }
        console.log(`[Admin SDK ${LOG_VERSION_TAG}] Successfully parsed JSON from ${loadedFrom}.`);
      } catch (e: any) {
        adminSDKInitializationErrorMsg = `Error parsing JSON from FIREBASE_ADMIN_SDK_CONFIG: ${e.message}. (REF: ENV_JSON_PARSE_FAIL_${LOG_VERSION_TAG})`;
        console.error(`[Admin SDK Init Error ${LOG_VERSION_TAG}] ${adminSDKInitializationErrorMsg}`);
        serviceAccountCredentials = null;
      }
    }

    if (!serviceAccountCredentials && !adminSDKInitializationErrorMsg) {
      adminSDKInitializationErrorMsg = `Admin SDK credentials not found. Neither path nor env string provided valid creds. (REF: NO_CREDS_FOUND_${LOG_VERSION_TAG})`;
      console.error(`[Admin SDK Init Error ${LOG_VERSION_TAG}] ${adminSDKInitializationErrorMsg}`);
    }

    if (serviceAccountCredentials && !adminSDKInitializationErrorMsg) {
      const essentialFields = ['type', 'project_id', 'private_key_id', 'private_key', 'client_email', 'client_id', 'auth_uri', 'token_uri', 'auth_provider_x509_cert_url', 'client_x509_cert_url'];
      const missingFields = essentialFields.filter(field => !(field in serviceAccountCredentials) || !serviceAccountCredentials[field]);
      if (missingFields.length > 0) {
        adminSDKInitializationErrorMsg = `Parsed creds (from ${loadedFrom}) missing fields: ${missingFields.join(', ')}. (REF: MISSING_FIELDS_${LOG_VERSION_TAG})`;
        console.error(`[Admin SDK Init Error ${LOG_VERSION_TAG}] ${adminSDKInitializationErrorMsg}`);
      } else if (serviceAccountCredentials.project_id !== expectedProjectId) {
        adminSDKInitializationErrorMsg = `CRITICAL MISMATCH: Project ID in creds ('${serviceAccountCredentials.project_id}') from ${loadedFrom} != expected ('${expectedProjectId}'). (REF: PROJECT_ID_MISMATCH_${LOG_VERSION_TAG})`;
        console.error(`[Admin SDK Init Error ${LOG_VERSION_TAG}] ${adminSDKInitializationErrorMsg}`);
      } else {
        console.log(`[Admin SDK ${LOG_VERSION_TAG}] Credential details: project_id: '${serviceAccountCredentials.project_id}', client_email: '${serviceAccountCredentials.client_email}'`);
        let credential;
        try {
          credential = admin.credential.cert(serviceAccountCredentials);
        } catch (credError: any) {
          adminSDKInitializationErrorMsg = `Error creating credential object: ${credError.message}. (REF: CERT_CREATE_FAIL_${LOG_VERSION_TAG})`;
          console.error(`[Admin SDK Init Error ${LOG_VERSION_TAG}] ${adminSDKInitializationErrorMsg}`);
        }

        if (credential) {
          const uniqueAppName = `${uniqueAppPrefix}-${Date.now().toString(36)}`;
          console.log(`[Admin SDK ${LOG_VERSION_TAG}] Attempting admin.initializeApp() with name: ${uniqueAppName}, projectId: '${serviceAccountCredentials.project_id}'`);
          try {
            adminAppInstance = admin.initializeApp({ credential, projectId: serviceAccountCredentials.project_id }, uniqueAppName);
            if (adminAppInstance && adminAppInstance.options.projectId === expectedProjectId) {
              adminSDKInitializationErrorMsg = null;
              console.log(`[Admin SDK ${LOG_VERSION_TAG}] Successfully initialized NEW Firebase admin app: ${adminAppInstance.name} for project '${expectedProjectId}' via ${loadedFrom}.`);
            } else {
              adminSDKInitializationErrorMsg = `initializeApp succeeded but app instance for project '${expectedProjectId}' not correctly retrieved or project ID mismatch. (REF: APP_INSTANCE_FAIL_${LOG_VERSION_TAG})`;
              console.error(`[Admin SDK Init Error ${LOG_VERSION_TAG}] ${adminSDKInitializationErrorMsg}`);
              adminAppInstance = undefined;
            }
          } catch (initError: any) {
            adminSDKInitializationErrorMsg = `Failed to initialize Firebase Admin App '${uniqueAppName}'. Error: ${initError.message || String(initError)}. (REF: INIT_APP_FAIL_${LOG_VERSION_TAG})`;
            console.error(`[Admin SDK Init Error ${LOG_VERSION_TAG}] ${adminSDKInitializationErrorMsg}`);
            adminAppInstance = undefined;
          }
        }
      }
    }
  }
}

if (adminAppInstance && !adminSDKInitializationErrorMsg) {
  console.log(`[Admin SDK ${LOG_VERSION_TAG}] App instance '${adminAppInstance.name}' valid. Getting services...`);
  try {
    adminAuthService = getAuth(adminAppInstance);
    console.log(`[Admin SDK ${LOG_VERSION_TAG}] adminAuthService obtained for app: ${adminAppInstance.name}.`);
  } catch (e: any) {
    const authError = `Error getting Auth service: ${e.message}. (REF: GET_AUTH_FAIL_${LOG_VERSION_TAG})`;
    console.error(`[Admin SDK Init Error ${LOG_VERSION_TAG}] ${authError}`);
    adminSDKInitializationErrorMsg = (adminSDKInitializationErrorMsg ? `${adminSDKInitializationErrorMsg}; ` : '') + authError;
    adminAuthService = null;
  }

  try {
    adminFirestoreDefaultDBInstance = getFirestore(adminAppInstance);
    console.log(`[Admin SDK ${LOG_VERSION_TAG}] Initial adminFirestoreDefaultDBInstance obtained for app: ${adminAppInstance.name}.`);
    
    // **NEW INTEGRITY CHECK**
    if (adminFirestoreDefaultDBInstance) {
        console.log(`[Admin SDK ${LOG_VERSION_TAG}] Firestore instance obtained. Checking its integrity...`);
        if (!adminFirestoreDefaultDBInstance.app || 
            !adminFirestoreDefaultDBInstance.app.options || 
            typeof adminFirestoreDefaultDBInstance.app.options.projectId !== 'string' || 
            adminFirestoreDefaultDBInstance.app.options.projectId.trim() === '') {
            
            const problematicPart = !adminFirestoreDefaultDBInstance.app ? ".app is missing" :
                                   !adminFirestoreDefaultDBInstance.app.options ? ".app.options is missing" :
                                   typeof adminFirestoreDefaultDBInstance.app.options.projectId !== 'string' ? ".app.options.projectId is not a string" :
                                   ".app.options.projectId is empty";

            const integrityError = `Firestore instance integrity check failed: ${problematicPart}. This indicates a problem with the Firestore object. (REF: FS_INSTANCE_INTEGRITY_FAIL_${LOG_VERSION_TAG})`;
            console.error(`[Admin SDK Init Error ${LOG_VERSION_TAG}] ${integrityError}`);
            adminSDKInitializationErrorMsg = (adminSDKInitializationErrorMsg ? `${adminSDKInitializationErrorMsg}; ` : '') + integrityError;
            adminFirestoreDefaultDBInstance = null; // Nullify if malformed
        } else if (adminFirestoreDefaultDBInstance.app.options.projectId !== expectedProjectId) {
            const projectIdMismatchError = `Firestore instance integrity check failed: Project ID mismatch. Expected '${expectedProjectId}', got '${adminFirestoreDefaultDBInstance.app.options.projectId}'. (REF: FS_INSTANCE_PID_MISMATCH_${LOG_VERSION_TAG})`;
            console.error(`[Admin SDK Init Error ${LOG_VERSION_TAG}] ${projectIdMismatchError}`);
            adminSDKInitializationErrorMsg = (adminSDKInitializationErrorMsg ? `${adminSDKInitializationErrorMsg}; ` : '') + projectIdMismatchError;
            adminFirestoreDefaultDBInstance = null; // Nullify due to project ID mismatch
        } else {
            console.log(`[Admin SDK ${LOG_VERSION_TAG}] Firestore instance integrity check PASSED. Project ID from instance: ${adminFirestoreDefaultDBInstance.app.options.projectId}`);
        }
    } else { // This case should ideally not be hit if getFirestore was successful, but defensive.
        const firestoreNullError = `getFirestore(adminAppInstance) returned null/undefined. (REF: GET_FIRESTORE_NULL_${LOG_VERSION_TAG})`;
        console.error(`[Admin SDK Init Error ${LOG_VERSION_TAG}] ${firestoreNullError}`);
        adminSDKInitializationErrorMsg = (adminSDKInitializationErrorMsg ? `${adminSDKInitializationErrorMsg}; ` : '') + firestoreNullError;
        adminFirestoreDefaultDBInstance = null;
    }
  } catch (e: any) {
    const firestoreError = `Error getting Firestore (default) service: ${e.message}. (REF: GET_FIRESTORE_FAIL_${LOG_VERSION_TAG})`;
    console.error(`[Admin SDK Init Error ${LOG_VERSION_TAG}] ${firestoreError}`);
    adminSDKInitializationErrorMsg = (adminSDKInitializationErrorMsg ? `${adminSDKInitializationErrorMsg}; ` : '') + firestoreError;
    adminFirestoreDefaultDBInstance = null;
  }
} else {
  if (!adminSDKInitializationErrorMsg) {
    adminSDKInitializationErrorMsg = `Admin SDK app could not be initialized (adminAppInstance is undefined and no specific error caught). (REF: UNKNOWN_INIT_FAIL_${LOG_VERSION_TAG})`;
  }
  console.error(`[Admin SDK ${LOG_VERSION_TAG}] Services not initialized due to: ${adminSDKInitializationErrorMsg}`);
  adminAuthService = null;
  adminFirestoreDefaultDBInstance = null;
}

console.log(`[Admin SDK Final Status ${LOG_VERSION_TAG}] Initialization Error: ${adminSDKInitializationErrorMsg || 'None'}. adminAuth is ${adminAuthService ? 'CONFIGURED' : 'NULL'}. adminFirestore_DefaultDB is ${adminFirestoreDefaultDBInstance ? `CONFIGURED for project: ${adminFirestoreDefaultDBInstance?.app?.options?.projectId}` : 'NULL'}.`);
console.log(`--- [ADMIN SDK INIT END ${LOG_VERSION_TAG}] ---`);

export const adminSDKInitializationError = adminSDKInitializationErrorMsg;
export const adminAuth = adminAuthService;
export const adminFirestore_DefaultDB = adminFirestoreDefaultDBInstance;
