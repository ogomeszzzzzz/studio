
'use server';

import * as admin from 'firebase-admin';
import { getAuth as getAdminAuth, type Auth } from 'firebase-admin/auth'; // Renamed to avoid conflict
import { getFirestore as getAdminFirestore, type Firestore } from 'firebase-admin/firestore'; // Renamed to avoid conflict
import fs from 'fs';
import path from 'path';

const LOG_VERSION_TAG = "V36"; // Incremented version tag for logs

console.log(`--- [ADMIN SDK INIT ${LOG_VERSION_TAG} - Explicit Service Get, Integrity Check in Config] ---`);
console.log(`[Admin SDK ${LOG_VERSION_TAG}] Node Env: ${process.env.NODE_ENV}`);
console.log(`[Admin SDK ${LOG_VERSION_TAG}] Initial admin.apps.length: ${admin.apps ? admin.apps.length : 'admin.apps is undefined/null'}`);

const serviceAccountConfigEnv = process.env.FIREBASE_ADMIN_SDK_CONFIG;
const serviceAccountPathEnv = process.env.FIREBASE_ADMIN_SDK_CONFIG_PATH;

console.log(`[Admin SDK ${LOG_VERSION_TAG}] Env var FIREBASE_ADMIN_SDK_CONFIG_PATH: ${serviceAccountPathEnv ? `SET: '${serviceAccountPathEnv}' (Will be tried FIRST)` : 'NOT SET'}`);
console.log(`[Admin SDK ${LOG_VERSION_TAG}] Env var FIREBASE_ADMIN_SDK_CONFIG: ${serviceAccountConfigEnv ? 'SET (Will be tried as FALLBACK)' : 'NOT SET'}`);

let adminAppInstance: admin.app.App | undefined;
let _adminSDKInitializationErrorMsg: string | null = null; // Internal variable, not exported directly
let adminAuthService: Auth | null = null;
let adminFirestoreDefaultDBInstance: Firestore | null = null;

const expectedProjectId = "ecommerce-db-75f77";
const uniqueAppPrefix = `firebase-admin-app-${expectedProjectId}`; // App name prefix

if (!admin || !admin.credential || typeof admin.credential.cert !== 'function' || typeof admin.initializeApp !== 'function') {
  _adminSDKInitializationErrorMsg = `CRITICAL: The 'firebase-admin' module is not loaded correctly or essential parts are missing. (REF: SDK_LOAD_FAIL_${LOG_VERSION_TAG})`;
  console.error(`[Admin SDK Init Error ${LOG_VERSION_TAG}] ${_adminSDKInitializationErrorMsg}`);
} else {
  adminAppInstance = admin.apps.find(app => app?.name.startsWith(uniqueAppPrefix) && app?.options.projectId === expectedProjectId);

  if (adminAppInstance) {
    console.log(`[Admin SDK ${LOG_VERSION_TAG}] Using existing initialized admin app: ${adminAppInstance.name} for project ${adminAppInstance.options.projectId}`);
    // _adminSDKInitializationErrorMsg remains null
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
          _adminSDKInitializationErrorMsg = `Failed to read/parse service account file at ${absolutePath}. Error: ${e.message || String(e)}. (REF: PARSE_FAIL_${LOG_VERSION_TAG})`;
          console.error(`[Admin SDK Init Error ${LOG_VERSION_TAG}] ${_adminSDKInitializationErrorMsg}`);
          serviceAccountCredentials = null;
        }
      } else {
        const pathError = `Service account file NOT FOUND at: ${absolutePath} (from FIREBASE_ADMIN_SDK_CONFIG_PATH). (REF: PATH_NOT_FOUND_${LOG_VERSION_TAG})`;
        console.warn(`[Admin SDK Init Warning ${LOG_VERSION_TAG}] ${pathError} Will try ENV_STRING if configured.`);
        if (!_adminSDKInitializationErrorMsg) _adminSDKInitializationErrorMsg = pathError;
        serviceAccountCredentials = null;
      }
    }

    if (!serviceAccountCredentials && serviceAccountConfigEnv && serviceAccountConfigEnv.trim() !== '{}' && serviceAccountConfigEnv.trim() !== '') {
      console.log(`[Admin SDK ${LOG_VERSION_TAG}] Attempting to initialize from FIREBASE_ADMIN_SDK_CONFIG (ENV_STRING).`);
      _adminSDKInitializationErrorMsg = null; // Clear path error if any
      try {
        serviceAccountCredentials = JSON.parse(serviceAccountConfigEnv);
        loadedFrom = "env string (ENV_STRING): FIREBASE_ADMIN_SDK_CONFIG";
        if (serviceAccountCredentials.private_key && typeof serviceAccountCredentials.private_key === 'string') {
          serviceAccountCredentials.private_key = serviceAccountCredentials.private_key.replace(/\\n/g, '\n');
        }
        console.log(`[Admin SDK ${LOG_VERSION_TAG}] Successfully parsed JSON from ${loadedFrom}.`);
      } catch (e: any) {
        _adminSDKInitializationErrorMsg = `Error parsing JSON from FIREBASE_ADMIN_SDK_CONFIG: ${e.message}. (REF: ENV_JSON_PARSE_FAIL_${LOG_VERSION_TAG})`;
        console.error(`[Admin SDK Init Error ${LOG_VERSION_TAG}] ${_adminSDKInitializationErrorMsg}`);
        serviceAccountCredentials = null;
      }
    }

    if (!serviceAccountCredentials && !_adminSDKInitializationErrorMsg) {
      _adminSDKInitializationErrorMsg = `Admin SDK credentials not found. Neither path nor env string provided valid creds. (REF: NO_CREDS_FOUND_${LOG_VERSION_TAG})`;
      console.error(`[Admin SDK Init Error ${LOG_VERSION_TAG}] ${_adminSDKInitializationErrorMsg}`);
    }

    if (serviceAccountCredentials && !_adminSDKInitializationErrorMsg) {
      console.log(`[Admin SDK ${LOG_VERSION_TAG}] Credentials parsed from ${loadedFrom}. Validating essential fields...`);
      const essentialFields = ['type', 'project_id', 'private_key_id', 'private_key', 'client_email', 'client_id', 'auth_uri', 'token_uri', 'auth_provider_x509_cert_url', 'client_x509_cert_url'];
      const missingFields = essentialFields.filter(field => !(field in serviceAccountCredentials) || !serviceAccountCredentials[field]);
      
      if (missingFields.length > 0) {
        _adminSDKInitializationErrorMsg = `Parsed creds (from ${loadedFrom}) missing fields: ${missingFields.join(', ')}. (REF: MISSING_FIELDS_${LOG_VERSION_TAG})`;
        console.error(`[Admin SDK Init Error ${LOG_VERSION_TAG}] ${_adminSDKInitializationErrorMsg}`);
      } else if (serviceAccountCredentials.project_id !== expectedProjectId) {
        _adminSDKInitializationErrorMsg = `CRITICAL MISMATCH: Project ID in creds ('${serviceAccountCredentials.project_id}') from ${loadedFrom} != expected ('${expectedProjectId}'). (REF: PROJECT_ID_MISMATCH_${LOG_VERSION_TAG})`;
        console.error(`[Admin SDK Init Error ${LOG_VERSION_TAG}] ${_adminSDKInitializationErrorMsg}`);
      } else {
        console.log(`[Admin SDK ${LOG_VERSION_TAG}] Credential details: project_id: '${serviceAccountCredentials.project_id}', client_email: '${serviceAccountCredentials.client_email}'`);
        let credential;
        try {
          credential = admin.credential.cert(serviceAccountCredentials);
        } catch (credError: any) {
          _adminSDKInitializationErrorMsg = `Error creating credential object: ${credError.message}. (REF: CERT_CREATE_FAIL_${LOG_VERSION_TAG})`;
          console.error(`[Admin SDK Init Error ${LOG_VERSION_TAG}] ${_adminSDKInitializationErrorMsg}`);
        }

        if (credential) {
          const uniqueAppName = `${uniqueAppPrefix}-${Date.now().toString(36)}`; // Unique name for each potential init
          console.log(`[Admin SDK ${LOG_VERSION_TAG}] Attempting admin.initializeApp() with name: ${uniqueAppName}, projectId: '${serviceAccountCredentials.project_id}'`);
          try {
            adminAppInstance = admin.initializeApp({ credential, projectId: serviceAccountCredentials.project_id }, uniqueAppName);
            if (adminAppInstance && adminAppInstance.options.projectId === expectedProjectId) {
              // _adminSDKInitializationErrorMsg remains null
              console.log(`[Admin SDK ${LOG_VERSION_TAG}] Successfully initialized NEW Firebase admin app: ${adminAppInstance.name} for project '${expectedProjectId}' via ${loadedFrom}.`);
            } else {
              _adminSDKInitializationErrorMsg = `initializeApp succeeded but app instance for project '${expectedProjectId}' not correctly retrieved or project ID mismatch. (REF: APP_INSTANCE_FAIL_${LOG_VERSION_TAG})`;
              console.error(`[Admin SDK Init Error ${LOG_VERSION_TAG}] ${_adminSDKInitializationErrorMsg}`);
              adminAppInstance = undefined; // Nullify if problematic
            }
          } catch (initError: any) {
            _adminSDKInitializationErrorMsg = `Failed to initialize Firebase Admin App '${uniqueAppName}'. Error: ${initError.message || String(initError)}. (REF: INIT_APP_FAIL_${LOG_VERSION_TAG})`;
            console.error(`[Admin SDK Init Error ${LOG_VERSION_TAG}] ${_adminSDKInitializationErrorMsg}`);
            adminAppInstance = undefined; // Nullify
          }
        }
      }
    }
  }
}

if (adminAppInstance && !_adminSDKInitializationErrorMsg) {
  console.log(`[Admin SDK ${LOG_VERSION_TAG}] App instance '${adminAppInstance.name}' valid. Getting services...`);
  try {
    adminAuthService = getAdminAuth(adminAppInstance);
    console.log(`[Admin SDK ${LOG_VERSION_TAG}] adminAuthService obtained for app: ${adminAppInstance.name}.`);
  } catch (e: any) {
    const authError = `Error getting Auth service: ${e.message}. (REF: GET_AUTH_FAIL_${LOG_VERSION_TAG})`;
    console.error(`[Admin SDK Init Error ${LOG_VERSION_TAG}] ${authError}`);
    _adminSDKInitializationErrorMsg = (_adminSDKInitializationErrorMsg ? `${_adminSDKInitializationErrorMsg}; ` : '') + authError;
  }

  try {
    const fsInstance = getAdminFirestore(adminAppInstance);
    console.log(`[Admin SDK ${LOG_VERSION_TAG}] Candidate Firestore instance obtained for app: ${adminAppInstance.name}. Checking integrity...`);
    if (fsInstance && fsInstance.app && fsInstance.app.options && typeof fsInstance.app.options.projectId === 'string' && fsInstance.app.options.projectId.trim() !== '' && fsInstance.app.options.projectId === expectedProjectId) {
      adminFirestoreDefaultDBInstance = fsInstance;
      console.log(`[Admin SDK ${LOG_VERSION_TAG}] Firestore instance integrity check PASSED. Project ID from instance: ${adminFirestoreDefaultDBInstance.app.options.projectId}`);
    } else {
      const problematicPart = !fsInstance ? "is null" : !fsInstance.app ? ".app is missing" : !fsInstance.app.options ? ".app.options is missing" : typeof fsInstance.app.options.projectId !== 'string' ? ".app.options.projectId is not a string" : fsInstance.app.options.projectId.trim() === '' ? ".app.options.projectId is empty" : `project ID mismatch (expected '${expectedProjectId}', got '${fsInstance.app.options.projectId}')`;
      const integrityError = `Firestore instance integrity check failed: ${problematicPart}. (REF: FS_INSTANCE_INTEGRITY_FAIL_${LOG_VERSION_TAG})`;
      console.error(`[Admin SDK Init Error ${LOG_VERSION_TAG}] ${integrityError}`);
      _adminSDKInitializationErrorMsg = (_adminSDKInitializationErrorMsg ? `${_adminSDKInitializationErrorMsg}; ` : '') + integrityError;
      adminFirestoreDefaultDBInstance = null;
    }
  } catch (e: any) {
    const firestoreError = `Error getting Firestore (default) service: ${e.message}. (REF: GET_FIRESTORE_FAIL_${LOG_VERSION_TAG})`;
    console.error(`[Admin SDK Init Error ${LOG_VERSION_TAG}] ${firestoreError}`);
    _adminSDKInitializationErrorMsg = (_adminSDKInitializationErrorMsg ? `${_adminSDKInitializationErrorMsg}; ` : '') + firestoreError;
  }
}

if (_adminSDKInitializationErrorMsg) {
  console.error(`[Admin SDK ${LOG_VERSION_TAG}] Finalizing with initialization error: ${_adminSDKInitializationErrorMsg}`);
  adminAuthService = null;
  adminFirestoreDefaultDBInstance = null;
}

console.log(`[Admin SDK Final Status ${LOG_VERSION_TAG}] Initialization Error: ${_adminSDKInitializationErrorMsg || 'None'}. adminAuth is ${adminAuthService ? 'CONFIGURED' : 'NULL'}. adminFirestore_DefaultDB is ${adminFirestoreDefaultDBInstance ? `CONFIGURED for project: ${adminFirestoreDefaultDBInstance?.app?.options?.projectId}` : 'NULL'}.`);
console.log(`--- [ADMIN SDK INIT END ${LOG_VERSION_TAG}] ---`);

// Export only the service instances.
// The error message _adminSDKInitializationErrorMsg is logged here but not exported.
// Actions will check if adminAuth or adminFirestore_DefaultDB are null.
export const adminAuth = adminAuthService;
export const adminFirestore_DefaultDB = adminFirestoreDefaultDBInstance;
// Removed export const adminSDKInitializationError
