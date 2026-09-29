import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import rawConfig from '../../firebase-applet-config.json';

// Project "meet-up-new" Firebase Configuration (with env var overrides)
let inputProjectId = (typeof process !== 'undefined' && process.env?.VITE_FIREBASE_PROJECT_ID)
  || (typeof import.meta !== 'undefined' && import.meta.env?.VITE_FIREBASE_PROJECT_ID)
  || 'meet-up-new';

let inputApiKey = (typeof process !== 'undefined' && process.env?.VITE_FIREBASE_API_KEY)
  || (typeof import.meta !== 'undefined' && import.meta.env?.VITE_FIREBASE_API_KEY)
  || rawConfig.apiKey;

// Automatic self-healing: detect if the user accidentally swapped API Key and Project ID
if (inputProjectId?.startsWith('AIzaSy') && !inputApiKey?.startsWith('AIzaSy')) {
  console.warn('[Firebase Config] Detected swapped API Key and Project ID in env variables. Auto-correcting...');
  const tempKey = inputProjectId;
  inputProjectId = (inputApiKey && inputApiKey !== 'meet-up-new') ? inputApiKey : 'meet-up-new';
  inputApiKey = tempKey;
}

const projectId = inputProjectId;
const apiKey = inputApiKey;

let inputAuthDomain = (typeof process !== 'undefined' && process.env?.VITE_FIREBASE_AUTH_DOMAIN)
  || (typeof import.meta !== 'undefined' && import.meta.env?.VITE_FIREBASE_AUTH_DOMAIN)
  || (projectId === 'meet-up-new' ? 'meet-up-new.firebaseapp.com' : rawConfig.authDomain);

if (!inputAuthDomain.includes('.')) {
  inputAuthDomain = `${projectId}.firebaseapp.com`;
}
const authDomain = inputAuthDomain;

let inputStorageBucket = (typeof process !== 'undefined' && process.env?.VITE_FIREBASE_STORAGE_BUCKET)
  || (typeof import.meta !== 'undefined' && import.meta.env?.VITE_FIREBASE_STORAGE_BUCKET);

const storageBucket = (inputStorageBucket && !inputStorageBucket.startsWith('AIzaSy') && inputStorageBucket.includes('.'))
  ? inputStorageBucket
  : (projectId === 'meet-up-new' ? 'meet-up-new.firebasestorage.app' : rawConfig.storageBucket);

let inputMessagingSenderId = (typeof process !== 'undefined' && process.env?.VITE_FIREBASE_MESSAGING_SENDER_ID)
  || (typeof import.meta !== 'undefined' && import.meta.env?.VITE_FIREBASE_MESSAGING_SENDER_ID);

const messagingSenderId = (inputMessagingSenderId && /^\d+$/.test(inputMessagingSenderId))
  ? inputMessagingSenderId
  : rawConfig.messagingSenderId;

let inputAppId = (typeof process !== 'undefined' && process.env?.VITE_FIREBASE_APP_ID)
  || (typeof import.meta !== 'undefined' && import.meta.env?.VITE_FIREBASE_APP_ID);

const appId = (inputAppId && inputAppId.includes(':web:'))
  ? inputAppId
  : rawConfig.appId;

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

// Ensure Firestore binds to the correct database
let firestoreInstance;
try {
  if (projectId === 'meet-up-new') {
    // For meet-up-new, the primary Firestore database is '(default)'
    firestoreInstance = getFirestore(app);
  } else if (rawConfig.firestoreDatabaseId && rawConfig.firestoreDatabaseId !== '(default)' && rawConfig.projectId === projectId) {
    firestoreInstance = getFirestore(app, rawConfig.firestoreDatabaseId);
  } else {
    firestoreInstance = getFirestore(app);
  }
} catch {
  firestoreInstance = getFirestore(app);
}

export const db = firestoreInstance;
export default app;
