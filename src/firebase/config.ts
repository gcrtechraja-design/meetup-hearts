import { initializeApp, getApps } from 'firebase/app';
import { getAuth, setPersistence, browserLocalPersistence } from 'firebase/auth';
import { getFirestore, initializeFirestore } from 'firebase/firestore';
import rawConfig from '../../firebase-applet-config.json';

// Read environment overrides if explicitly provided; otherwise default to rawConfig (focused-balm-8vr20)
const envProjectId = (typeof process !== 'undefined' && process.env?.VITE_FIREBASE_PROJECT_ID)
  || (typeof import.meta !== 'undefined' && import.meta.env?.VITE_FIREBASE_PROJECT_ID);

let inputProjectId = (envProjectId && envProjectId.trim() !== '') ? envProjectId.trim() : rawConfig.projectId;

const envApiKey = (typeof process !== 'undefined' && process.env?.VITE_FIREBASE_API_KEY)
  || (typeof import.meta !== 'undefined' && import.meta.env?.VITE_FIREBASE_API_KEY);

let inputApiKey = (envApiKey && envApiKey.trim() !== '') ? envApiKey.trim() : rawConfig.apiKey;

// Automatic self-healing: detect if the user accidentally swapped API Key and Project ID in env vars
if (inputProjectId?.startsWith('AIzaSy') && !inputApiKey?.startsWith('AIzaSy')) {
  console.warn('[Firebase Config] Detected swapped API Key and Project ID in env variables. Auto-correcting...');
  const tempKey = inputProjectId;
  inputProjectId = inputApiKey || rawConfig.projectId;
  inputApiKey = tempKey;
}

export const projectId = inputProjectId;
export const apiKey = inputApiKey;

const envAuthDomain = (typeof process !== 'undefined' && process.env?.VITE_FIREBASE_AUTH_DOMAIN)
  || (typeof import.meta !== 'undefined' && import.meta.env?.VITE_FIREBASE_AUTH_DOMAIN);

let authDomain = (envAuthDomain && envAuthDomain.trim() !== '') ? envAuthDomain.trim() : rawConfig.authDomain;
if (!authDomain.includes('.')) {
  authDomain = `${projectId}.firebaseapp.com`;
}

const envStorageBucket = (typeof process !== 'undefined' && process.env?.VITE_FIREBASE_STORAGE_BUCKET)
  || (typeof import.meta !== 'undefined' && import.meta.env?.VITE_FIREBASE_STORAGE_BUCKET);

const storageBucket = (envStorageBucket && envStorageBucket.trim() !== '') ? envStorageBucket.trim() : rawConfig.storageBucket;

const envMessagingSenderId = (typeof process !== 'undefined' && process.env?.VITE_FIREBASE_MESSAGING_SENDER_ID)
  || (typeof import.meta !== 'undefined' && import.meta.env?.VITE_FIREBASE_MESSAGING_SENDER_ID);

const messagingSenderId = (envMessagingSenderId && envMessagingSenderId.trim() !== '') ? envMessagingSenderId.trim() : rawConfig.messagingSenderId;

const envAppId = (typeof process !== 'undefined' && process.env?.VITE_FIREBASE_APP_ID)
  || (typeof import.meta !== 'undefined' && import.meta.env?.VITE_FIREBASE_APP_ID);

const appId = (envAppId && envAppId.trim() !== '') ? envAppId.trim() : rawConfig.appId;

export const firebaseConfig = {
  ...rawConfig,
  apiKey,
  projectId,
  authDomain,
  storageBucket,
  messagingSenderId,
  appId,
};

// Initialize Primary Auth App
const app = getApps().find(a => a.name === '[DEFAULT]') || initializeApp(firebaseConfig);

export const auth = getAuth(app);
try {
  auth.useDeviceLanguage();
} catch (e) {
  console.warn('Could not set auth device language', e);
}

// Ensure auth persistence is explicitly set to LOCAL so session survives redirects & page refreshes
setPersistence(auth, browserLocalPersistence).catch((err) => {
  console.warn('[Firebase Auth] setPersistence error:', err);
});

// Bind to target database ID (ai-studio-remixremixmeetup-0491e31b-8282-4c08-89d9-df41e4fe9a50)
export const targetDatabaseId = rawConfig.firestoreDatabaseId && rawConfig.firestoreDatabaseId !== '(default)'
  ? rawConfig.firestoreDatabaseId
  : 'ai-studio-remixremixmeetup-0491e31b-8282-4c08-89d9-df41e4fe9a50';

// Initialize Firestore with experimentalAutoDetectLongPolling: true
// This is critical for preventing [code=unavailable] "Could not reach Cloud Firestore backend" in sandboxed / proxy environments
let firestoreInstance;
try {
  firestoreInstance = initializeFirestore(app, {
    experimentalAutoDetectLongPolling: true,
  }, targetDatabaseId);
} catch (e) {
  try {
    firestoreInstance = targetDatabaseId ? getFirestore(app, targetDatabaseId) : getFirestore(app);
  } catch {
    firestoreInstance = getFirestore(app);
  }
}

export const db = firestoreInstance;
export default app;
