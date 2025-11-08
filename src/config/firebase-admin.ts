import { App, cert, getApps, initializeApp } from "firebase-admin/app";
import { Messaging, getMessaging as getAdminMessaging } from "firebase-admin/messaging";

type FirebaseCredentials = {
  projectId: string;
  clientEmail: string;
  privateKey: string;
};

let firebaseApp: App | undefined;

const REQUIRED_ENV_VARS = [
  "FIREBASE_PROJECT_ID",
  "FIREBASE_CLIENT_EMAIL",
  "FIREBASE_PRIVATE_KEY",
] as const;

function buildCredentials(): FirebaseCredentials {
  const missing = REQUIRED_ENV_VARS.filter(
    (key) => !process.env[key] || !process.env[key]?.trim()
  );

  if (missing.length) {
    throw new Error(
      `Variables de entorno faltantes para Firebase: ${missing.join(", ")}`
    );
  }

  const projectId = process.env.FIREBASE_PROJECT_ID!.trim();
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL!.trim();
  const rawPrivateKey = process.env.FIREBASE_PRIVATE_KEY!;

  return {
    projectId,
    clientEmail,
    privateKey: rawPrivateKey.replace(/\\n/g, "\n"),
  };
}

export function isFirebaseConfigured(): boolean {
  return REQUIRED_ENV_VARS.every(
    (key) => typeof process.env[key] === "string" && !!process.env[key]?.trim()
  );
}

export function initializeFirebaseAdmin(): App {
  if (firebaseApp) {
    return firebaseApp;
  }

  const existingApps = getApps();
  if (existingApps.length) {
    firebaseApp = existingApps[0]!;
    return firebaseApp;
  }

  const credentials = buildCredentials();
  firebaseApp = initializeApp({
    credential: cert(credentials),
    projectId: credentials.projectId,
  });

  return firebaseApp;
}

export function getFirebaseMessaging(): Messaging {
  const app = initializeFirebaseAdmin();
  return getAdminMessaging(app);
}
