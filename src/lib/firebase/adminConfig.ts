
import * as admin from 'firebase-admin';
import path from 'path';
import fs from 'fs';

console.log('--- [ADMIN SDK INIT - ATTEMPTING INITIALIZATION V15] ---');
console.log(`[Admin SDK] Node Env: ${process.env.NODE_ENV}`);
console.log(`[Admin SDK] Initial admin.apps.length: ${admin.apps ? admin.apps.length : 'admin.apps is undefined'}`);

let adminApp: admin.app.App | undefined;
export let adminSDKInitializationError: string | null = null;

const expectedProjectId = "ecommerce-db-75f77";

if (!admin || !admin.credential || typeof admin.credential.cert !== 'function' || typeof admin.initializeApp !== 'function') {
  adminSDKInitializationError = "CRITICAL: The 'firebase-admin' module is not loaded correctly or essential parts are missing.";
  console.error(`[Admin SDK Init Error] ${adminSDKInitializationError}`);
} else {
  let serviceAccountCredentials: any;
  const serviceAccountString = process.env.FIREBASE_ADMIN_SDK_CONFIG;
  const serviceAccountPath = process.env.FIREBASE_ADMIN_SDK_CONFIG_PATH;

  if (serviceAccountString && serviceAccountString.trim() !== '{}' && serviceAccountString.trim() !== '') {
    console.log('[Admin SDK] Attempting to initialize from FIREBASE_ADMIN_SDK_CONFIG (JSON string).');
    try {
      serviceAccountCredentials = JSON.parse(serviceAccountString);
      console.log(`[Admin SDK] Successfully parsed JSON from FIREBASE_ADMIN_SDK_CONFIG. Project ID from parsed string: ${serviceAccountCredentials?.project_id}`);
    } catch (e: any) {
      adminSDKInitializationError = `Error parsing JSON from FIREBASE_ADMIN_SDK_CONFIG: ${e.message}. Ensure it's a valid single-line JSON string with escaped newlines (\\n) for the private_key.`;
      console.error(`[Admin SDK Init Error] ${adminSDKInitializationError}`);
    }
  } else if (serviceAccountPath && serviceAccountPath.trim() !== '') {
    const absolutePath = path.resolve(process.cwd(), serviceAccountPath.trim());
    console.log(`[Admin SDK] FIREBASE_ADMIN_SDK_CONFIG is empty or not set. Attempting to initialize from FIREBASE_ADMIN_SDK_CONFIG_PATH: ${serviceAccountPath}`);
    console.log(`[Admin SDK] Resolved absolute path for service account key: ${absolutePath}`);

    if (fs.existsSync(absolutePath)) {
      console.log(`[Admin SDK] Service account file FOUND at: ${absolutePath}`);
      try {
        const serviceAccountFileContent = fs.readFileSync(absolutePath, 'utf8');
        console.log('[Admin SDK] Service account file content read successfully.');
        serviceAccountCredentials = JSON.parse(serviceAccountFileContent);
        console.log(`[Admin SDK] Successfully parsed JSON from file. Project ID from file: ${serviceAccountCredentials?.project_id}`);
      } catch (e: any) {
        adminSDKInitializationError = `Failed to read or parse service account file at ${absolutePath}. Error: ${e.message || String(e)}.`;
        console.error(`[Admin SDK Init Error] ${adminSDKInitializationError}`);
      }
    } else {
      adminSDKInitializationError = `Service account file NOT FOUND at: ${absolutePath}. Check FIREBASE_ADMIN_SDK_CONFIG_PATH. CWD: ${process.cwd()}`;
      console.error(`[Admin SDK Init Error] ${adminSDKInitializationError}`);
    }
  } else {
    adminSDKInitializationError = 'Neither FIREBASE_ADMIN_SDK_CONFIG nor FIREBASE_ADMIN_SDK_CONFIG_PATH environment variables are set or valid. Cannot initialize Admin SDK.';
    console.log(`[Admin SDK] ${adminSDKInitializationError}`);
  }

  if (serviceAccountCredentials && !adminSDKInitializationError) {
    console.log(`[Admin SDK] Service account credentials loaded. Project ID from credentials: ${serviceAccountCredentials.project_id}, Client Email: ${serviceAccountCredentials.client_email}`);

    const essentialFields = ['type', 'project_id', 'private_key', 'client_email'];
    const missingFields = essentialFields.filter(field => !(field in serviceAccountCredentials) || !serviceAccountCredentials[field]);

    if (missingFields.length > 0) {
      adminSDKInitializationError = `Parsed service account credentials are missing or have empty essential fields: ${missingFields.join(', ')}.`;
      console.error(`[Admin SDK Init Error] ${adminSDKInitializationError}`);
    } else if (serviceAccountCredentials.project_id !== expectedProjectId) {
      adminSDKInitializationError = `CRITICAL MISMATCH: Project ID in service account credentials ('${serviceAccountCredentials.project_id}') does NOT match the expected project ID ('${expectedProjectId}').`;
      console.error(`[Admin SDK Init Error] ${adminSDKInitializationError}`);
    } else {
      // Diagnostic for private_key format
      const pk = serviceAccountCredentials.private_key;
      if (typeof pk === 'string') {
        console.log(`[Admin SDK] Private key type is string. Starts with: "${pk.substring(0, 30)}...", Ends with: "...${pk.substring(pk.length - 30)}"`);
        if (!pk.startsWith("-----BEGIN PRIVATE KEY-----") || !pk.endsWith("-----END PRIVATE KEY-----\n")) {
            console.warn("[Admin SDK Warning] Private key does not seem to start/end with standard PEM headers/footers, or lacks final newline after parsing.");
        }
        if (pk.includes("\n") && !pk.includes("\\n")) {
            console.error("[Admin SDK CRITICAL Error Hint] Private key string contains literal newline characters ('\\n') after JSON parsing. It should contain escaped newlines ('\\\\n') in the original JSON string within FIREBASE_ADMIN_SDK_CONFIG in your .env file for them to be correctly interpreted as literal newlines in the PEM key.");
            adminSDKInitializationError = "Private key in FIREBASE_ADMIN_SDK_CONFIG is likely misformatted. Literal newlines detected. Use '\\\\n' for newlines in the .env JSON string.";
        } else if (pk.includes("\\n")) {
             console.log("[Admin SDK] Private key contains '\\\\n'. This is correct if it came from a JSON string in .env. admin.credential.cert should handle unescaping this to '\\n'.");
        } else {
            console.warn("[Admin SDK Warning] Private key does not contain '\\\\n'. If this came from an .env JSON string, newlines might be missing or were stripped.");
        }
      } else {
        console.error("[Admin SDK CRITICAL Error Hint] Private key is not a string after parsing credentials.");
        adminSDKInitializationError = "Private key is not a string in the parsed service account credentials.";
      }

      if (!adminSDKInitializationError) {
        console.log('[Admin SDK] Service account credentials appear valid and match expected project ID. Attempting to create credential object...');
        const credential = admin.credential.cert(serviceAccountCredentials);

        if (!credential || Object.keys(credential).length === 0) {
          adminSDKInitializationError = 'admin.credential.cert(serviceAccountCredentials) returned a falsy or empty credential object.';
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
            
            if (adminApp && adminApp.options.projectId === expectedProjectId) {
              adminSDKInitializationError = null; // Success!
              console.log(`[Admin SDK] Successfully initialized a new Firebase admin app: ${appName} for project '${expectedProjectId}'.`);
              console.log(`[Admin SDK] adminApp.name: ${adminApp.name}`);
              console.log(`[Admin SDK] adminApp.options.projectId: ${adminApp.options.projectId}`);
              // console.log(`[Admin SDK] Full adminApp.options object:`, JSON.stringify(adminApp.options, null, 2));
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
            adminSDKInitializationError = `Failed to initialize Firebase Admin App '${appName}'. Error: ${initError.message || String(initError)}. Details: ${initError.stack}`;
            adminApp = undefined;
          }
        }
      }
    }
  }
}

if (!adminApp && !adminSDKInitializationError) {
  adminSDKInitializationError = 'Firebase Admin SDK app could not be initialized, and no specific error was caught during the credential loading/parsing attempt. This is an unexpected state.';
  console.error(`[Admin SDK Init Error] ${adminSDKInitializationError}`);
}

export const adminAuth = adminApp ? adminApp.auth() : null;
export const adminFirestore = adminApp ? adminApp.firestore("ecom") : null;

if (adminSDKInitializationError) {
  console.error(`[Admin SDK] FINAL INITIALIZATION ERROR STATE: ${adminSDKInitializationError}`);
} else if (adminApp) {
  console.log(`[Admin SDK] Admin SDK services (Auth, Firestore) should be available. App name: ${adminApp.name}. Project ID: ${adminApp.options.projectId}. Firestore targeting 'ecom' database. Total apps in admin.apps: ${admin.apps ? admin.apps.length : 'N/A'}`);
} else {
  console.error("[Admin SDK] FINAL STATE: Admin SDK not initialized, adminApp is undefined, and no specific error string was set (this is unexpected).");
}
console.log('--- [ADMIN SDK INIT END V15] ---');

    