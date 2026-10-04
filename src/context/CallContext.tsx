import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { 
  collection, 
  doc, 
  addDoc, 
  updateDoc, 
  onSnapshot, 
  query, 
  where, 
  getDocs,
  serverTimestamp, 
  increment, 
  getDoc 
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from './AuthContext';
import { ActiveCall, CallLog, UserProfile, AUDIO_COIN_PER_MINUTE, VIDEO_COIN_PER_MINUTE } from '../types';
import { saveRoomToSupabase, updateRoomInSupabase } from '../services/supabase';
import { getUserAvatarUrl } from '../services/staticCdnService';
import { ringtoneService } from '../services/ringtoneService';
import { isListenerOffline } from '../utils/presence';
import { DUMMY_LISTENERS } from '../data/dummyListeners';
import { 
  sendCallPushNotification, 
  cancelBackgroundCallNotification, 
  subscribeToCallPushActions 
} from '../services/fcmService';

export interface SurpriseCallState {
  active: boolean;
  attempt: number;
  type: 'audio' | 'video';
  targetListenerName?: string;
  showNoListenersPopup: boolean;
  message?: string;
}

interface CallContextType {
  activeCall: ActiveCall | null;
  incomingCall: ActiveCall | null;
  callDuration: number;
  isInCall: boolean;
  surpriseCallState: SurpriseCallState;
  initiateCall: (receiver: UserProfile, type: 'voice' | 'video') => Promise<{ success: boolean; error?: string }>;
  startSurpriseCall: (type: 'audio' | 'video') => Promise<void>;
  cancelSurpriseCall: () => void;
  closeNoListenersPopup: () => void;
  acceptCall: () => Promise<void>;
  joinCallById: (callId: string) => Promise<void>;
  declineCall: () => Promise<void>;
  endCall: () => Promise<void>;
  joinRoomAsOwner: (room: ActiveCall) => Promise<void>;
  ownerEndCall: (callId: string) => Promise<void>;
  ownerMuteCall: (callId: string, isMuted: boolean) => Promise<void>;
}

const CallContext = createContext<CallContextType | undefined>(undefined);

export const CallProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentUser } = useAuth();
  const [activeCall, setActiveCall] = useState<ActiveCall | null>(null);
  const [incomingCall, setIncomingCall] = useState<ActiveCall | null>(null);
  const [callDuration, setCallDuration] = useState<number>(0);

  // Surprise Call state
  const [surpriseCallState, setSurpriseCallState] = useState<SurpriseCallState>({
    active: false,
    attempt: 0,
    type: 'video',
    showNoListenersPopup: false,
  });

  const timerRef = useRef<any>(null);
  const billingIntervalRef = useRef<any>(null);
  const activeCallRef = useRef<ActiveCall | null>(null);
  activeCallRef.current = activeCall;

  const callTimeoutRef = useRef<any>(null);
  const surpriseTimeoutRef = useRef<any>(null);
  const surpriseUnsubRef = useRef<(() => void) | null>(null);
  const surpriseActiveRef = useRef<boolean>(false);
  const triedListenerIdsRef = useRef<string[]>([]);

  // Requirement 1 & 3: Play outgoing ringing tone in loop when caller is waiting for answer
  useEffect(() => {
    const isCaller = activeCall?.caller_id === currentUser?.uid;
    const isRinging = activeCall?.status === 'ringing';

    if (isCaller && isRinging) {
      ringtoneService.startOutgoingRingtone();
    } else {
      ringtoneService.stopOutgoingRingtone();
    }

    return () => {
      ringtoneService.stopOutgoingRingtone();
    };
  }, [activeCall?.status, activeCall?.caller_id, currentUser?.uid]);

  // Requirement 2 & 3: Listen to incoming calls for current user and trigger incoming ringtone with vibration
  useEffect(() => {
    if (!currentUser) {
      setIncomingCall(null);
      ringtoneService.stopIncomingRingtone();
      return;
    }

    const callsRef = collection(db, 'calls');
    const q = query(
      callsRef,
      where('receiver_id', '==', currentUser.uid),
      where('status', '==', 'ringing')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (!snapshot.empty) {
        const callDoc = snapshot.docs[0];
        setIncomingCall({
          id: callDoc.id,
          ...callDoc.data(),
        } as ActiveCall);
        ringtoneService.startIncomingRingtone();
      } else {
        setIncomingCall(null);
        ringtoneService.stopIncomingRingtone();
      }
    }, (err) => {
      console.error('Call listener error:', err);
    });

    return () => {
      unsubscribe();
      ringtoneService.stopIncomingRingtone();
    };
  }, [currentUser]);

  // Requirement 3: Listen for Service Worker background push actions (Answer / Open / Decline) and handle URL params
  useEffect(() => {
    const unsubPush = subscribeToCallPushActions(async (action, callId) => {
      console.log('[CallContext] Received call push action from SW:', action, callId);
      if (!callId) return;

      try {
        const callSnap = await getDoc(doc(db, 'calls', callId));
        if (callSnap.exists()) {
          const callData = { id: callSnap.id, ...callSnap.data() } as ActiveCall;
          if (callData.status === 'ringing') {
            setIncomingCall(callData);
            ringtoneService.startIncomingRingtone();

            if (action === 'answer') {
              setTimeout(() => {
                acceptCall();
              }, 150);
            } else if (action === 'decline') {
              declineCall();
            }
          }
        }
      } catch (err) {
        console.warn('[CallContext] Error handling push action:', err);
      }
    });

    // Check if app was opened with query parameters (?callId=xyz or ?incomingCallId=xyz)
    if (typeof window !== 'undefined' && window.location.search) {
      const params = new URLSearchParams(window.location.search);
      const targetCallId = params.get('callId') || params.get('incomingCallId');
      const action = params.get('action');

      if (targetCallId) {
        console.log('[CallContext] Detected callId in URL query:', targetCallId, 'action:', action);
        // Clean up URL query parameters
        window.history.replaceState({}, '', window.location.pathname);

        // Auto join directly to CallScreen
        joinCallById(targetCallId);
      }
    }

    return () => {
      unsubPush();
    };
  }, []);

  // Listen to current active call status changes
  useEffect(() => {
    if (!activeCall?.id) return;

    const callDocRef = doc(db, 'calls', activeCall.id);
    const unsubscribe = onSnapshot(callDocRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data() as ActiveCall;
        if (
          data.status === 'ended' || 
          data.status === 'completed' || 
          data.status === 'declined' || 
          data.status === 'missed' || 
          data.status === 'busy'
        ) {
          ringtoneService.stopAll();
          cleanupCall();
        } else if (
          (data.status === 'connected' || data.status === 'ongoing') && 
          activeCallRef.current?.status !== 'connected' && 
          activeCallRef.current?.status !== 'ongoing'
        ) {
          ringtoneService.stopAll();
          setActiveCall(prev => prev ? { ...prev, status: 'ongoing', accepted_at: data.accepted_at } : null);
          startCallTimer();
        }
      } else {
        ringtoneService.stopAll();
        cleanupCall();
      }
    });

    return () => {
      unsubscribe();
      ringtoneService.stopAll();
    };
  }, [activeCall?.id]);

  const startCallTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setCallDuration(0);
    timerRef.current = setInterval(() => {
      setCallDuration(prev => prev + 1);
    }, 1000);

    if (billingIntervalRef.current) clearInterval(billingIntervalRef.current);
    billingIntervalRef.current = setInterval(async () => {
      await deductMinuteFee();
    }, 60000);
  };

  const deductMinuteFee = async () => {
    const call = activeCallRef.current;
    if (!call || !currentUser) return;

    if (call.caller_id === currentUser.uid) {
      const userRef = doc(db, 'users', call.caller_id);
      const userSnap = await getDoc(userRef);
      const currentCoins = userSnap.data()?.coins_balance ?? 0;
      const defaultRate = (call.type === 'voice' || call.call_type === 'audio') ? AUDIO_COIN_PER_MINUTE : VIDEO_COIN_PER_MINUTE;
      const rate = call.rate_per_min || defaultRate;

      if (currentCoins < rate) {
        alert('Insufficient coin balance! Call ended automatically.');
        await endCall();
        return;
      }

      await updateDoc(userRef, {
        coins_balance: increment(-rate)
      });

      const diamondsEarned = Math.max(1, Math.floor(rate / 10));
      const receiverRef = doc(db, 'users', call.receiver_id);
      await updateDoc(receiverRef, {
        diamonds_balance: increment(diamondsEarned)
      });
    }
  };

  const cleanupCall = () => {
    ringtoneService.stopAll();

    if (timerRef.current) clearInterval(timerRef.current);
    if (billingIntervalRef.current) clearInterval(billingIntervalRef.current);
    timerRef.current = null;
    billingIntervalRef.current = null;

    if (callTimeoutRef.current) {
      clearTimeout(callTimeoutRef.current);
      callTimeoutRef.current = null;
    }

    if (surpriseTimeoutRef.current) {
      clearTimeout(surpriseTimeoutRef.current);
      surpriseTimeoutRef.current = null;
    }
    if (surpriseUnsubRef.current) {
      surpriseUnsubRef.current();
      surpriseUnsubRef.current = null;
    }

    surpriseActiveRef.current = false;
    setSurpriseCallState(prev => ({ ...prev, active: false }));

    // Reset in_call = false for current user
    if (currentUser?.uid) {
      updateDoc(doc(db, 'users', currentUser.uid), { in_call: false }).catch(() => {});
    }

    if (activeCallRef.current?.id) {
      cancelBackgroundCallNotification(activeCallRef.current.id);
    }

    setActiveCall(null);
    setCallDuration(0);
  };

  // Regular 1-to-1 Call initiation
  const initiateCall = async (receiver: UserProfile, type: 'voice' | 'video'): Promise<{ success: boolean; error?: string }> => {
    if (!currentUser) {
      return { success: false, error: 'Please login first.' };
    }

    // Requirement 4: Only send push if listener's status is "available", if status is "not available" do not send push and show "Listener not available" to caller.
    try {
      const receiverSnap = await getDoc(doc(db, 'users', receiver.uid));
      const freshReceiver = receiverSnap.exists() ? (receiverSnap.data() as UserProfile) : receiver;

      if (isListenerOffline(freshReceiver)) {
        return { success: false, error: 'Listener not available' };
      }

      if (freshReceiver.in_call) {
        return { success: false, error: `${freshReceiver.name} is currently in another call. Please try again in a bit.` };
      }
    } catch (e) {
      if (isListenerOffline(receiver)) {
        return { success: false, error: 'Listener not available' };
      }
      if (receiver.in_call) {
        return { success: false, error: `${receiver.name} is currently in another call. Please try again in a bit.` };
      }
    }

    const rate = type === 'voice' 
      ? (receiver.voice_rate || receiver.audio_rate_coins || AUDIO_COIN_PER_MINUTE) 
      : (receiver.video_rate || receiver.video_rate_coins || VIDEO_COIN_PER_MINUTE);

    if (currentUser.coins_balance < rate) {
      return { 
        success: false, 
        error: `You need at least ${rate} coins to initiate this ${type} call. Your balance is ${currentUser.coins_balance} coins.` 
      };
    }

    try {
      const roomId = `room_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const newCallData: Omit<ActiveCall, 'id'> = {
        caller_id: currentUser.uid,
        caller_name: currentUser.name,
        caller_pic: getUserAvatarUrl(currentUser),
        receiver_id: receiver.uid,
        receiver_name: receiver.name,
        receiver_pic: getUserAvatarUrl(receiver),
        type,
        call_type: type === 'voice' ? 'audio' : 'video',
        status: 'ringing',
        room_id: roomId,
        rate_per_min: rate,
        created_at: serverTimestamp(),
      };

      const docRef = await addDoc(collection(db, 'calls'), newCallData);
      
      const createdCall: ActiveCall = {
        id: docRef.id,
        ...newCallData,
      };

      setActiveCall(createdCall);

      // Requirement 2: Send FCM push via Cloud Function / backend to listener's FCM token with callId, callerName, callType
      sendCallPushNotification({
        callId: docRef.id,
        callerId: currentUser.uid,
        callerName: currentUser.name,
        callType: type,
        callerPic: getUserAvatarUrl(currentUser),
        listenerUid: receiver.uid
      }).then((pushRes) => {
        console.log('[CallContext] FCM call push notification result:', pushRes);
      }).catch((pushErr) => {
        console.warn('[CallContext] FCM call push failed:', pushErr);
      });

      // Set caller in_call = true
      await updateDoc(doc(db, 'users', currentUser.uid), { in_call: true });

      // Record room in Supabase
      await saveRoomToSupabase({
        id: docRef.id,
        room_id: roomId,
        caller_id: currentUser.uid,
        caller_name: currentUser.name,
        callee_id: receiver.uid,
        callee_name: receiver.name,
        call_type: type,
        status: 'active',
        started_at: new Date().toISOString()
      });

      // Deduct initial 1 minute rate upfront
      await updateDoc(doc(db, 'users', currentUser.uid), {
        coins_balance: increment(-rate)
      });
      // Credit receiver diamonds
      const initialDiamonds = Math.max(1, Math.floor(rate / 10));
      await updateDoc(doc(db, 'users', receiver.uid), {
        diamonds_balance: increment(initialDiamonds)
      });

      // Requirement 1: Start playing outgoing ringtone in loop
      ringtoneService.startOutgoingRingtone();

      // Requirement 3: 30s timeout for call waiting
      if (callTimeoutRef.current) clearTimeout(callTimeoutRef.current);
      callTimeoutRef.current = setTimeout(async () => {
        const current = activeCallRef.current;
        if (current?.id === docRef.id && current.status === 'ringing') {
          console.log(`Call to ${receiver.name} timed out after 30s`);
          try {
            await updateDoc(doc(db, 'calls', docRef.id), {
              status: 'missed',
              ended_at: serverTimestamp()
            });
            // Refund initial coins if call timed out before connection
            await updateDoc(doc(db, 'users', currentUser.uid), {
              coins_balance: increment(rate)
            });
            await updateDoc(doc(db, 'users', receiver.uid), {
              diamonds_balance: increment(-initialDiamonds)
            });
          } catch {}
          ringtoneService.stopAll();
          cleanupCall();
        }
      }, 30000);

      return { success: true };
    } catch (err: any) {
      console.error('Call initiation failed:', err);
      ringtoneService.stopAll();
      return { success: false, error: err.message || 'Failed to connect call' };
    }
  };

  // -------------------------------------------------------------
  // SURPRISE CALL NOW LOGIC (Auto random listener, 3 retries, 30s timeout)
  // -------------------------------------------------------------
  const attemptSurpriseCall = async (
    type: 'audio' | 'video', 
    attemptNum: number, 
    excludedIds: string[]
  ) => {
    if (!currentUser || !surpriseActiveRef.current) return;

    const rate = type === 'audio' ? AUDIO_COIN_PER_MINUTE : VIDEO_COIN_PER_MINUTE;
    if (currentUser.coins_balance < rate) {
      cleanupCall();
      alert(`You need at least ${rate} coins for a Surprise ${type} call. (Audio: ${AUDIO_COIN_PER_MINUTE} coins/min, Video: ${VIDEO_COIN_PER_MINUTE} coins/min)`);
      return;
    }

    setSurpriseCallState(prev => ({
      ...prev,
      active: true,
      attempt: attemptNum,
      type,
      message: `Searching free listeners (Attempt ${attemptNum} of 3)...`
    }));

    try {
      // 1. Query listeners where role = 'listener'
      const usersRef = collection(db, 'users');
      const q = query(usersRef, where('role', '==', 'listener'));
      const snap = await getDocs(q);

      // Filter: status == 'online', in_call != true, id != current_user_id, not blocked, not in excludedIds
      const candidates: UserProfile[] = [];
      snap.forEach((d) => {
        const data = d.data() as UserProfile;
        const uid = d.id;
        if (
          uid !== currentUser.uid &&
          !excludedIds.includes(uid) &&
          !data.is_blocked &&
          !data.isBlocked &&
          data.status === 'online' &&
          !data.in_call
        ) {
          candidates.push({ ...data, uid });
        }
      });

      // If no candidates found in Firestore, fallback to DUMMY_LISTENERS
      if (candidates.length === 0) {
        const dummyCandidates = DUMMY_LISTENERS.filter(
          (d) => d.uid !== currentUser.uid && !excludedIds.includes(d.uid)
        );
        if (dummyCandidates.length > 0) {
          candidates.push(...dummyCandidates);
        }
      }

      // If still no candidates found
      if (candidates.length === 0) {
        if (attemptNum < 3 && excludedIds.length > 0) {
          // If we had excluded previously declined listeners but there are other listeners or no more free
          handleNoFreeListeners();
        } else {
          handleNoFreeListeners();
        }
        return;
      }

      // 2. Pick one random listener automatically
      const randomIndex = Math.floor(Math.random() * candidates.length);
      const chosenListener = candidates[randomIndex];
      excludedIds.push(chosenListener.uid);

      setSurpriseCallState(prev => ({
        ...prev,
        targetListenerName: chosenListener.name,
        message: `Calling ${chosenListener.name}... (Attempt ${attemptNum} of 3)`
      }));

      // 3. Mark caller in_call = true (listener stays in_call = false until accept or ringing)
      await updateDoc(doc(db, 'users', currentUser.uid), { in_call: true });

      // 4. Create call record in calls table: status = 'ringing'
      const roomId = `surprise_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const callData: Omit<ActiveCall, 'id'> = {
        caller_id: currentUser.uid,
        caller_name: currentUser.name,
        caller_pic: getUserAvatarUrl(currentUser),
        receiver_id: chosenListener.uid,
        receiver_name: chosenListener.name,
        receiver_pic: getUserAvatarUrl(chosenListener),
        type: type === 'audio' ? 'voice' : 'video',
        call_type: type,
        status: 'ringing',
        room_id: roomId,
        rate_per_min: type === 'audio' 
          ? (chosenListener.voice_rate || chosenListener.audio_rate_coins || AUDIO_COIN_PER_MINUTE) 
          : (chosenListener.video_rate || chosenListener.video_rate_coins || VIDEO_COIN_PER_MINUTE),
        is_surprise: true,
        attempt_number: attemptNum,
        created_at: serverTimestamp(),
      };

      const docRef = await addDoc(collection(db, 'calls'), callData);
      const currentCallId = docRef.id;

      setActiveCall({
        id: currentCallId,
        ...callData
      });

      // 5. Setup 30 seconds timeout for this attempt
      if (surpriseTimeoutRef.current) clearTimeout(surpriseTimeoutRef.current);
      surpriseTimeoutRef.current = setTimeout(async () => {
        if (!surpriseActiveRef.current) return;
        console.log(`Surprise call attempt ${attemptNum} timed out after 30s`);
        try {
          await updateDoc(doc(db, 'calls', currentCallId), {
            status: 'missed',
            ended_at: serverTimestamp()
          });
        } catch {}
      }, 30000);

      // 6. Listen to call status changes for this attempt
      if (surpriseUnsubRef.current) surpriseUnsubRef.current();
      surpriseUnsubRef.current = onSnapshot(doc(db, 'calls', currentCallId), async (callSnap) => {
        if (!callSnap.exists() || !surpriseActiveRef.current) return;

        const data = callSnap.data() as ActiveCall;

        // If listener accepted -> status = 'ongoing' or 'connected'
        if (data.status === 'ongoing' || data.status === 'connected') {
          if (surpriseTimeoutRef.current) clearTimeout(surpriseTimeoutRef.current);
          if (surpriseUnsubRef.current) surpriseUnsubRef.current();

          // Both users are in call
          await updateDoc(doc(db, 'users', currentUser.uid), { in_call: true, call_started_at: serverTimestamp() });
          await updateDoc(doc(db, 'users', chosenListener.uid), { in_call: true, call_started_at: serverTimestamp() });

          // Deduct initial 1 minute rate
          const callRate = callData.rate_per_min;
          await updateDoc(doc(db, 'users', currentUser.uid), {
            coins_balance: increment(-callRate)
          });
          await updateDoc(doc(db, 'users', chosenListener.uid), {
            diamonds_balance: increment(Math.max(1, Math.floor(callRate / 10)))
          });

          setActiveCall({
            id: currentCallId,
            ...data,
            status: 'ongoing',
          });
          startCallTimer();
          setSurpriseCallState(prev => ({ ...prev, active: false }));
          return;
        }

        // If listener declined or missed (timeout)
        if (data.status === 'declined' || data.status === 'missed') {
          if (surpriseTimeoutRef.current) clearTimeout(surpriseTimeoutRef.current);
          if (surpriseUnsubRef.current) surpriseUnsubRef.current();

          // Reset listener in_call = false
          await updateDoc(doc(db, 'users', chosenListener.uid), { in_call: false }).catch(() => {});

          // Try next attempt if attemptNum < 3
          if (attemptNum < 3 && surpriseActiveRef.current) {
            attemptSurpriseCall(type, attemptNum + 1, excludedIds);
          } else {
            handleNoFreeListeners();
          }
        }
      });

    } catch (err: any) {
      console.error('Surprise call attempt error:', err);
      handleNoFreeListeners();
    }
  };

  const handleNoFreeListeners = () => {
    cleanupCall();
    setSurpriseCallState({
      active: false,
      attempt: 0,
      type: 'video',
      showNoListenersPopup: true,
      message: 'No free listeners right now, try again in a bit'
    });
  };

  const startSurpriseCall = async (type: 'audio' | 'video') => {
    if (!currentUser) {
      alert('Please login to use Surprise Call');
      return;
    }

    surpriseActiveRef.current = true;
    triedListenerIdsRef.current = [];
    await attemptSurpriseCall(type, 1, triedListenerIdsRef.current);
  };

  const cancelSurpriseCall = async () => {
    surpriseActiveRef.current = false;
    const current = activeCallRef.current;
    if (current?.id) {
      try {
        await updateDoc(doc(db, 'calls', current.id), {
          status: 'missed',
          ended_at: serverTimestamp()
        });
      } catch {}
    }
    cleanupCall();
  };

  const closeNoListenersPopup = () => {
    setSurpriseCallState(prev => ({ ...prev, showNoListenersPopup: false }));
  };

  // Accept incoming call
  const acceptCall = async () => {
    ringtoneService.stopAll();
    if (!incomingCall?.id || !currentUser) return;
    cancelBackgroundCallNotification(incomingCall.id);
    try {
      const callDocRef = doc(db, 'calls', incomingCall.id);
      await updateDoc(callDocRef, {
        status: 'ongoing',
        accepted_at: serverTimestamp()
      });

      // Set both in_call = true
      await updateDoc(doc(db, 'users', currentUser.uid), { in_call: true, call_started_at: serverTimestamp() });
      await updateDoc(doc(db, 'users', incomingCall.caller_id), { in_call: true, call_started_at: serverTimestamp() });

      setActiveCall({
        ...incomingCall,
        status: 'ongoing',
      });
      setIncomingCall(null);
      startCallTimer();
    } catch (err) {
      console.error('Error accepting call:', err);
    }
  };

  // Requirement 4: On notification click, navigate directly to CallScreen with callId and auto-join
  const joinCallById = async (callId: string) => {
    if (!callId) return;
    ringtoneService.stopAll();
    cancelBackgroundCallNotification(callId);

    try {
      console.log('[CallContext] Auto-joining call by ID from notification click:', callId);
      const callDocRef = doc(db, 'calls', callId);
      const callSnap = await getDoc(callDocRef);

      if (!callSnap.exists()) {
        console.warn('[CallContext] Call document does not exist:', callId);
        return;
      }

      const callData = { id: callSnap.id, ...callSnap.data() } as ActiveCall;

      // If call is already ended/declined/missed, do not join
      if (
        callData.status === 'ended' ||
        callData.status === 'completed' ||
        callData.status === 'declined' ||
        callData.status === 'missed' ||
        callData.status === 'busy'
      ) {
        console.log('[CallContext] Call has already ended:', callData.status);
        return;
      }

      // If call is still ringing, mark it accepted and ongoing
      if (callData.status === 'ringing') {
        await updateDoc(callDocRef, {
          status: 'ongoing',
          accepted_at: serverTimestamp(),
        });

        if (currentUser) {
          await updateDoc(doc(db, 'users', currentUser.uid), {
            in_call: true,
            call_started_at: serverTimestamp()
          }).catch(console.warn);
        }
        if (callData.caller_id) {
          await updateDoc(doc(db, 'users', callData.caller_id), {
            in_call: true,
            call_started_at: serverTimestamp()
          }).catch(console.warn);
        }
      }

      // Set active call with ongoing status so isInCall becomes true and CallScreen mounts immediately
      setActiveCall({
        ...callData,
        status: 'ongoing',
      });
      setIncomingCall(null);
      startCallTimer();
      console.log('[CallContext] Successfully auto-joined call screen for callId:', callId);
    } catch (err) {
      console.error('[CallContext] Error auto-joining call by ID:', err);
    }
  };

  // Decline incoming call
  const declineCall = async () => {
    ringtoneService.stopAll();
    if (!incomingCall?.id || !currentUser) return;
    cancelBackgroundCallNotification(incomingCall.id);
    try {
      const callDocRef = doc(db, 'calls', incomingCall.id);
      await updateDoc(callDocRef, {
        status: 'declined',
        ended_at: serverTimestamp()
      });

      // Set listener in_call = false
      await updateDoc(doc(db, 'users', currentUser.uid), { in_call: false }).catch(() => {});
      setIncomingCall(null);
    } catch (err) {
      console.error('Error declining call:', err);
    }
  };

  // End active call
  const endCall = async () => {
    ringtoneService.stopAll();
    const current = activeCallRef.current;
    if (!current?.id) {
      cleanupCall();
      return;
    }

    try {
      const callDocRef = doc(db, 'calls', current.id);
      
      if (current.status === 'ringing') {
        await updateDoc(callDocRef, {
          status: 'declined',
          ended_at: serverTimestamp()
        });
        // Refund caller if cancelled before answer
        const defaultRate = (current.type === 'voice' || current.call_type === 'audio') ? AUDIO_COIN_PER_MINUTE : VIDEO_COIN_PER_MINUTE;
        const rate = current.rate_per_min || defaultRate;
        await updateDoc(doc(db, 'users', current.caller_id), {
          coins_balance: increment(rate)
        }).catch(() => {});
        await updateDoc(doc(db, 'users', current.receiver_id), {
          diamonds_balance: increment(-Math.max(1, Math.floor(rate / 10)))
        }).catch(() => {});
      } else {
        await updateDoc(callDocRef, {
          status: 'completed',
          ended_at: serverTimestamp()
        });
      }

      // Set both in_call = false
      if (current.caller_id) {
        await updateDoc(doc(db, 'users', current.caller_id), { in_call: false, call_started_at: null }).catch(() => {});
      }
      if (current.receiver_id) {
        await updateDoc(doc(db, 'users', current.receiver_id), { in_call: false, call_started_at: null }).catch(() => {});
      }

      // Write call log to Firestore (for Recents)
      const defaultRate = (current.type === 'voice' || current.call_type === 'audio') ? AUDIO_COIN_PER_MINUTE : VIDEO_COIN_PER_MINUTE;
      const totalMinutes = Math.max(1, Math.ceil(callDuration / 60));
      const totalSpent = totalMinutes * (current.rate_per_min || defaultRate);

      const logData: CallLog = {
        caller_id: current.caller_id,
        caller_name: current.caller_name,
        caller_pic: current.caller_pic,
        receiver_id: current.receiver_id,
        receiver_name: current.receiver_name,
        receiver_pic: current.receiver_pic,
        type: current.type,
        duration_sec: callDuration,
        coins_spent: totalSpent,
        started_at: serverTimestamp(),
      };

      await addDoc(collection(db, 'call_logs'), logData);

      // Sync room end to Supabase
      await updateRoomInSupabase(current.room_id, {
        status: 'ended',
        ended_at: new Date().toISOString(),
        duration: callDuration
      });
    } catch (e) {
      console.error('Error saving call log:', e);
    } finally {
      cleanupCall();
    }
  };

  // OWNER: Join any room immediately without permission
  const joinRoomAsOwner = async (room: ActiveCall) => {
    setActiveCall({
      ...room,
      status: 'ongoing',
    });
    startCallTimer();
  };

  // OWNER: Remote end any room
  const ownerEndCall = async (callId: string) => {
    try {
      const callDocRef = doc(db, 'calls', callId);
      await updateDoc(callDocRef, {
        status: 'ended',
        ended_at: serverTimestamp(),
      });
      await updateRoomInSupabase(callId, {
        status: 'ended',
        ended_at: new Date().toISOString()
      });
      if (activeCall?.id === callId) {
        cleanupCall();
      }
    } catch (err) {
      console.error('Error in ownerEndCall:', err);
    }
  };

  // OWNER: Remote mute room
  const ownerMuteCall = async (callId: string, isMuted: boolean) => {
    try {
      const callDocRef = doc(db, 'calls', callId);
      await updateDoc(callDocRef, {
        is_muted: isMuted,
      });
      await updateRoomInSupabase(callId, {
        is_muted: isMuted,
        status: isMuted ? 'muted' : 'active'
      });
    } catch (err) {
      console.error('Error in ownerMuteCall:', err);
    }
  };

  return (
    <CallContext.Provider
      value={{
        activeCall,
        incomingCall,
        callDuration,
        isInCall: !!activeCall && (activeCall.status === 'connected' || activeCall.status === 'ongoing'),
        surpriseCallState,
        initiateCall,
        startSurpriseCall,
        cancelSurpriseCall,
        closeNoListenersPopup,
        acceptCall,
        joinCallById,
        declineCall,
        endCall,
        joinRoomAsOwner,
        ownerEndCall,
        ownerMuteCall,
      }}
    >
      {children}
    </CallContext.Provider>
  );
};

export const useCall = () => {
  const context = useContext(CallContext);
  if (!context) {
    throw new Error('useCall must be used within a CallProvider');
  }
  return context;
};
