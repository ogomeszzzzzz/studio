
import * as admin from 'firebase-admin';
import path from 'path';
import fs from 'fs';

console.log('--- [ADMIN SDK INIT - ATTEMPTING INITIALIZATION V20] ---');
console.log(`[Admin SDK] Node Env: ${process.env.NODE_ENV}`);
console.log(`[Admin SDK] Initial admin.apps.length: ${admin.apps ? admin.apps.length : 'admin.apps is undefined/null'}`);

let adminApp: admin.app.App | undefined;
export let adminSDKInitializationError: string | null = null;

const expectedProjectId = "ecommerce-db-75f77";
const appName = `firebase-admin-app-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

if (!admin || !admin.credential || typeof admin.credential.cert !== 'function' || typeof admin.initializeApp !== 'function') {
  adminSDKInitializationError = "CRITICAL: The 'firebase-admin' module is not loaded correctly or essential parts are missing.";
  console.error(`[Admin SDK Init Error] ${adminSDKInitializationError}`);
} else {
  let serviceAccountCredentials: any;
  let loadedFrom = "";

  const serviceAccountPathEnv = process.env.FIREBASE_ADMIN_SDK_CONFIG_PATH;
  const serviceAccountStringEnv = process.env.FIREBASE_ADMIN_SDK_CONFIG;

  if (serviceAccountPathEnv && serviceAccountPathEnv.trim() !== '') {
    const absolutePath = path.resolve(process.cwd(), serviceAccountPathEnv.trim());
    console.log(`[Admin SDK] Attempting to initialize from FIREBASE_ADMIN_SDK_CONFIG_PATH: ${serviceAccountPathEnv}`);
    console.log(`[Admin SDK] Resolved absolute path for service account key: ${absolutePath}`);

    if (fs.existsSync(absolutePath)) {
      console.log(`[Admin SDK] Service account file FOUND at: ${absolutePath}`);
      try {
        const serviceAccountFileContent = fs.readFileSync(absolutePath, 'utf8');
        console.log('[Admin SDK] Service account file content read successfully.');
        serviceAccountCredentials = JSON.parse(serviceAccountFileContent);
        loadedFrom = "file path";
      } catch (e: any) {
        adminSDKInitializationError = `Failed to read or parse service account file at ${absolutePath}. Error: ${e.message || String(e)}.`;
        console.error(`[Admin SDK Init Error] ${adminSDKInitializationError}`);
      }
    } else {
      adminSDKInitializationError = `Service account file NOT FOUND at: ${absolutePath}. Will try FIREBASE_ADMIN_SDK_CONFIG next.`;
      console.warn(`[Admin SDK Init Warning] ${adminSDKInitializationError}`);
    }
  }

  if (!serviceAccountCredentials && serviceAccountStringEnv && serviceAccountStringEnv.trim() !== '{}' && serviceAccountStringEnv.trim() !== '') {
    console.log('[Admin SDK] Attempting to initialize from FIREBASE_ADMIN_SDK_CONFIG (JSON string).');
    try {
      serviceAccountCredentials = JSON.parse(serviceAccountStringEnv);
      loadedFrom = "env string";
      console.log(`[Admin SDK] Successfully parsed JSON from FIREBASE_ADMIN_SDK_CONFIG. Project ID from parsed string: ${serviceAccountCredentials?.project_id}`);
      
      // Explicitly replace \\n with \n in the private key
      if (serviceAccountCredentials && serviceAccountCredentials.private_key && typeof serviceAccountCredentials.private_key === 'string') {
        const originalPk = serviceAccountCredentials.private_key;
        serviceAccountCredentials.private_key = originalPk.replace(/\\n/g, '\n');
        if (originalPk !== serviceAccountCredentials.private_key) {
          console.log('[Admin SDK] Replaced "\\\\n" with "\\n" in private_key from ENV string.');
        }
        console.log(`[Admin SDK] Private key (after potential newline replacement) starts with: "${serviceAccountCredentials.private_key.substring(0, 30)}...", Ends with: "...${serviceAccountCredentials.private_key.substring(serviceAccountCredentials.private_key.length - 30)}"`);
        if (!serviceAccountCredentials.private_key.startsWith("-----BEGIN PRIVATE KEY-----") || !serviceAccountCredentials.private_key.endsWith("-----END PRIVATE KEY-----\n")) {
            console.warn("[Admin SDK Warning] Private key from ENV string (after replacements) does not seem to start/end with standard PEM headers/footers, or lacks final newline.");
        }
      }

    } catch (e: any) {
      adminSDKInitializationError = `Error parsing JSON from FIREBASE_ADMIN_SDK_CONFIG: ${e.message}. Ensure it's a valid single-line JSON string with escaped newlines (\\\\n) for the private_key.`;
      console.error(`[Admin SDK Init Error] ${adminSDKInitializationError}`);
    }
  } else if (!serviceAccountCredentials) {
    adminSDKInitializationError = 'Neither FIREBASE_ADMIN_SDK_CONFIG_PATH nor FIREBASE_ADMIN_SDK_CONFIG environment variables are set or provided valid credentials.';
    console.error(`[Admin SDK Init Error] ${adminSDKInitializationError}`);
  }


  if (serviceAccountCredentials && !adminSDKInitializationError) {
    console.log(`[Admin SDK] Service account credentials loaded via ${loadedFrom}. Project ID from credentials: ${serviceAccountCredentials.project_id}, Client Email: ${serviceAccountCredentials.client_email}`);

    const essentialFields = ['type', 'project_id', 'private_key', 'client_email'];
    const missingFields = essentialFields.filter(field => !(field in serviceAccountCredentials) || !serviceAccountCredentials[field]);

    if (missingFields.length > 0) {
      adminSDKInitializationError = `Parsed service account credentials (from ${loadedFrom}) are missing or have empty essential fields: ${missingFields.join(', ')}.`;
      console.error(`[Admin SDK Init Error] ${adminSDKInitializationError}`);
    } else if (serviceAccountCredentials.project_id !== expectedProjectId) {
      adminSDKInitializationError = `CRITICAL MISMATCH: Project ID in service account credentials ('${serviceAccountCredentials.project_id}') from ${loadedFrom} does NOT match the expected project ID ('${expectedProjectId}').`;
      console.error(`[Admin SDK Init Error] ${adminSDKInitializationError}`);
    } else {
      // Final check on private_key format before passing to cert()
      const pk = serviceAccountCredentials.private_key;
      if (typeof pk !== 'string' || !pk.startsWith("-----BEGIN PRIVATE KEY-----") || !pk.endsWith("-----END PRIVATE KEY-----\n")) {
        adminSDKInitializationError = `Private key from ${loadedFrom} is not a string or not correctly PEM formatted after all processing. Starts with: "${String(pk).substring(0,30)}", Ends with: "${String(pk).substring(String(pk).length - 30)}"`;
        console.error(`[Admin SDK Init Error] ${adminSDKInitializationError}`);
      }

      if (!adminSDKInitializationError) {
        console.log('[Admin SDK] Service account credentials appear valid and match expected project ID. Attempting to create credential object...');
        const credential = admin.credential.cert(serviceAccountCredentials);

        if (!credential || Object.keys(credential).length === 0) {
          adminSDKInitializationError = 'admin.credential.cert(serviceAccountCredentials) returned a falsy or empty credential object.';
          console.error(`[Admin SDK Init Error] ${adminSDKInitializationError}`);
        } else {
          console.log('[Admin SDK] Credential object created successfully by admin.credential.cert().');
          console.log(`[Admin SDK] Attempting admin.initializeApp() with unique name: ${appName} and explicit projectId: '${serviceAccountCredentials.project_id}'`);

          try {
            // Ensure no default app is lingering with the wrong config
            if (admin.apps.find(app => app?.name === '[DEFAULT]' && app.options.projectId !== expectedProjectId)) {
                 console.warn(`[Admin SDK] A [DEFAULT] app exists with a different projectId. This might cause issues if not handled.`);
            }

            adminApp = admin.initializeApp({
              credential,
              projectId: serviceAccountCredentials.project_id,
            }, appName);
            
            if (adminApp && adminApp.options.projectId === expectedProjectId) {
              adminSDKInitializationError = null; // Success!
              console.log(`[Admin SDK] Successfully initialized a new Firebase admin app: ${appName} for project '${expectedProjectId}' via ${loadedFrom}.`);
              console.log(`[Admin SDK] adminApp.name: ${adminApp.name}`);
              console.log(`[Admin SDK] adminApp.options.projectId: ${adminApp.options.projectId}`);
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
            const errorMessageDetail = initError.message ? initError.message : String(initError);
            const errorStack = initError.stack ? `\nStack: ${initError.stack}` : '';
            adminSDKInitializationError = `Failed to initialize Firebase Admin App '${appName}'. Error: ${errorMessageDetail}.${errorStack}`;
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
export const adminFirestore = adminApp ? adminApp.firestore("ecom") : null; // Explicitly use "ecom" database

if (adminSDKInitializationError) {
  console.error(`[Admin SDK] FINAL INITIALIZATION ERROR STATE: ${adminSDKInitializationError}`);
} else if (adminApp) {
  console.log(`[Admin SDK] Admin SDK services (Auth, Firestore) should be available. App name: ${adminApp.name}. Project ID: ${adminApp.options.projectId}. Firestore targeting 'ecom' database. Total apps in admin.apps: ${admin.apps ? admin.apps.length : 'N/A'}`);
} else {
  console.error("[Admin SDK] FINAL STATE: Admin SDK not initialized, adminApp is undefined, and no specific error string was set (this is unexpected).");
}
console.log('--- [ADMIN SDK INIT END V20] ---');
