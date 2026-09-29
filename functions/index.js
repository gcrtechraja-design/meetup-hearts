const functions = require('firebase-functions');
const admin = require('firebase-admin');

if (!admin.apps.length) {
  admin.initializeApp();
}

// Meetup Coin Deduction Rate Constants
const AUDIO_COIN_PER_MINUTE = 10;
const VIDEO_COIN_PER_MINUTE = 50;
const AUDIO_COIN_PER_SECOND = AUDIO_COIN_PER_MINUTE / 60; // 10/60 per second
const VIDEO_COIN_PER_SECOND = VIDEO_COIN_PER_MINUTE / 60; // 50/60 per second

/**
 * Cloud Function Trigger: onCallCreated
 * Automatically sends high-priority background FCM push notification to the listener
 * when a caller creates an active call record in Firestore.
 */
exports.onCallCreated = functions.firestore
  .document('calls/{callId}')
  .onCreate(async (snap, context) => {
    const callData = snap.data();
    const callId = context.params.callId;

    if (!callData || callData.status !== 'ringing') {
      return null;
    }

    const receiverId = callData.receiver_id;
    if (!receiverId) return null;

    try {
      // 1. Fetch listener document to verify status and FCM token
      const receiverSnap = await admin.firestore().collection('users').doc(receiverId).get();
      if (!receiverSnap.exists) {
        console.log(`[FCM] Receiver ${receiverId} does not exist`);
        return null;
      }

      const receiver = receiverSnap.data();

      // Requirement 4: Verify listener is available before sending push
      const status = (receiver.status || '').toLowerCase();
      const presence = (receiver.presence_status || receiver.presence || '').toLowerCase();
      const isUnavailable = status === 'unavailable' || status === 'offline' || presence === 'unavailable' || presence === 'offline' || receiver.is_available === false;

      if (isUnavailable) {
        console.log(`[FCM] Listener ${receiverId} is marked unavailable/offline. Skipping push notification.`);
        return null;
      }

      const fcmToken = receiver.fcm_token;
      if (!fcmToken) {
        console.log(`[FCM] Listener ${receiverId} does not have a registered FCM token.`);
        return null;
      }

      const callerId = callData.caller_id || '';
      const callerName = callData.caller_name || 'Someone';
      const callType = callData.type === 'video' || callData.call_type === 'video' ? 'video' : 'audio';
      const callerPic = callData.caller_pic || '';
      const appDomain = process.env.APP_URL || 'https://meet-up-new.web.app';
      const clickAction = `${appDomain}/call?callId=${callId}`;

      // 2. Build high-priority FCM Message payload for background wake-up
      const message = {
        token: fcmToken,
        data: {
          type: 'incoming_call',
          callId: String(callId),
          callerId: String(callerId),
          callerName: String(callerName),
          callType: String(callType),
          callerPic: String(callerPic),
          click_action: clickAction,
          timestamp: String(Date.now())
        },
        android: {
          priority: 'high',
          notification: {
            title: `📞 Incoming ${callType === 'video' ? 'Video' : 'Audio'} Call`,
            body: `${callerName} is calling you live... Tap to answer.`,
            sound: 'default',
            channelId: 'incoming_calls',
            tag: `incoming-call-${callId}`,
            clickAction: clickAction
          },
          data: {
            callId: String(callId),
            callerId: String(callerId),
            type: 'incoming_call',
            click_action: clickAction
          }
        },
        webpush: {
          headers: {
            Urgency: 'high'
          },
          notification: {
            title: `📞 Incoming ${callType === 'video' ? 'Video' : 'Audio'} Call`,
            body: `${callerName} is calling you live. Tap to answer.`,
            icon: callerPic || '/icon-192.png',
            tag: `incoming-call-${callId}`,
            renotify: true,
            requireInteraction: true,
            click_action: clickAction
          },
          fcmOptions: {
            link: clickAction
          },
          data: {
            callId: String(callId),
            callerId: String(callerId),
            type: 'incoming_call',
            click_action: clickAction
          }
        }
      };

      const response = await admin.messaging().send(message);
      console.log(`[FCM] Successfully sent background call push for call ${callId}:`, response);
      return response;
    } catch (err) {
      console.error(`[FCM] Error sending call push for call ${callId}:`, err);
      return null;
    }
  });

/**
 * Cloud Function Trigger: onCallPushCreated
 * Explicit dispatcher for records added to call_pushes collection
 */
exports.onCallPushCreated = functions.firestore
  .document('call_pushes/{pushId}')
  .onCreate(async (snap, context) => {
    const data = snap.data();
    const token = data.listener_token;
    if (!token) return null;

    try {
      const callId = data.call_id || data.callId || '';
      const callerId = data.caller_id || data.callerId || '';
      const callerName = data.caller_name || data.callerName || 'Someone';
      const callType = data.call_type || data.callType || 'audio';
      const callerPic = data.caller_pic || data.callerPic || '';
      const appDomain = process.env.APP_URL || 'https://meet-up-new.web.app';
      const clickAction = data.click_action || `${appDomain}/call?callId=${callId}`;

      const message = {
        token: token,
        data: {
          type: 'incoming_call',
          callId: String(callId),
          callerId: String(callerId),
          callerName: String(callerName),
          callType: String(callType),
          callerPic: String(callerPic),
          click_action: clickAction,
          timestamp: String(Date.now())
        },
        android: {
          priority: 'high',
          notification: {
            title: `📞 Incoming ${callType === 'video' ? 'Video' : 'Audio'} Call`,
            body: `${callerName} is calling you live... Tap to answer.`,
            sound: 'default',
            channelId: 'incoming_calls',
            tag: `incoming-call-${callId}`,
            clickAction: clickAction
          },
          data: {
            callId: String(callId),
            callerId: String(callerId),
            type: 'incoming_call',
            click_action: clickAction
          }
        },
        webpush: {
          headers: { Urgency: 'high' },
          notification: {
            title: `📞 Incoming ${callType === 'video' ? 'Video' : 'Audio'} Call`,
            body: `${callerName} is calling you live. Tap to answer.`,
            icon: callerPic || '/icon-192.png',
            tag: `incoming-call-${callId}`,
            renotify: true,
            requireInteraction: true,
            click_action: clickAction
          },
          fcmOptions: {
            link: clickAction
          },
          data: {
            callId: String(callId),
            callerId: String(callerId),
            type: 'incoming_call',
            click_action: clickAction
          }
        }
      };

      const response = await admin.messaging().send(message);
      await snap.ref.update({ status: 'delivered', delivered_at: admin.firestore.FieldValue.serverTimestamp() });
      return response;
    } catch (err) {
      console.error('[FCM] onCallPushCreated error:', err);
      await snap.ref.update({ status: 'failed', error: err.message });
      return null;
    }
  });

/**
 * Cloud Function: deductCallCoins
 * Validates coin deduction rates (Audio: 10 coins/min, Video: 50 coins/min)
 */
exports.deductCallCoins = functions.https.onCall(async (data, context) => {
  const { callId, durationSeconds, callType } = data || {};
  const ratePerMinute = (callType === 'voice' || callType === 'audio') 
    ? AUDIO_COIN_PER_MINUTE 
    : VIDEO_COIN_PER_MINUTE;
  const ratePerSecond = ratePerMinute / 60;
  const totalMinutes = Math.max(1, Math.ceil((durationSeconds || 60) / 60));
  const totalCoins = totalMinutes * ratePerMinute;

  return {
    success: true,
    callId,
    ratePerMinute,
    ratePerSecond,
    totalMinutes,
    totalCoins
  };
});
