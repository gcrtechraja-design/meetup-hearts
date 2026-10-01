# Secrets & Integrations Inventory

This document details all third-party services, APIs, environment variables, credentials, and integration endpoints used in **Remix Remix Meet Up**.

---

## 1. Services & Credentials Table

| Service / Platform | Purpose in App | Environment Variable Name | Where to Obtain Key / Console URL | Status & Location in Code |
| :--- | :--- | :--- | :--- | :--- |
| **Firebase Auth & Firestore** | User authentication (Phone OTP, Google OAuth), profiles, real-time messaging, coin ledger, active calls, call logs | `VITE_FIREBASE_PROJECT_ID`<br>`VITE_FIREBASE_API_KEY`<br>`VITE_FIREBASE_AUTH_DOMAIN` | [Firebase Console - Project Settings](https://console.firebase.google.com/project/_/settings/general/) | **Configured**: Read from env with fallbacks in `vite.config.ts`, `src/firebase/config.ts`, and `firebase-applet-config.json` |
| **Firebase Cloud Messaging (FCM)** | Background push notifications for incoming voice & video calls when app is in background/minimized | `VITE_FIREBASE_MESSAGING_SENDER_ID`<br>`VITE_FIREBASE_APP_ID` | [Firebase Console - Cloud Messaging](https://console.firebase.google.com/project/_/settings/cloudmessaging/) | **Configured**: Read from env with fallbacks in `vite.config.ts`, `src/firebase/config.ts`, and `firebase-applet-config.json` |
| **Firebase Storage** | Profile photos, audio introductions, and media assets | `VITE_FIREBASE_STORAGE_BUCKET` | [Firebase Console - Storage](https://console.firebase.google.com/project/_/storage) | **Configured**: Read from env with fallbacks in `vite.config.ts`, `src/firebase/config.ts`, and `firebase-applet-config.json` |
| **Google Cloud OAuth** | Google Sign-In popup authentication | *(Configured via Firebase Auth)* | [Google Cloud Console - Credentials](https://console.cloud.google.com/apis/credentials) | **Configured**: OAuth Client ID defined in `firebase-applet-config.json` |
| **ZEGOCLOUD** | Real-time 1-on-1 audio/video calling, camera/mic management, and call UI kit | `VITE_ZEGOCLOUD_APP_ID`<br>`VITE_ZEGOCLOUD_SERVER_SECRET` | [ZEGOCLOUD Admin Console](https://console.zegocloud.com/) | **Configured**: Read from env with defaults in `src/services/zegoService.ts` (lines 3–4) |
| **Supabase** | Optional secondary storage (photos bucket), profile sync, and owner dashboard queries | `VITE_SUPABASE_URL`<br>`VITE_SUPABASE_ANON_KEY`<br>`SUPABASE_URL`<br>`SUPABASE_ANON_KEY` | [Supabase Dashboard - API Settings](https://supabase.com/dashboard/project/_/settings/api) | **Optional**: Read from env in `src/services/supabase.ts` (lines 27–36) with localStorage override support |
| **WebRTC STUN (Google & Twilio)** | NAT traversal & public IP discovery for peer-to-peer WebRTC connections | None (Public STUN servers) | Public STUN infrastructure | **Hardcoded**: Public STUN URLs in `src/services/webrtcService.ts` (lines 36–39) |
| **WebRTC TURN (OpenRelay)** | Relay fallback for strict NAT / firewall traversal | None | [OpenRelay Project](https://www.metered.ca/openrelay/) | **Hardcoded**: Free test relay credentials in `src/services/webrtcService.ts` (lines 51–57) |
| **Manual UPI Payment Gateway** | Instant coin recharge via GPay, PhonePe, Paytm QR code deep-links | Dynamic Firestore config (`settings/payment_config` -> `upi_id`) | In-App Admin Dashboard -> "UPI Settings" tab | **Dynamic**: Fetched from Firestore document `settings/payment_config`; zero hardcoding |
| **Google Gemini API** | AI-assisted features and server-side logic | `GEMINI_API_KEY` | [Google AI Studio - API Keys](https://aistudio.google.com/app/apikey) | **Injected at runtime** by AI Studio runtime environment |

---

## 2. Masked Credentials Audit

*All secrets are masked showing only the first 4 characters for security:*

- **Firebase Web API Key (meet-up-new)**: `AIza****` (`vite.config.ts`, `.env.example`)
- **Firebase Web API Key (focused-balm-8vr20)**: `AIza****` (`firebase-applet-config.json`)
- **Firebase Project ID**: `meet****` / `focu****`
- **Firebase Web App ID**: `1:90****` / `1:84****`
- **Firebase Messaging Sender ID**: `9078****` / `8485****`
- **Google OAuth 2.0 Client ID**: `8485****.apps.googleusercontent.com` (`firebase-applet-config.json`)
- **ZEGOCLOUD App ID**: `1484****` (`src/services/zegoService.ts`)
- **ZEGOCLOUD Server Secret**: `4068****` (`src/services/zegoService.ts`)
- **OpenRelay TURN User & Credential**: `open****` (`src/services/webrtcService.ts`)
- **Supabase Anon Key (Mock Fallback)**: `eyJh****` (`src/services/supabase.ts`)

---

## 3. Third-Party Endpoints, Webhooks & Redirect URIs

### OAuth Redirect URIs & Handlers (Google Sign-In)
Register the following in **Firebase Console -> Authentication -> Settings -> Authorized Domains**:
- `https://meet-up-new.firebaseapp.com/__/auth/handler`
- `https://focused-balm-8vr20.firebaseapp.com/__/auth/handler`
- `https://ais-dev-etilwugziiszwleef7eccc-961996329317.asia-southeast1.run.app`
- `https://ais-pre-etilwugziiszwleef7eccc-961996329317.asia-southeast1.run.app`
- `http://localhost:3000`

### Real-Time & Media Endpoints
- **ZEGOCLOUD Signaling & Media**: `wss://*.zegocloud.com`, `https://*.zegocloud.com`
- **STUN Servers**:
  - `stun:stun.l.google.com:19302`
  - `stun:stun1.l.google.com:19302`
  - `stun:stun2.l.google.com:19302`
  - `stun:global.stun.twilio.com:3478`
- **TURN Relay**:
  - `turn:openrelay.metered.ca:80`
  - `turn:openrelay.metered.ca:443`
- **UPI Deep-Link Scheme**:
  - `upi://pay?pa={fetched_upi_id}&pn=RajaMarriageApp&am={amount}&cu=INR`
- **Internal Webhook**:
  - `POST /api/send-call-push` (Handled by `server.ts`)

---

## 4. Production Readiness Checklist

1. **Firebase Authentication**: Confirm Phone Auth (SMS) and Google Sign-In providers are enabled in Firebase Console.
2. **Firestore Security Rules**: Rules are deployed; verify read/write rules for `users`, `calls`, `transactions`, and `settings`.
3. **ZEGOCLOUD**: Confirm production App ID and Server Secret in `.env` before public launch.
4. **Manual UPI Coin Store**: Ensure the administrator has saved an active UPI ID under Admin Panel -> "UPI Settings" (stored in `settings/payment_config`).
5. **Firebase Cloud Messaging (FCM)**: Generate a Web Push Certificate (VAPID key) under Firebase Project Settings -> Cloud Messaging for web notifications.
