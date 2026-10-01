import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';
import rawConfig from './firebase-applet-config.json';

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, process.cwd(), '');
  const rawUrl = env.VITE_SUPABASE_URL || env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
  const rawKey = env.VITE_SUPABASE_ANON_KEY || env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '';

  // Clean Supabase URL: strip /rest/v1 and trailing slashes so createClient receives the clean base origin
  const cleanUrl = rawUrl.trim().replace(/\/rest\/v1\/?$/i, '').replace(/\/auth\/v1\/?$/i, '').replace(/\/+$/, '');
  const cleanKey = rawKey.trim();

  // Firebase Configuration - defaults from rawConfig or environment overrides
  const firebaseApiKey = env.VITE_FIREBASE_API_KEY || rawConfig.apiKey;
  const firebaseAuthDomain = env.VITE_FIREBASE_AUTH_DOMAIN || rawConfig.authDomain;
  const firebaseProjectId = env.VITE_FIREBASE_PROJECT_ID || rawConfig.projectId;
  const firebaseStorageBucket = env.VITE_FIREBASE_STORAGE_BUCKET || rawConfig.storageBucket;
  const firebaseMessagingSenderId = env.VITE_FIREBASE_MESSAGING_SENDER_ID || rawConfig.messagingSenderId;
  const firebaseAppId = env.VITE_FIREBASE_APP_ID || rawConfig.appId;

  return {
    define: {
      'process.env.VITE_SUPABASE_URL': JSON.stringify(cleanUrl),
      'process.env.VITE_SUPABASE_ANON_KEY': JSON.stringify(cleanKey),
      'process.env.SUPABASE_URL': JSON.stringify(cleanUrl),
      'process.env.SUPABASE_ANON_KEY': JSON.stringify(cleanKey),
      'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(cleanUrl),
      'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify(cleanKey),
      'import.meta.env.SUPABASE_URL': JSON.stringify(cleanUrl),
      'import.meta.env.SUPABASE_ANON_KEY': JSON.stringify(cleanKey),
      'process.env.VITE_FIREBASE_API_KEY': JSON.stringify(firebaseApiKey),
      'process.env.VITE_FIREBASE_AUTH_DOMAIN': JSON.stringify(firebaseAuthDomain),
      'process.env.VITE_FIREBASE_PROJECT_ID': JSON.stringify(firebaseProjectId),
      'process.env.VITE_FIREBASE_STORAGE_BUCKET': JSON.stringify(firebaseStorageBucket),
      'process.env.VITE_FIREBASE_MESSAGING_SENDER_ID': JSON.stringify(firebaseMessagingSenderId),
      'process.env.VITE_FIREBASE_APP_ID': JSON.stringify(firebaseAppId),
      'import.meta.env.VITE_FIREBASE_API_KEY': JSON.stringify(firebaseApiKey),
      'import.meta.env.VITE_FIREBASE_AUTH_DOMAIN': JSON.stringify(firebaseAuthDomain),
      'import.meta.env.VITE_FIREBASE_PROJECT_ID': JSON.stringify(firebaseProjectId),
      'import.meta.env.VITE_FIREBASE_STORAGE_BUCKET': JSON.stringify(firebaseStorageBucket),
      'import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID': JSON.stringify(firebaseMessagingSenderId),
      'import.meta.env.VITE_FIREBASE_APP_ID': JSON.stringify(firebaseAppId),
    },
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(process.cwd(), '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
      host: '0.0.0.0',
      allowedHosts: true,
    },
    preview: {
      host: '0.0.0.0',
      port: 3000,
      allowedHosts: true,
    },
  };
});
