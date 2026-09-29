// Firebase Cloud Messaging & Background Incoming Call Service Worker
// Handles background incoming call push notifications like WhatsApp / FaceTime

const SW_VERSION = '1.0.0';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// Push Event: Triggers when an incoming call FCM push arrives while app is minimized or closed
self.addEventListener('push', (event) => {
  let payload = {};
  if (event.data) {
    try {
      payload = event.data.json();
    } catch (e) {
      try {
        payload = { data: { text: event.data.text() } };
      } catch (err) {
        payload = {};
      }
    }
  }

  // Normalize FCM data or notification payload
  const data = payload.data || payload.notification || payload;
  const isCall = data.type === 'CALL' || data.call_id || data.callId || (data.title && data.title.toLowerCase().includes('call'));

  const callId = data.callId || data.call_id || '';
  const callerName = data.callerName || data.caller_name || 'Someone';
  const callType = (data.callType || data.call_type || 'audio').toLowerCase();
  const isVideo = callType === 'video';
  const callerPic = data.callerPic || data.caller_pic || '/icon-192.png';

  const notificationTitle = isCall 
    ? `📞 Incoming ${isVideo ? 'Video' : 'Audio'} Call`
    : (data.title || 'Meet Up Notification');

  const notificationBody = isCall
    ? `${callerName} is calling you live. Tap to answer.`
    : (data.body || 'You have a new update in Meet Up.');

  const notificationOptions = {
    body: notificationBody,
    icon: callerPic,
    badge: '/icon-192.png',
    tag: callId ? `incoming-call-${callId}` : `meetup-push-${Date.now()}`,
    renotify: true,
    requireInteraction: true, // Keep notification pinned on screen like WhatsApp incoming call
    silent: false,
    vibrate: [500, 250, 500, 250, 500, 250, 1000],
    data: {
      callId,
      callerId: data.callerId || data.caller_id || '',
      callerName,
      callType,
      callerPic,
      type: 'incoming_call',
      timestamp: Date.now(),
      click_action: data.click_action || (callId ? `/?callId=${callId}&action=answer` : '/'),
      url: data.click_action || (callId ? `/?callId=${callId}&action=answer` : '/')
    },
    actions: isCall ? [
      {
        action: 'answer',
        title: '✅ Answer'
      },
      {
        action: 'reject',
        title: '❌ Decline'
      }
    ] : [
      {
        action: 'open',
        title: 'Open App'
      }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(notificationTitle, notificationOptions)
  );
});

// Notification Click Event: User interacts with notification or action buttons
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const action = event.action;
  const notifData = event.notification.data || {};
  const callId = notifData.callId || notifData.call_id || '';

  // If user declined the call directly from notification
  if (action === 'reject') {
    event.waitUntil(
      clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
        for (const client of windowClients) {
          client.postMessage({
            type: 'FCM_DECLINE_CALL',
            callId
          });
        }
      })
    );
    return;
  }

  // Determine click_action destination URL
  let clickActionUrl = notifData.click_action || notifData.url || '/';
  if (callId && !clickActionUrl.includes('callId=')) {
    const sep = clickActionUrl.includes('?') ? '&' : '?';
    clickActionUrl = `${clickActionUrl}${sep}callId=${callId}&action=answer`;
  }

  // Open window on notification click (Android Chrome and PWA standalone installed mode)
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // If an existing window or PWA standalone instance is running, focus it and navigate
      for (const client of windowClients) {
        if ('focus' in client) {
          client.focus();
          if ('navigate' in client && clickActionUrl) {
            client.navigate(clickActionUrl);
          }
          client.postMessage({
            type: 'FCM_ANSWER_CALL',
            callId,
            callData: notifData,
            click_action: clickActionUrl
          });
          return;
        }
      }

      // If app is killed or completely closed, open a new window with click_action
      if (clients.openWindow) {
        return clients.openWindow(clickActionUrl || notifData.click_action || '/');
      }
    })
  );
});

// Listen for messages from foreground app
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'CANCEL_INCOMING_NOTIFICATION') {
    const callId = event.data.callId;
    if (callId) {
      self.registration.getNotifications({ tag: `incoming-call-${callId}` }).then((notifications) => {
        notifications.forEach((n) => n.close());
      });
    }
  }
});
