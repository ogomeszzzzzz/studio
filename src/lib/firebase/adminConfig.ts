
'use server';

import * as admin from 'firebase-admin';
import { getAuth, type Auth } from 'firebase-admin/auth';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import fs from 'fs';
import path from 'path';

const LOG_VERSION_TAG_CONFIG = "V41"; // Updated Log Tag

console.log(`--- [ADMIN SDK INIT ${LOG_VERSION_TAG_CONFIG}] ---`);
console.log(`[Admin SDK ${LOG_VERSION_TAG_CONFIG}] Node Env: ${process.env.NODE_ENV}`);
console.log(`[Admin SDK ${LOG_VERSION_TAG_CONFIG}] Initial admin.apps.length: ${admin.apps ? admin.apps.length : 'admin.apps is undefined/null'}`);

const serviceAccountConfigEnv = process.env.FIREBASE_ADMIN_SDK_CONFIG;
const serviceAccountPathEnv = process.env.FIREBASE_ADMIN_SDK_CONFIG_PATH;

console.log(`[Admin SDK ${LOG_VERSION_TAG_CONFIG}] Env var FIREBASE_ADMIN_SDK_CONFIG_PATH: ${serviceAccountPathEnv ? `SET: '${serviceAccountPathEnv}' (Will be tried FIRST)` : 'NOT SET'}`);
console.log(`[Admin SDK ${LOG_VERSION_TAG_CONFIG}] Env var FIREBASE_ADMIN_SDK_CONFIG: ${serviceAccountConfigEnv ? 'SET (Will be tried as FALLBACK)' : 'NOT SET'}`);

let adminAppInstance: admin.app.App | undefined;
let _adminSDKInitializationErrorMsg: string | null = null;
let adminAuthService: Auth | null = null;
let adminFirestoreDefaultDBInstance: Firestore | null = null;

const expectedProjectId = "ecommerce-db-75f77";
const uniqueAppPrefix = `firebase-admin-app-${expectedProjectId}`;

if (!admin || !admin.credential || typeof admin.credential.cert !== 'function' || typeof admin.initializeApp !== 'function') {
  _adminSDKInitializationErrorMsg = `CRITICAL: 'firebase-admin' module not loaded correctly or essential parts are missing. (REF: SDK_LOAD_FAIL_${LOG_VERSION_TAG_CONFIG})`;
  console.error(`[Admin SDK Init Error ${LOG_VERSION_TAG_CONFIG}] ${_adminSDKInitializationErrorMsg}`);
} else {
  adminAppInstance = admin.apps.find(app => app?.name.startsWith(uniqueAppPrefix) && app?.options.projectId === expectedProjectId);

  if (adminAppInstance) {
    console.log(`[Admin SDK ${LOG_VERSION_TAG_CONFIG}] Using existing initialized admin app: ${adminAppInstance.name} for project ${adminAppInstance.options.projectId}`);
  } else {
    console.log(`[Admin SDK ${LOG_VERSION_TAG_CONFIG}] No existing app for prefix '${uniqueAppPrefix}' and project '${expectedProjectId}'. Attempting new init.`);
    let serviceAccountCredentials: any;
    let loadedFrom = "";

    if (serviceAccountPathEnv && serviceAccountPathEnv.trim() !== '') {
      const absolutePath = path.resolve(process.cwd(), serviceAccountPathEnv.trim());
      console.log(`[Admin SDK ${LOG_VERSION_TAG_CONFIG}] Attempting to initialize from FIREBASE_ADMIN_SDK_CONFIG_PATH: ${absolutePath}`);
      if (fs.existsSync(absolutePath)) {
        try {
          const fileContent = fs.readFileSync(absolutePath, 'utf8');
          serviceAccountCredentials = JSON.parse(fileContent);
          loadedFrom = `file path: ${serviceAccountPathEnv}`;
          console.log(`[Admin SDK ${LOG_VERSION_TAG_CONFIG}] Successfully parsed JSON from ${loadedFrom}.`);
        } catch (e: any) {
          _adminSDKInitializationErrorMsg = `Failed to read/parse service account file at ${absolutePath}. Error: ${e.message}. (REF: PARSE_FAIL_${LOG_VERSION_TAG_CONFIG})`;
          console.error(`[Admin SDK Init Error ${LOG_VERSION_TAG_CONFIG}] ${_adminSDKInitializationErrorMsg}`);
        }
      } else {
        _adminSDKInitializationErrorMsg = `Service account file NOT FOUND at: ${absolutePath}. (REF: PATH_NOT_FOUND_${LOG_VERSION_TAG_CONFIG})`;
        console.warn(`[Admin SDK Init Warning ${LOG_VERSION_TAG_CONFIG}] ${_adminSDKInitializationErrorMsg}`);
      }
    }

    if (!serviceAccountCredentials && serviceAccountConfigEnv && serviceAccountConfigEnv.trim() !== '{}' && serviceAccountConfigEnv.trim() !== '') {
      console.log(`[Admin SDK ${LOG_VERSION_TAG_CONFIG}] No creds from file, trying FIREBASE_ADMIN_SDK_CONFIG (ENV_STRING).`);
      _adminSDKInitializationErrorMsg = null;
      try {
        serviceAccountCredentials = JSON.parse(serviceAccountConfigEnv);
        loadedFrom = "env string: FIREBASE_ADMIN_SDK_CONFIG";
        if (serviceAccountCredentials.private_key && typeof serviceAccountCredentials.private_key === 'string') {
          serviceAccountCredentials.private_key = serviceAccountCredentials.private_key.replace(/\\n/g, '\n');
        }
        console.log(`[Admin SDK ${LOG_VERSION_TAG_CONFIG}] Successfully parsed JSON from ${loadedFrom}.`);
      } catch (e: any) {
        _adminSDKInitializationErrorMsg = `Error parsing JSON from FIREBASE_ADMIN_SDK_CONFIG: ${e.message}. (REF: ENV_JSON_PARSE_FAIL_${LOG_VERSION_TAG_CONFIG})`;
        console.error(`[Admin SDK Init Error ${LOG_VERSION_TAG_CONFIG}] ${_adminSDKInitializationErrorMsg}`);
      }
    }

    if (!serviceAccountCredentials && !_adminSDKInitializationErrorMsg) {
      _adminSDKInitializationErrorMsg = `Admin SDK creds not found. Neither path nor env string provided valid creds. (REF: NO_CREDS_FOUND_${LOG_VERSION_TAG_CONFIG})`;
      console.error(`[Admin SDK Init Error ${LOG_VERSION_TAG_CONFIG}] ${_adminSDKInitializationErrorMsg}`);
    }

    if (serviceAccountCredentials && !_adminSDKInitializationErrorMsg) {
      const essentialFields = ['type', 'project_id', 'private_key_id', 'private_key', 'client_email', 'client_id'];
      const missingFields = essentialFields.filter(field => !(field in serviceAccountCredentials) || !serviceAccountCredentials[field]);
      
      if (missingFields.length > 0) {
        _adminSDKInitializationErrorMsg = `Parsed creds (from ${loadedFrom}) missing fields: ${missingFields.join(', ')}. (REF: MISSING_FIELDS_${LOG_VERSION_TAG_CONFIG})`;
      } else if (serviceAccountCredentials.project_id !== expectedProjectId) {
        _adminSDKInitializationErrorMsg = `CRITICAL MISMATCH: Project ID in creds ('${serviceAccountCredentials.project_id}') != expected ('${expectedProjectId}'). (REF: PROJECT_ID_MISMATCH_${LOG_VERSION_TAG_CONFIG})`;
      } else {
        console.log(`[Admin SDK ${LOG_VERSION_TAG_CONFIG}] Creds details (from ${loadedFrom}): project_id: '${serviceAccountCredentials.project_id}', client_email: '${serviceAccountCredentials.client_email}'`);
        try {
          const uniqueAppName = `${uniqueAppPrefix}-${Date.now().toString(36)}`;
          adminAppInstance = admin.initializeApp({
            credential: admin.credential.cert(serviceAccountCredentials),
            projectId: serviceAccountCredentials.project_id,
          }, uniqueAppName);
          console.log(`[Admin SDK ${LOG_VERSION_TAG_CONFIG}] Successfully initialized NEW Firebase admin app: ${adminAppInstance.name} for project '${expectedProjectId}'.`);
        } catch (initError: any) {
          _adminSDKInitializationErrorMsg = `Failed to initialize Firebase Admin App. Error: ${initError.message}. (REF: INIT_APP_FAIL_${LOG_VERSION_TAG_CONFIG})`;
          console.error(`[Admin SDK Init Error ${LOG_VERSION_TAG_CONFIG}] ${_adminSDKInitializationErrorMsg}`);
          adminAppInstance = undefined;
        }
      }
    }
  }
}

// Perform service retrieval and internal test if app initialization was successful
if (adminAppInstance && !_adminSDKInitializationErrorMsg) {
  console.log(`[Admin SDK ${LOG_VERSION_TAG_CONFIG}] App instance '${adminAppInstance.name}' valid. App Project ID: ${adminAppInstance.options.projectId}. Getting services...`);

  try {
    adminAuthService = getAuth(adminAppInstance);
    console.log(`[Admin SDK ${LOG_VERSION_TAG_CONFIG}] Auth service obtained for app: ${adminAppInstance.name}.`);
  } catch (e: any) {
    _adminSDKInitializationErrorMsg = (_adminSDKInitializationErrorMsg ? `${_adminSDKInitializationErrorMsg}; ` : '') + `Error getting Auth service: ${e.message}. (REF: MODULAR_GET_AUTH_FAIL_${LOG_VERSION_TAG_CONFIG})`;
    console.error(`[Admin SDK Init Error ${LOG_VERSION_TAG_CONFIG}] ${_adminSDKInitializationErrorMsg}`);
  }

  try {
    const fsInstance = getFirestore(adminAppInstance);
    console.log(`[Admin SDK ${LOG_VERSION_TAG_CONFIG}] Firestore service obtained for app: ${adminAppInstance.name}. Firestore Project ID: ${fsInstance?.app?.options?.projectId}`);
    
    if (!fsInstance || !fsInstance.app || !fsInstance.app.options || typeof fsInstance.app.options.projectId !== 'string' || fsInstance.app.options.projectId.trim() === '') {
      const problem = !fsInstance ? "is null/undefined" 
                    : !fsInstance.app ? ".app is missing" 
                    : !fsInstance.app.options ? ".app.options is missing" 
                    : ".app.options.projectId is invalid";
      _adminSDKInitializationErrorMsg = (_adminSDKInitializationErrorMsg ? `${_adminSDKInitializationErrorMsg}; ` : '') + `Firestore instance integrity check failed: ${problem}. (REF: FS_INSTANCE_INTEGRITY_FAIL_${LOG_VERSION_TAG_CONFIG})`;
      console.error(`[Admin SDK Init Error ${LOG_VERSION_TAG_CONFIG}] ${_adminSDKInitializationErrorMsg}`);
    } else if (fsInstance.app.options.projectId !== expectedProjectId) {
      _adminSDKInitializationErrorMsg = (_adminSDKInitializationErrorMsg ? `${_adminSDKInitializationErrorMsg}; ` : '') + `CRITICAL MISMATCH: Firestore instance Project ID ('${fsInstance.app.options.projectId}') != expected ('${expectedProjectId}'). (REF: FS_INSTANCE_PID_MISMATCH_${LOG_VERSION_TAG_CONFIG})`;
      console.error(`[Admin SDK Init Error ${LOG_VERSION_TAG_CONFIG}] ${_adminSDKInitializationErrorMsg}`);
    } else {
      console.log(`[Admin SDK ${LOG_VERSION_TAG_CONFIG}] Firestore instance integrity check PASSED. Project ID from instance: ${fsInstance.app.options.projectId}`);
      adminFirestoreDefaultDBInstance = fsInstance; // Assign only if integrity check passes

      // ****** INTERNAL FIRESTORE TEST READ ******
      if (adminFirestoreDefaultDBInstance) {
        console.log(`[Admin SDK ${LOG_VERSION_TAG_CONFIG}] Performing internal Firestore test read...`);
        const testDocRef = adminFirestoreDefaultDBInstance.collection('internal_admin_test').doc('test_doc_read');
        testDocRef.get()
          .then(docSnapshot => {
            console.log(`[Admin SDK ${LOG_VERSION_TAG_CONFIG}] Internal Firestore test read SUCCEEDED. Doc exists: ${docSnapshot.exists}. (This is expected even if it doesn't exist, means auth worked)`);
          })
          .catch(testError => {
            console.error(`[Admin SDK ${LOG_VERSION_TAG_CONFIG}] CRITICAL: Internal Firestore test read FAILED. Error: ${testError.message}. Code: ${testError.code}. (REF: INTERNAL_FS_TEST_FAIL_${LOG_VERSION_TAG_CONFIG})`);
            _adminSDKInitializationErrorMsg = (_adminSDKInitializationErrorMsg ? `${_adminSDKInitializationErrorMsg}; ` : '') + `Internal Firestore test read FAILED: ${testError.message} (Code: ${testError.code}). (REF: INTERNAL_FS_TEST_FAIL_${LOG_VERSION_TAG_CONFIG})`;
            adminFirestoreDefaultDBInstance = null; // Nullify on internal test failure
            adminAuthService = null; // Also nullify auth as a precaution
          });
      }
      // ****** END INTERNAL FIRESTORE TEST READ ******
    }
  } catch (e: any) {
    _adminSDKInitializationErrorMsg = (_adminSDKInitializationErrorMsg ? `${_adminSDKInitializationErrorMsg}; ` : '') + `Error getting Firestore service: ${e.message}. (REF: MODULAR_GET_FIRESTORE_FAIL_${LOG_VERSION_TAG_CONFIG})`;
    console.error(`[Admin SDK Init Error ${LOG_VERSION_TAG_CONFIG}] ${_adminSDKInitializationErrorMsg}`);
  }
} else {
    console.log(`[Admin SDK ${LOG_VERSION_TAG_CONFIG}] Admin App instance not available or init error occurred. Skipping service retrieval. Error: ${_adminSDKInitializationErrorMsg || 'No adminAppInstance.'}`);
}

console.log(`[Admin SDK Final Status ${LOG_VERSION_TAG_CONFIG}] Initialization Error: ${_adminSDKInitializationErrorMsg || 'None'}. adminAuthService is ${adminAuthService ? 'CONFIGURED' : 'NULL'}. adminFirestoreDefaultDBInstance is ${adminFirestoreDefaultDBInstance ? `CONFIGURED for project: ${adminFirestoreDefaultDBInstance?.app?.options?.projectId}` : 'NULL'}.`);
console.log(`--- [ADMIN SDK INIT END ${LOG_VERSION_TAG_CONFIG}] ---`);
    
export async function getAdminAuthInstance(): Promise<Auth | null> {
    return adminAuthService;
}
    
export async function getAdminFirestoreInstance(): Promise<Firestore | null> {
  return adminFirestoreDefaultDBInstance;
}
    
export async function getAdminSDKInitializationError(): Promise<string | null> {
      return _adminSDKInitializationErrorMsg;
}
