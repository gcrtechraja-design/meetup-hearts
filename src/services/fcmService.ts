/**
 * Firebase Cloud Messaging (FCM) Service
 * Manages notification permissions, FCM registration tokens, background call push notifications,
 * and service worker message synchronization.
 */

import { getMessaging, getToken, onMessage, isSupported, Messaging } from 'firebase/messaging';
import { doc, getDoc, updateDoc, collection, addDoc, serverTimestamp } from 'firebase/firestore';
import app, { db } from '../firebase/config';
import { isListenerOffline } from '../utils/presence';
import { UserProfile } from '../types';

let messagingInstance: Messaging | null = null;
let serviceWorkerRegistration: ServiceWorkerRegistration | null = null;
let hasInitialized = false;

// Callbacks for service worker incoming call actions
type CallActionHandler = (action: 'answer' | 'open' | 'decline', callId: string, callData?: any) => void;
const callActionHandlers = new Set<CallActionHandler>();

export const subscribeToCallPushActions = (handler: CallActionHandler) => {
  callActionHandlers.add(handler);
  return () => {
    callActionHandlers.delete(handler);
  };
};

/**
 * Initializes Firebase Messaging and registers the background call Service Worker
 */
export async function initFCM(): Promise<Messaging | null> {
  if (typeof window === 'undefined') return null;

  try {
    const supported = await isSupported();
    if (!supported) {
      console.warn('[FCM] Firebase Cloud Messaging is not supported in this browser environment.');
      return null;
    }

    if (!messagingInstance) {
      messagingInstance = getMessaging(app);
    }

    // Register / update the service worker
    if ('serviceWorker' in navigator && !serviceWorkerRegistration) {
      try {
        serviceWorkerRegistration = await navigator.serviceWorker.register('/firebase-messaging-sw.js', {
          scope: '/'
        });
        console.log('[FCM] Service worker registered with scope:', serviceWorkerRegistration.scope);
      } catch (swErr) {
        console.warn('[FCM] Failed to register firebase-messaging-sw.js:', swErr);
      }
    }

    // Set up foreground message listener
    if (!hasInitialized && messagingInstance) {
      hasInitialized = true;

      onMessage(messagingInstance, (payload) => {
        console.log('[FCM] Foreground push message received:', payload);
        const data = (payload.data || payload.notification || {}) as Record<string, any>;
        const callId = data.callId || data.call_id;
        if (callId) {
          callActionHandlers.forEach((handler) => handler('open', callId, data));
        }
      });

      // Listen for messages from the service worker (e.g. user answered from background notification)
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.addEventListener('message', (event) => {
          if (!event.data) return;
          const { type, callId, callData } = event.data;
          console.log('[FCM] Received message from service worker:', type, callId);

          if (type === 'FCM_ANSWER_CALL' && callId) {
            callActionHandlers.forEach((handler) => handler('answer', callId, callData));
          } else if (type === 'FCM_OPEN_CALL' && callId) {
            callActionHandlers.forEach((handler) => handler('open', callId, callData));
          } else if (type === 'FCM_DECLINE_CALL' && callId) {
            callActionHandlers.forEach((handler) => handler('decline', callId, callData));
          }
        });
      }
    }

    return messagingInstance;
  } catch (err) {
    console.warn('[FCM] initFCM error:', err);
    return null;
  }
}

/**
 * Requirement 1: Request notification permission on login and save FCM token to user document in Firestore
 */
export async function requestNotificationPermissionAndSaveToken(uid: string): Promise<{
  success: boolean;
  token: string | null;
  permission: NotificationPermission;
}> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return { success: false, token: null, permission: 'denied' };
  }

  try {
    const messaging = await initFCM();

    // Request notification permission from user
    const permission = await Notification.requestPermission();
    console.log('[FCM] Notification permission result:', permission);

    if (permission !== 'granted') {
      return { success: false, token: null, permission };
    }

    if (!messaging) {
      return { success: false, token: null, permission };
    }

    // Ensure service worker registration is active
    let swReg = serviceWorkerRegistration;
    if (!swReg && 'serviceWorker' in navigator) {
      swReg = await navigator.serviceWorker.ready;
    }

    // Retrieve FCM registration token
    let token: string | null = null;
    try {
      token = await getToken(messaging, {
        serviceWorkerRegistration: swReg || undefined
      });
    } catch (tokenErr) {
      console.warn('[FCM] getToken failed with swReg, trying default:', tokenErr);
      try {
        token = await getToken(messaging);
      } catch (fallbackErr) {
        console.warn('[FCM] Fallback getToken failed:', fallbackErr);
      }
    }

    if (token) {
      console.log('[FCM] Token retrieved successfully for user:', uid);
      // Persist to user document in Firestore
      await updateDoc(doc(db, 'users', uid), {
        fcm_token: token,
        fcm_token_updated_at: serverTimestamp()
      });
      return { success: true, token, permission: 'granted' };
    }

    return { success: false, token: null, permission: 'granted' };
  } catch (err: any) {
    console.error('[FCM] Failed to request permission and get token:', err);
    return { success: false, token: null, permission: Notification.permission };
  }
}

/**
 * Requirement 4 & 2:
 * 4) Only send push if listener's status is "available", if status is "not available" do not send push and show "Listener not available" to caller.
 * 2) When caller initiates call, send FCM push via Cloud Function / backend to listener's FCM token with callId, callerName, callType (audio/video).
 */
export async function sendCallPushNotification(params: {
  callId: string;
  callerId?: string;
  callerName: string;
  callType: 'voice' | 'video' | 'audio';
  callerPic?: string;
  listenerUid: string;
}): Promise<{
  success: boolean;
  sent: boolean;
  error?: string;
}> {
  const { callId, callerId, callerName, callType, callerPic, listenerUid } = params;

  try {
    // 1. Fetch fresh listener profile directly from Firestore to check availability
    const listenerDocRef = doc(db, 'users', listenerUid);
    const listenerSnap = await getDoc(listenerDocRef);

    if (!listenerSnap.exists()) {
      return {
        success: false,
        sent: false,
        error: 'Listener profile not found.'
      };
    }

    const listener = listenerSnap.data() as UserProfile;

    // Requirement 4: Verify listener status is available
    if (isListenerOffline(listener)) {
      console.log('[FCM] Listener is offline/unavailable. Skipping push.', listener.name);
      return {
        success: false,
        sent: false,
        error: 'Listener not available'
      };
    }

    if (listener.in_call) {
      return {
        success: false,
        sent: false,
        error: `${listener.name} is currently in another call.`
      };
    }

    // 2. Listener is AVAILABLE. Check for FCM token
    const fcmToken = listener.fcm_token;
    const normalizedType = callType === 'voice' ? 'audio' : callType;

    // Persist push dispatch record in Firestore for Cloud Function trigger & audit
    const clickAction = `${window.location.origin}/call?callId=${callId}`;
    await addDoc(collection(db, 'call_pushes'), {
      call_id: callId,
      caller_id: callerId || '',
      caller_name: callerName,
      call_type: normalizedType,
      caller_pic: callerPic || '',
      listener_id: listenerUid,
      listener_token: fcmToken || null,
      type: 'incoming_call',
      click_action: clickAction,
      status: fcmToken ? 'pending' : 'no_token',
      created_at: serverTimestamp()
    });

    if (!fcmToken) {
      console.log('[FCM] Listener has no registered FCM token. Real-time Firestore onSnapshot will notify in foreground.');
      return {
        success: true,
        sent: false
      };
    }

    // 3. Dispatch push via server proxy or Cloud Function endpoint
    try {
      const response = await fetch('/api/send-call-push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fcmToken,
          callId,
          callerId: callerId || '',
          callerName,
          callType: normalizedType,
          callerPic: callerPic || '',
          type: 'incoming_call',
          click_action: clickAction
        })
      });

      if (response.ok) {
        console.log('[FCM] Push dispatched successfully via server endpoint to listener token');
        return { success: true, sent: true };
      }
    } catch (apiErr) {
      console.log('[FCM] Server push proxy offline or in static mode. Push record logged to Firestore call_pushes.');
    }

    return { success: true, sent: true };
  } catch (err: any) {
    console.error('[FCM] sendCallPushNotification error:', err);
    return {
      success: false,
      sent: false,
      error: err.message || 'Failed to dispatch call notification.'
    };
  }
}

/**
 * Dismisses active background incoming call notification in Service Worker
 */
export function cancelBackgroundCallNotification(callId: string) {
  if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
    navigator.serviceWorker.controller.postMessage({
      type: 'CANCEL_INCOMING_NOTIFICATION',
      callId
    });
  }
}
