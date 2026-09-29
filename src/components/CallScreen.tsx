import React, { useEffect, useRef, useState, useCallback } from 'react';
import { 
  PhoneOff, 
  Mic, 
  MicOff, 
  Video, 
  VideoOff, 
  Coins, 
  Sparkles, 
  Monitor, 
  MonitorOff, 
  Volume2, 
  Crown, 
  MessageSquare, 
  Send, 
  X, 
  VolumeX, 
  Radio,
  Terminal,
  Wifi,
  Activity,
  AlertTriangle,
  Heart
} from 'lucide-react';
import { useCall } from '../context/CallContext';
import { useAuth } from '../context/AuthContext';
import { AUDIO_COIN_PER_MINUTE, VIDEO_COIN_PER_MINUTE } from '../types';
import { ringtoneService } from '../services/ringtoneService';
import { WebRTCSession, WebRTCLogEntry, CandidateCounts } from '../services/webrtcService';
import { DebugConsole } from './DebugConsole';
import { 
  collection, 
  addDoc, 
  onSnapshot, 
  query, 
  orderBy, 
  serverTimestamp 
} from 'firebase/firestore';
import { db } from '../firebase/config';

export interface CallChatMessage {
  id?: string;
  senderId: string;
  sender_id?: string;
  senderName?: string;
  sender_name?: string;
  senderRole?: string;
  sender_role?: string;
  text: string;
  message?: string;
  timestamp?: any;
  created_at?: string;
}

export interface FloatingHeartItem {
  id: string;
  leftOffset: number;
  size: number;
  color: string;
  duration: number;
  swayX1: number;
  swayX2: number;
  swayX3: number;
  swayX4: number;
  swayX5: number;
  rot1: number;
  rot2: number;
  rot3: number;
  rot4: number;
  rot5: number;
  emoji?: string;
}

export const CallScreen: React.FC = () => {
  const { activeCall, callDuration, endCall, ownerEndCall, ownerMuteCall } = useCall();
  const { currentUser } = useAuth();

  // Audio / Video Controls State
  const [isMuted, setIsMuted] = useState(false);
  const isMutedRef = useRef(isMuted);
  useEffect(() => {
    isMutedRef.current = isMuted;
  }, [isMuted]);

  const [isVideoOff, setIsVideoOff] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [statusNotice, setStatusNotice] = useState<string | null>(null);

  // WebRTC Live Connection & Diagnostics State
  const [logs, setLogs] = useState<WebRTCLogEntry[]>([]);
  const [signalingState, setSignalingState] = useState<string>('stable');
  const [iceState, setIceState] = useState<string>('new');
  const [connectionState, setConnectionState] = useState<string>('new');
  const [iceGatheringState, setIceGatheringState] = useState<string>('new');
  const [candidateCounts, setCandidateCounts] = useState<CandidateCounts>({ host: 0, srflx: 0, relay: 0, total: 0 });
  const [showDebugConsole, setShowDebugConsole] = useState(true);
  // Requirement 1: Set debug console default state to collapsed to badge on call start
  const [isDebugCollapsed, setIsDebugCollapsed] = useState(true);
  const [hasRemoteVideo, setHasRemoteVideo] = useState(false);

  // Requirement 2: Auto-collapse console when ICE state becomes "connected"
  useEffect(() => {
    if (iceState === 'connected' || iceState === 'completed') {
      setIsDebugCollapsed(true);
    }
  }, [iceState]);

  // Requirement 2 & 3: Immediately stop ringing tone when CallScreen mounts and clean up on unmount
  useEffect(() => {
    ringtoneService.pause();
    ringtoneService.currentTime = 0;
    ringtoneService.stopAll();

    return () => {
      ringtoneService.stopAll();
    };
  }, []);

  // Requirement 4: Ensure ringtone only plays for caller side in 'ringing' state, not in 'connected' or 'ongoing' state
  useEffect(() => {
    const callStatus = activeCall?.status;
    if (callStatus !== 'ringing') {
      ringtoneService.pause();
      ringtoneService.currentTime = 0;
      ringtoneService.stopAll();
    }
  }, [activeCall?.status]);

  // DOM References
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const screenVideoRef = useRef<HTMLVideoElement | null>(null);

  // Media & Session References
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const webrtcSessionRef = useRef<WebRTCSession | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number | null>(null);

  // In-Meeting Realtime Chat (Firestore calls/{callId}/messages)
  const [showChat, setShowChat] = useState(false);
  const [chatMessages, setChatMessages] = useState<CallChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const chatBottomRef = useRef<HTMLDivElement | null>(null);

  const isOwner = currentUser?.role === 'owner' || currentUser?.role === 'admin' || localStorage.getItem('meetup_owner_authenticated') === 'true';
  const isCaller = activeCall?.caller_id === currentUser?.uid;
  const partnerName = isCaller ? activeCall?.receiver_name : activeCall?.caller_name;
  const partnerPic = isCaller ? activeCall?.receiver_pic : activeCall?.caller_pic;
  const isVideoCall = activeCall?.type === 'video' || activeCall?.call_type === 'video';

  // Format seconds into MM:SS
  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const remainder = secs % 60;
    return `${mins.toString().padStart(2, '0')}:${remainder.toString().padStart(2, '0')}`;
  };

  // Remaining minutes estimation based on caller's coins
  const remainingMinutes = currentUser
    ? Math.max(0, Math.floor((currentUser.coins_balance || 0) / (activeCall?.rate_per_min || (isVideoCall ? VIDEO_COIN_PER_MINUTE : AUDIO_COIN_PER_MINUTE))))
    : 0;

  // Flash temporary HUD status alert
  const showNotice = useCallback((msg: string) => {
    setStatusNotice(msg);
    const timer = setTimeout(() => {
      setStatusNotice((current) => (current === msg ? null : current));
    }, 2500);
    return () => clearTimeout(timer);
  }, []);

  // Floating Heart Animation State & Helpers
  const [floatingHearts, setFloatingHearts] = useState<FloatingHeartItem[]>([]);
  const [isHeartPopping, setIsHeartPopping] = useState(false);
  const [heartCount, setHeartCount] = useState(0);
  const heartCounterTimerRef = useRef<NodeJS.Timeout | null>(null);

  const HEART_COLORS = [
    '#FF69B4', // Hot pink
    '#FF1493', // Deep pink
    '#FF4081', // Pink A200
    '#F43F5E', // Rose 500
    '#FB7185', // Rose 400
    '#E11D48', // Rose 600
    '#FDA4AF', // Rose 300
    '#FF6584', // Vibrant coral pink
    '#A855F7', // Radiant violet
  ];

  const HEART_EMOJIS = ['💖', '❤️', '💕', '💗', '💓', '✨', '💝'];

  const spawnHearts = useCallback((count = 1) => {
    const newItems: FloatingHeartItem[] = [];

    for (let i = 0; i < count; i++) {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
      const color = HEART_COLORS[Math.floor(Math.random() * HEART_COLORS.length)];
      const size = Math.floor(Math.random() * 18) + 26; // 26px to 44px
      const duration = 1.9 + Math.random() * 0.7; // 1.9s to 2.6s
      const leftOffset = (Math.random() - 0.5) * 55; // -27px to +27px around anchor

      const swayDirection = Math.random() > 0.5 ? 1 : -1;
      const swayMag = 14 + Math.random() * 22;
      const swayX1 = swayDirection * (swayMag * 0.4);
      const swayX2 = -swayDirection * (swayMag * 0.8);
      const swayX3 = swayDirection * (swayMag * 1.1);
      const swayX4 = -swayDirection * (swayMag * 0.6);
      const swayX5 = swayDirection * (swayMag * 0.3);

      const rot1 = (Math.random() - 0.5) * 28;
      const rot2 = (Math.random() - 0.5) * 36;
      const rot3 = (Math.random() - 0.5) * 30;
      const rot4 = (Math.random() - 0.5) * 26;
      const rot5 = (Math.random() - 0.5) * 18;

      const useEmoji = Math.random() < 0.3 ? HEART_EMOJIS[Math.floor(Math.random() * HEART_EMOJIS.length)] : undefined;

      newItems.push({
        id,
        leftOffset,
        size,
        color,
        duration,
        swayX1,
        swayX2,
        swayX3,
        swayX4,
        swayX5,
        rot1,
        rot2,
        rot3,
        rot4,
        rot5,
        emoji: useEmoji,
      });

      // Cleanup heart after animation duration
      setTimeout(() => {
        setFloatingHearts((prev) => prev.filter((h) => h.id !== id));
      }, duration * 1000 + 100);
    }

    setFloatingHearts((prev) => [...prev.slice(-35), ...newItems]);
  }, []);

  const handleSendHeart = useCallback(() => {
    // 1. Pop button animation
    setIsHeartPopping(true);
    setTimeout(() => setIsHeartPopping(false), 350);

    // 2. Increment combo counter
    setHeartCount((c) => c + 1);
    if (heartCounterTimerRef.current) {
      clearTimeout(heartCounterTimerRef.current);
    }
    heartCounterTimerRef.current = setTimeout(() => {
      setHeartCount(0);
    }, 1500);

    // 3. Immediately spawn local floating hearts
    const burst = Math.floor(Math.random() * 2) + 1;
    spawnHearts(burst);

    // 4. Synchronize reaction to Firestore calls/{callId}/reactions
    if (activeCall?.id && currentUser?.uid) {
      addDoc(collection(db, 'calls', activeCall.id, 'reactions'), {
        type: 'heart',
        senderId: currentUser.uid,
        timestamp: serverTimestamp(),
      }).catch(() => {});
    }
  }, [activeCall?.id, currentUser?.uid, spawnHearts]);

  // Stable references across component re-renders
  const initializedCallIdRef = useRef<string | null>(null);
  const endCallRef = useRef(endCall);
  endCallRef.current = endCall;
  const ownerEndCallRef = useRef(ownerEndCall);
  ownerEndCallRef.current = ownerEndCall;
  const showNoticeRef = useRef(showNotice);
  showNoticeRef.current = showNotice;
  const isCallerRef = useRef(isCaller);
  isCallerRef.current = isCaller;
  const isVideoCallRef = useRef(isVideoCall);
  isVideoCallRef.current = isVideoCall;

  // Voice Activity Detection (AnalyserNode) to detect speaking in real-time
  const setupAudioMonitoring = useCallback((stream: MediaStream) => {
    try {
      const audioTrack = stream.getAudioTracks()[0];
      if (!audioTrack) return;

      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;

      const audioCtx = new AudioCtx();
      if (audioCtx.state === 'suspended') {
        audioCtx.resume().catch(() => {});
      }
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.5;

      const source = audioCtx.createMediaStreamSource(stream);
      source.connect(analyser);

      audioContextRef.current = audioCtx;
      analyserRef.current = analyser;

      const dataArray = new Uint8Array(analyser.frequencyBinCount);

      const checkVolume = () => {
        if (!analyserRef.current || isMutedRef.current) {
          setIsSpeaking(false);
          animFrameRef.current = requestAnimationFrame(checkVolume);
          return;
        }

        analyserRef.current.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i];
        }
        const average = sum / dataArray.length;

        // If average volume is above threshold, indicate speaking
        setIsSpeaking(average > 12);
        animFrameRef.current = requestAnimationFrame(checkVolume);
      };

      checkVolume();
    } catch (err) {
      console.warn('Audio monitoring setup warning:', err);
    }
  }, []);

  // Track event listeners to reflect external changes
  const bindTrackListeners = useCallback((stream: MediaStream) => {
    const audioTrack = stream.getAudioTracks()[0];
    if (audioTrack) {
      // Keep track active; do not set isMuted on hardware startup transient mute events
      audioTrack.onended = () => {
        console.warn('[WebRTC Local Audio Track Ended]');
      };
    }

    const videoTrack = stream.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.onended = () => {
        console.warn('[WebRTC Local Video Track Ended]');
      };
    }
  }, []);

  // -------------------------------------------------------------
  // WebRTC INITIALIZATION & SIGNALING
  // -------------------------------------------------------------
  useEffect(() => {
    const callId = activeCall?.id;
    if (!callId) return;

    // Prevent re-initialization and auto-cleanup on re-renders for the same call
    if (initializedCallIdRef.current === callId) {
      return;
    }
    initializedCallIdRef.current = callId;

    let isSubscribed = true;

    const initWebRTC = async () => {
      try {
        const callerMode = isCallerRef.current;
        const videoMode = isVideoCallRef.current;

        // Requirement 3: Ensure getUserMedia audio:true is requested and mic is not muted by default
        let stream: MediaStream;
        const audioConstraints = {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        };

        try {
          stream = await navigator.mediaDevices.getUserMedia({
            audio: audioConstraints,
            video: videoMode ? {
              width: { ideal: 1280 },
              height: { ideal: 720 },
              facingMode: 'user',
            } : false,
          });
        } catch (mediaErr: any) {
          console.warn('[getUserMedia advanced audio failed, falling back to audio: true]:', mediaErr);
          stream = await navigator.mediaDevices.getUserMedia({
            audio: true,
            video: videoMode ? true : false,
          });
        }

        if (!isSubscribed) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        // Requirement 3: Ensure all local audio tracks are active and enabled by default
        const audioTracks = stream.getAudioTracks();
        if (audioTracks.length > 0) {
          audioTracks.forEach((t) => {
            t.enabled = true;
            console.log('[WebRTC Local Audio Track Initialized - Mic Active]', {
              id: t.id,
              enabled: t.enabled,
              muted: t.muted,
              readyState: t.readyState,
            });
          });
        } else {
          console.warn('[WebRTC Warning]: No audio track returned by getUserMedia!');
        }
        setIsMuted(false);

        localStreamRef.current = stream;

        // Attach local preview
        if (localVideoRef.current && videoMode) {
          localVideoRef.current.srcObject = stream;
        }

        bindTrackListeners(stream);
        setupAudioMonitoring(stream);

        // 2. Instantiate WebRTCSession with 4 STUN + optional TURN fallback + 15s failure grace
        const session = new WebRTCSession({
          callId,
          isCaller: callerMode,
          isVideo: videoMode,
          localStream: stream,
          onCandidateCountsChange: (counts) => {
            setCandidateCounts(counts);
          },
          onRemoteStream: (remoteStream) => {
            console.log('[WebRTC Remote Stream Attached]', remoteStream);
            remoteStreamRef.current = remoteStream;

            // Requirement 2: Immediately stop ringing tone on remote track arrival
            ringtoneService.pause();
            ringtoneService.currentTime = 0;
            ringtoneService.stopAll();

            // Requirement 5: For audio-only call, ensure local audio stream is not looping back
            const localTrackIds = new Set(localStreamRef.current?.getTracks().map((t) => t.id) || []);
            const pureRemoteAudioTracks = remoteStream.getAudioTracks().filter((t) => !localTrackIds.has(t.id));

            // Requirement 4: Confirm and log "REMOTE-AUDIO-TRACK received"
            if (pureRemoteAudioTracks.length > 0) {
              const audioTrack = pureRemoteAudioTracks[0];
              console.log('[WebRTC REMOTE-AUDIO-TRACK received]', {
                id: audioTrack.id,
                enabled: audioTrack.enabled,
                readyState: audioTrack.readyState,
              });
              setLogs((prev) => [
                ...prev,
                {
                  id: `remote_audio_${Date.now()}`,
                  timestamp: new Date().toLocaleTimeString(),
                  type: 'success',
                  tag: 'REMOTE-AUDIO-TRACK',
                  message: `REMOTE-AUDIO-TRACK received: id=${audioTrack.id}, enabled=${audioTrack.enabled}`,
                },
              ]);
            }

            // Attach to remote video if video call (muted to prevent duplicate audio conflict)
            if (remoteVideoRef.current && isVideoCallRef.current) {
              remoteVideoRef.current.srcObject = remoteStream;
              remoteVideoRef.current.muted = true;
              remoteVideoRef.current.play().catch((e) => console.log('Remote video auto-play:', e));
            }

            // Requirement 2 & 5: Attach purely remote audio stream to audio element and call play()
            if (remoteAudioRef.current) {
              const audioEl = remoteAudioRef.current;
              if (pureRemoteAudioTracks.length > 0) {
                audioEl.srcObject = new MediaStream(pureRemoteAudioTracks);
              } else {
                audioEl.srcObject = remoteStream;
              }
              audioEl.muted = false;
              audioEl.volume = 1.0;

              const playPromise = audioEl.play();
              if (playPromise !== undefined) {
                playPromise
                  .then(() => {
                    console.log('[WebRTC Remote Audio Playing Successfully]');
                  })
                  .catch((err) => {
                    console.warn('[WebRTC Remote Audio Autoplay Blocked - waiting for user gesture fallback]:', err);
                    
                    const handleGesture = () => {
                      if (audioEl) {
                        audioEl.play()
                          .then(() => console.log('[WebRTC Remote Audio Resumed via user gesture]'))
                          .catch((e) => console.warn('[WebRTC Remote Audio Fallback Error]:', e));
                      }
                      window.removeEventListener('click', handleGesture);
                      window.removeEventListener('touchstart', handleGesture);
                      window.removeEventListener('keydown', handleGesture);
                    };

                    window.addEventListener('click', handleGesture, { once: true });
                    window.addEventListener('touchstart', handleGesture, { once: true });
                    window.addEventListener('keydown', handleGesture, { once: true });
                  });
              }
            }

            const hasVideoTracks = remoteStream.getVideoTracks().length > 0;
            setHasRemoteVideo(hasVideoTracks);
          },
          onCallEnded: (reason) => {
            // Requirement 3: Stop ringtone on call ended
            ringtoneService.stopAll();
            console.warn('[WebRTC Call Ended Callback]', reason);
            showNoticeRef.current(reason);
            // End call via CallContext
            endCallRef.current();
          },
          onLog: (entry) => {
            // Keep at most 200 logs for memory performance
            setLogs((prev) => {
              const updated = [...prev, entry];
              return updated.length > 200 ? updated.slice(updated.length - 200) : updated;
            });

            // Sync matrix states
            if (session.pc) {
              setSignalingState(session.pc.signalingState);
              setIceState(session.pc.iceConnectionState);
              setConnectionState(session.pc.connectionState);
              setIceGatheringState(session.pc.iceGatheringState);
            }
          },
        });

        webrtcSessionRef.current = session;
        await session.start();
      } catch (err: any) {
        console.error('Failed to initialize WebRTC call:', err);
        const errMsg = err?.message || 'Camera/Microphone permission denied';
        showNoticeRef.current(errMsg);
        setLogs((prev) => [
          ...prev,
          {
            id: `err_${Date.now()}`,
            timestamp: new Date().toLocaleTimeString(),
            type: 'error',
            tag: 'INIT-ERROR',
            message: errMsg,
          },
        ]);
      }
    };

    initWebRTC();

    return () => {
      // ONLY cleanup on actual component unmount of call screen or call change
      ringtoneService.stopAll();
      isSubscribed = false;
      initializedCallIdRef.current = null;
      if (webrtcSessionRef.current) {
        webrtcSessionRef.current.destroy();
        webrtcSessionRef.current = null;
      }
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => track.stop());
        localStreamRef.current = null;
      }
      if (screenStreamRef.current) {
        screenStreamRef.current.getTracks().forEach((track) => track.stop());
        screenStreamRef.current = null;
      }
      if (audioContextRef.current) {
        audioContextRef.current.close().catch(() => {});
        audioContextRef.current = null;
      }
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
        animFrameRef.current = null;
      }
    };
  }, [activeCall?.id]);

  // Explicit End Call Handler (Requirement 2: Only call cleanup on explicit End button press or component unmount)
  const handleExplicitEndCall = useCallback(async () => {
    ringtoneService.stopAll();
    if (webrtcSessionRef.current) {
      webrtcSessionRef.current.destroy();
      webrtcSessionRef.current = null;
    }
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
    }
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach((track) => track.stop());
      screenStreamRef.current = null;
    }
    if (isOwner && activeCall?.id) {
      await ownerEndCallRef.current(activeCall.id);
    } else {
      await endCallRef.current();
    }
  }, [isOwner, activeCall?.id]);

  // Real-time Mute / Unmute handler
  const handleToggleMic = useCallback(() => {
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);

    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach((track) => {
        track.enabled = !nextMuted;
      });
    }

    if (webrtcSessionRef.current) {
      webrtcSessionRef.current.log(
        'info',
        'MEDIA',
        nextMuted ? 'Local microphone muted' : 'Local microphone unmuted'
      );
    }

    showNotice(nextMuted ? 'Microphone Muted' : 'Microphone Active');
  }, [isMuted, showNotice]);

  // Real-time Camera Toggle handler
  const handleToggleCamera = useCallback(async () => {
    const nextVideoOff = !isVideoOff;
    setIsVideoOff(nextVideoOff);

    if (localStreamRef.current) {
      const videoTracks = localStreamRef.current.getVideoTracks();
      if (videoTracks.length > 0) {
        videoTracks.forEach((track) => {
          track.enabled = !nextVideoOff;
        });
      } else if (!nextVideoOff) {
        try {
          const camStream = await navigator.mediaDevices.getUserMedia({ video: true });
          const camTrack = camStream.getVideoTracks()[0];
          localStreamRef.current.addTrack(camTrack);
          if (localVideoRef.current) {
            localVideoRef.current.srcObject = localStreamRef.current;
          }
          if (webrtcSessionRef.current?.pc) {
            webrtcSessionRef.current.pc.addTrack(camTrack, localStreamRef.current);
          }
        } catch (err) {
          console.warn('Could not activate camera track:', err);
        }
      }
    }

    if (webrtcSessionRef.current) {
      webrtcSessionRef.current.log(
        'info',
        'MEDIA',
        nextVideoOff ? 'Camera turned off' : 'Camera turned on'
      );
    }

    showNotice(nextVideoOff ? 'Camera Turned Off' : 'Camera Active');
  }, [isVideoOff, showNotice]);

  // Toggle Screen Sharing
  const handleToggleScreenShare = async () => {
    if (isScreenSharing) {
      if (screenStreamRef.current) {
        screenStreamRef.current.getTracks().forEach((t) => t.stop());
        screenStreamRef.current = null;
      }
      setIsScreenSharing(false);
      showNotice('Screen Sharing Stopped');
    } else {
      try {
        if (!navigator.mediaDevices?.getDisplayMedia) {
          showNotice('Screen sharing is not supported on this device');
          return;
        }
        const stream = await navigator.mediaDevices.getDisplayMedia({
          video: true,
          audio: true,
        });
        screenStreamRef.current = stream;
        if (screenVideoRef.current) {
          screenVideoRef.current.srcObject = stream;
        }
        setIsScreenSharing(true);
        showNotice('Screen Sharing Active');

        stream.getVideoTracks()[0].onended = () => {
          setIsScreenSharing(false);
          screenStreamRef.current = null;
          showNotice('Screen Sharing Stopped');
        };
      } catch (err: any) {
        console.warn('Screen share cancelled or failed:', err);
      }
    }
  };

  // Requirement 1, 2, 4: Subscribe to in-call chat messages in Firestore under calls/{callId}/messages
  useEffect(() => {
    const callId = activeCall?.id;
    if (!callId) return;

    const messagesCol = collection(db, 'calls', callId, 'messages');
    const messagesQuery = query(messagesCol, orderBy('timestamp', 'asc'));

    const unsubscribe = onSnapshot(
      messagesQuery,
      (snapshot) => {
        const remoteMsgs: CallChatMessage[] = [];
        snapshot.forEach((docSnap) => {
          const d = docSnap.data();
          remoteMsgs.push({
            id: docSnap.id,
            senderId: d.senderId || d.sender_id || '',
            sender_id: d.sender_id || d.senderId || '',
            senderName: d.senderName || d.sender_name || 'Anonymous',
            sender_name: d.sender_name || d.senderName || 'Anonymous',
            senderRole: d.senderRole || d.sender_role || 'user',
            sender_role: d.sender_role || d.senderRole || 'user',
            text: d.text || d.message || '',
            message: d.message || d.text || '',
            timestamp: d.timestamp,
            created_at: d.created_at || (d.timestamp?.toDate ? d.timestamp.toDate().toISOString() : new Date().toISOString()),
          });
        });

        // Requirement 3: Merge local + remote from Firestore
        setChatMessages((prevLocal) => {
          const pendingLocal = prevLocal.filter(
            (local) => local.id?.startsWith('local_') && !remoteMsgs.some((r) => (r.senderId === local.senderId || r.sender_id === local.senderId) && (r.text === local.text || r.message === local.text))
          );
          return [...remoteMsgs, ...pendingLocal];
        });

        setTimeout(() => chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
      },
      (err) => {
        console.warn('[Firestore Chat Listener query failed, using unordered fallback]:', err);
        const fallbackUnsub = onSnapshot(messagesCol, (fallbackSnap) => {
          const fallbackMsgs: CallChatMessage[] = [];
          fallbackSnap.forEach((docSnap) => {
            const d = docSnap.data();
            fallbackMsgs.push({
              id: docSnap.id,
              senderId: d.senderId || d.sender_id || '',
              sender_id: d.sender_id || d.senderId || '',
              senderName: d.senderName || d.sender_name || 'Anonymous',
              sender_name: d.sender_name || d.senderName || 'Anonymous',
              senderRole: d.senderRole || d.sender_role || 'user',
              sender_role: d.sender_role || d.senderRole || 'user',
              text: d.text || d.message || '',
              message: d.message || d.text || '',
              timestamp: d.timestamp,
              created_at: d.created_at || (d.timestamp?.toDate ? d.timestamp.toDate().toISOString() : new Date().toISOString()),
            });
          });
          fallbackMsgs.sort((a, b) => {
            const timeA = a.created_at ? new Date(a.created_at).getTime() : 0;
            const timeB = b.created_at ? new Date(b.created_at).getTime() : 0;
            return timeA - timeB;
          });

          setChatMessages((prevLocal) => {
            const pendingLocal = prevLocal.filter(
              (local) => local.id?.startsWith('local_') && !fallbackMsgs.some((r) => (r.senderId === local.senderId || r.sender_id === local.senderId) && (r.text === local.text || r.message === local.text))
            );
            return [...fallbackMsgs, ...pendingLocal];
          });
          setTimeout(() => chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
        });
        return () => fallbackUnsub();
      }
    );

    return () => unsubscribe();
  }, [activeCall?.id]);

  // Listen for real-time remote peer heart reactions on calls/{callId}/reactions
  useEffect(() => {
    if (!activeCall?.id) return;
    const reactionsRef = collection(db, 'calls', activeCall.id, 'reactions');
    const q = query(reactionsRef, orderBy('timestamp', 'asc'));
    const mountTime = Date.now();

    const unsub = onSnapshot(
      q,
      (snapshot) => {
        snapshot.docChanges().forEach((change) => {
          if (change.type === 'added') {
            const data = change.doc.data();
            // Spawn if triggered by remote peer
            if (data.senderId && data.senderId !== currentUser?.uid) {
              const reactionTime = data.timestamp?.toMillis ? data.timestamp.toMillis() : Date.now();
              if (reactionTime >= mountTime - 3000) {
                spawnHearts(Math.floor(Math.random() * 2) + 1);
              }
            }
          }
        });
      },
      (err) => {
        console.warn('[CallScreen] Reactions listener note:', err);
      }
    );

    return () => unsub();
  }, [activeCall?.id, currentUser?.uid, spawnHearts]);

  // Requirement 1 & 3 & 4: Store chat messages in Firestore under calls/{callId}/messages with timestamp, senderId, text
  const handleSendChat = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = chatInput.trim();
    const callId = activeCall?.id;
    if (!text || !callId || !currentUser) return;

    const localId = `local_${Date.now()}`;
    const newMsg: CallChatMessage = {
      id: localId,
      senderId: currentUser.uid,
      sender_id: currentUser.uid,
      senderName: isOwner ? `👑 Owner (${currentUser.name})` : currentUser.name,
      sender_name: isOwner ? `👑 Owner (${currentUser.name})` : currentUser.name,
      senderRole: currentUser.role || (isOwner ? 'owner' : 'user'),
      sender_role: currentUser.role || (isOwner ? 'owner' : 'user'),
      text,
      message: text,
      timestamp: serverTimestamp(),
      created_at: new Date().toISOString(),
    };

    // Requirement 3: Merge local state optimistically
    setChatMessages((prev) => [...prev, newMsg]);
    setChatInput('');
    setTimeout(() => chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);

    try {
      await addDoc(collection(db, 'calls', callId, 'messages'), {
        callId,
        senderId: currentUser.uid,
        sender_id: currentUser.uid,
        senderName: newMsg.senderName,
        sender_name: newMsg.sender_name,
        senderRole: newMsg.senderRole,
        sender_role: newMsg.sender_role,
        text,
        message: text,
        timestamp: serverTimestamp(),
        created_at: newMsg.created_at,
      });
    } catch (err: any) {
      console.error('[WebRTC Chat Send Error]:', err);
    }
  };

  if (!activeCall) return null;

  const isConnected = iceState === 'connected' || iceState === 'completed' || connectionState === 'connected';
  const isDisconnected = iceState === 'disconnected' || connectionState === 'disconnected';
  const isFailed = iceState === 'failed' || connectionState === 'failed';

  return (
    <div className="fixed inset-0 z-50 bg-[#0B0B0E] flex flex-col justify-between overflow-hidden select-none">
      {/* Hidden Audio element for remote audio stream playback */}
      <audio ref={remoteAudioRef} autoPlay playsInline />

      {/* 1. Top Heads-Up Display (HUD) */}
      <div className="absolute top-0 left-0 right-0 z-30 px-4 py-3 bg-gradient-to-b from-black/95 via-black/80 to-transparent flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="relative">
            <img
              src={partnerPic}
              alt={partnerName}
              className="w-10 h-10 rounded-full object-cover border-2 border-[#FF69B4] shadow-[0_0_12px_rgba(255,105,180,0.5)]"
            />
            {/* Live presence indicator */}
            <span className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-black ${
              isConnected ? 'bg-emerald-500 animate-pulse' : isDisconnected ? 'bg-amber-500 animate-ping' : isFailed ? 'bg-red-500' : 'bg-blue-400'
            }`} />
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                {partnerName}
              </h3>
              {isOwner && (
                <span className="px-2 py-0.5 rounded-full bg-amber-500 text-black text-[10px] font-black uppercase flex items-center gap-1 shadow-[0_0_10px_rgba(245,158,11,0.6)]">
                  <Crown className="w-3 h-3" />
                  <span>OWNER</span>
                </span>
              )}
            </div>
            
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-xs font-mono font-bold text-emerald-400 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                {formatTime(callDuration)}
              </span>
              <span className="text-[10px] text-zinc-500">•</span>
              
              {/* WebRTC Live Status Tag */}
              <button
                onClick={() => {
                  setShowDebugConsole(true);
                  setIsDebugCollapsed((v) => !v);
                }}
                className={`text-[10px] font-medium flex items-center gap-1 px-1.5 py-0.5 rounded-full transition ${
                  isConnected 
                    ? 'text-emerald-300 bg-emerald-500/15 border border-emerald-500/30' 
                    : isDisconnected 
                    ? 'text-yellow-300 bg-yellow-500/15 border border-yellow-500/30 animate-pulse' 
                    : isFailed 
                    ? 'text-red-300 bg-red-500/15 border border-red-500/30' 
                    : 'text-cyan-300 bg-cyan-500/15 border border-cyan-500/30'
                }`}
                title="Toggle Debug Console overlay"
              >
                <Wifi className="w-2.5 h-2.5" />
                <span>WebRTC {isConnected ? 'HD Connected' : isDisconnected ? 'Reconnecting...' : isFailed ? 'Failed (15s grace)...' : iceState}</span>
              </button>

              {/* Requirement 6: UI indicator showing candidate types found (host/srflx/relay count) */}
              <button
                onClick={() => {
                  setShowDebugConsole(true);
                  setIsDebugCollapsed(false);
                }}
                className="hidden sm:flex items-center gap-1.5 text-[10px] font-mono px-2 py-0.5 rounded-full bg-zinc-900/90 border border-zinc-700/80 text-zinc-300 hover:border-zinc-500 transition"
                title="ICE Candidates: Host (local LAN) | STUN srflx (public IP) | TURN relay"
              >
                <span className="text-zinc-500 font-bold text-[9px]">ICE:</span>
                <span className="text-blue-300" title="Host candidates (local LAN)">🏠{candidateCounts.host}</span>
                <span className="text-zinc-600">|</span>
                <span className={candidateCounts.srflx > 0 ? 'text-emerald-300 font-bold' : 'text-zinc-500'} title="STUN srflx candidates (public IP NAT)">
                  🌐{candidateCounts.srflx}
                </span>
                <span className="text-zinc-600">|</span>
                <span className={candidateCounts.relay > 0 ? 'text-purple-300 font-bold' : 'text-zinc-500'} title="TURN relay candidates (fallback)">
                  🔄{candidateCounts.relay}
                </span>
                {candidateCounts.host > 0 && candidateCounts.srflx === 0 && candidateCounts.relay === 0 && (
                  <span className="ml-1 px-1 rounded bg-amber-500/20 text-amber-300 text-[8px] font-bold animate-pulse">
                    Host Only
                  </span>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Right HUD: Coin Counter & Diagnostics Trigger */}
        <div className="flex items-center gap-2">
          {/* Debug Console Toggle Button */}
          <button
            onClick={() => {
              if (!showDebugConsole) {
                setShowDebugConsole(true);
                setIsDebugCollapsed(false);
              } else {
                setIsDebugCollapsed((v) => !v);
              }
            }}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-mono font-bold transition active:scale-95 ${
              !isDebugCollapsed
                ? 'bg-emerald-500 text-black shadow-[0_0_15px_rgba(16,185,129,0.5)]'
                : isDisconnected
                ? 'bg-yellow-500/30 border border-yellow-400 text-yellow-300 animate-pulse'
                : 'bg-zinc-800/90 hover:bg-zinc-700/90 text-zinc-300 border border-zinc-700'
            }`}
            title="Toggle WebRTC Debug Console overlay"
          >
            <Terminal className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Debug</span>
            <span className="text-[10px] px-1 rounded bg-black/40 text-white font-mono">
              {logs.length}
            </span>
          </button>

          {/* Billing / Role display */}
          {isOwner ? (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-500/20 border border-amber-500/50 text-amber-300 text-xs backdrop-blur-md">
              <Crown className="w-3.5 h-3.5 text-amber-400" />
              <span className="font-black">Owner</span>
            </div>
          ) : isCaller ? (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-black/60 border border-amber-500/40 text-amber-300 text-xs backdrop-blur-md">
              <Coins className="w-3.5 h-3.5 text-amber-400" />
              <span className="font-bold">{currentUser?.coins_balance} Coins</span>
              <span className="text-[10px] text-zinc-400">({remainingMinutes}m)</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-black/60 border border-cyan-500/40 text-cyan-300 text-xs backdrop-blur-md">
              <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
              <span className="font-bold">Earning</span>
            </div>
          )}
        </div>
      </div>

      {/* 2. Real-time Status Notice Banner */}
      {statusNotice && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-40 px-3.5 py-1.5 rounded-full bg-black/90 border border-zinc-700 text-white text-xs font-semibold backdrop-blur-md flex items-center gap-2 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
          <div className="w-2 h-2 rounded-full bg-[#FF69B4] animate-ping" />
          <span>{statusNotice}</span>
        </div>
      )}

      {/* Disconnection Warning Banner - Retrying without auto-closing (Requirement 3) */}
      {isDisconnected && (
        <div className="absolute top-24 left-1/2 -translate-x-1/2 z-40 px-4 py-2 rounded-2xl bg-yellow-500/20 border-2 border-yellow-500 text-yellow-200 text-xs font-bold backdrop-blur-md flex items-center gap-2 shadow-2xl animate-pulse">
          <AlertTriangle className="w-4 h-4 text-yellow-400" />
          <span>Network disconnected. Retrying connection via STUN/TURN (will not auto-close)...</span>
        </div>
      )}

      {/* 15-Second Failed Grace Period Banner (Requirement 3) */}
      {isFailed && (
        <div className="absolute top-24 left-1/2 -translate-x-1/2 z-40 px-4 py-2 rounded-2xl bg-red-500/20 border-2 border-red-500 text-red-200 text-xs font-bold backdrop-blur-md flex items-center gap-2 shadow-2xl animate-pulse">
          <AlertTriangle className="w-4 h-4 text-red-400" />
          <span>WebRTC connection failed. Retrying ICE candidate pairs (15s grace period before closing)...</span>
        </div>
      )}

      {/* Host Only Network Warning Banner (Requirement 2) */}
      {candidateCounts.host > 0 && candidateCounts.srflx === 0 && candidateCounts.relay === 0 && iceGatheringState === 'complete' && (
        <div className="absolute top-36 left-1/2 -translate-x-1/2 z-40 px-3.5 py-1.5 rounded-2xl bg-amber-500/20 border border-amber-500 text-amber-200 text-xs font-bold backdrop-blur-md flex items-center gap-2 shadow-2xl">
          <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
          <span>Only host candidates found. Cross-network NAT traversal may require STUN/TURN.</span>
        </div>
      )}

      {/* 3. Main Call Stage */}
      {/* Requirement 3: Ensure video elements have higher z-index (20, 30) than debug panel when collapsed (10) */}
      <div 
        style={{ zIndex: 20 }}
        className="relative z-20 flex-1 w-full h-full flex items-center justify-center"
      >
        {isScreenSharing ? (
          /* Screen Sharing View */
          <div className="relative z-20 w-full h-full bg-black flex items-center justify-center">
            <video
              ref={screenVideoRef}
              autoPlay
              playsInline
              style={{ zIndex: 20 }}
              className="relative z-20 w-full h-full object-contain"
            />
            <div className="absolute top-20 left-4 px-3 py-1.5 rounded-full bg-[#FF69B4]/85 text-white text-xs font-bold flex items-center gap-1.5 shadow-lg backdrop-blur-md z-30">
              <Monitor className="w-3.5 h-3.5" />
              Broadcasting Screen
            </div>
          </div>
        ) : isVideoCall ? (
          /* Video Call View */
          <div className="relative z-20 w-full h-full flex items-center justify-center bg-[#121217]">
            {/* Remote Peer Video Stream (muted to let remoteAudioRef handle audio output) */}
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              muted
              style={{ zIndex: 20 }}
              className={`relative z-20 w-full h-full object-cover ${hasRemoteVideo ? 'block' : 'hidden'}`}
            />

            {/* Fallback Screen if remote peer has not enabled camera or track is connecting */}
            {!hasRemoteVideo && (
              <div className="relative z-20 w-full h-full flex items-center justify-center overflow-hidden">
                <img
                  src={partnerPic}
                  alt={partnerName}
                  className="w-full h-full object-cover filter blur-[3px] opacity-60 scale-105"
                />
                <div className="absolute inset-0 bg-black/50" />

                <div className="absolute text-center z-10 p-4">
                  <div className="relative inline-block mb-3">
                    <img
                      src={partnerPic}
                      alt={partnerName}
                      className="w-28 h-28 rounded-full object-cover mx-auto border-4 border-[#FF69B4] shadow-[0_0_30px_rgba(255,105,180,0.6)]"
                    />
                    {isConnected && (
                      <span className="absolute bottom-1 right-1 w-5 h-5 rounded-full bg-emerald-500 border-2 border-black flex items-center justify-center">
                        <Activity className="w-3 h-3 text-black" />
                      </span>
                    )}
                  </div>
                  <h4 className="text-xl font-black text-white">{partnerName}</h4>
                  <p className="text-xs text-zinc-300 font-medium mt-1 flex items-center justify-center gap-1.5">
                    <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-400 animate-ping' : 'bg-amber-400 animate-pulse'}`} />
                    {isConnected ? 'Connected • Waiting for camera' : `Connecting via STUN/TURN (${iceState})...`}
                  </p>
                </div>
              </div>
            )}

            {/* Local Video PIP Window - Requirement 3: z-index 30, higher than collapsed debug panel (10) */}
            <div 
              style={{ zIndex: 30 }}
              className="absolute bottom-28 right-4 w-32 h-44 sm:w-36 sm:h-48 bg-zinc-900 rounded-2xl overflow-hidden border-2 border-[#FF69B4] shadow-2xl z-30"
            >
              <video
                ref={localVideoRef}
                autoPlay
                playsInline
                muted
                style={{ zIndex: 30 }}
                className={`relative z-30 w-full h-full object-cover ${isVideoOff ? 'hidden' : 'block'}`}
              />
              
              {/* Camera Off Overlay */}
              {isVideoOff && (
                <div className="absolute inset-0 bg-[#14141B] flex flex-col items-center justify-center text-zinc-400 p-2 text-center">
                  <div className="w-10 h-10 rounded-full bg-red-500/15 border border-red-500/30 flex items-center justify-center mb-1.5">
                    <VideoOff className="w-5 h-5 text-red-400" />
                  </div>
                  <span className="text-[11px] font-bold text-white">Camera Off</span>
                  <span className="text-[9px] text-zinc-500">Audio only</span>
                </div>
              )}

              {/* Corner Mic Indicator on PIP */}
              <div className="absolute top-2 right-2 z-30">
                {isMuted ? (
                  <div className="w-6 h-6 rounded-full bg-red-600/90 text-white flex items-center justify-center shadow-md">
                    <MicOff className="w-3.5 h-3.5" />
                  </div>
                ) : isSpeaking ? (
                  <div className="w-6 h-6 rounded-full bg-emerald-500 text-black flex items-center justify-center shadow-md animate-pulse">
                    <Mic className="w-3.5 h-3.5 font-bold" />
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        ) : (
          /* Voice Call Stage */
          <div className="flex flex-col items-center justify-center p-6 space-y-6">
            <div className="relative">
              <div className="absolute -inset-4 rounded-full bg-[#FF69B4]/20 animate-ring-pulse" />
              <div className="absolute -inset-8 rounded-full bg-[#FF69B4]/10 animate-ping" />
              <img
                src={partnerPic}
                alt={partnerName}
                className="w-36 h-36 rounded-full object-cover border-4 border-[#FF69B4] relative z-10 shadow-[0_0_35px_rgba(255,105,180,0.55)]"
              />
            </div>

            <div className="text-center space-y-1 z-10">
              <h3 className="text-2xl font-black text-white">{partnerName}</h3>
              <p className="text-xs text-zinc-400 flex items-center justify-center gap-1.5">
                <Volume2 className="w-3.5 h-3.5 text-emerald-400" />
                Live Audio Session ({activeCall.rate_per_min || AUDIO_COIN_PER_MINUTE} coins/min)
              </p>
              <div className="flex items-center justify-center gap-2 text-[11px] font-mono text-zinc-500 pt-1">
                <span>STUN / TURN NAT</span>
                <span>•</span>
                <span className={isConnected ? 'text-emerald-400 font-bold' : 'text-amber-400'}>
                  {isConnected ? 'P2P Active' : iceState}
                </span>
              </div>
            </div>

            {/* Animated Audio Waveform */}
            <div className="flex items-center gap-1.5 h-12">
              {[40, 75, 55, 90, 65, 80, 50, 85, 70, 45].map((height, i) => (
                <span
                  key={i}
                  className="w-1.5 bg-[#FF69B4] rounded-full animate-pulse shadow-[0_0_8px_#FF69B4]"
                  style={{
                    height: `${height}%`,
                    animationDelay: `${i * 0.15}s`,
                    animationDuration: '0.8s',
                  }}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Floating Hearts Animation Layer */}
      <div 
        className="fixed inset-0 pointer-events-none overflow-hidden z-40 select-none"
        aria-hidden="true"
      >
        <div className="absolute bottom-24 right-6 sm:right-28 w-36 h-[550px] flex items-end justify-center pointer-events-none">
          {floatingHearts.map((heart) => (
            <div
              key={heart.id}
              className="absolute bottom-0 animate-floating-heart-rise flex items-center justify-center filter drop-shadow-[0_0_12px_rgba(255,105,180,0.75)] select-none pointer-events-none"
              style={{
                left: `calc(50% + ${heart.leftOffset}px)`,
                fontSize: `${heart.size}px`,
                ['--heart-duration' as any]: `${heart.duration}s`,
                ['--sway-x1' as any]: `${heart.swayX1}px`,
                ['--sway-x2' as any]: `${heart.swayX2}px`,
                ['--sway-x3' as any]: `${heart.swayX3}px`,
                ['--sway-x4' as any]: `${heart.swayX4}px`,
                ['--sway-x5' as any]: `${heart.swayX5}px`,
                ['--rot-1' as any]: `${heart.rot1}deg`,
                ['--rot-2' as any]: `${heart.rot2}deg`,
                ['--rot-3' as any]: `${heart.rot3}deg`,
                ['--rot-4' as any]: `${heart.rot4}deg`,
                ['--rot-5' as any]: `${heart.rot5}deg`,
              }}
            >
              {heart.emoji ? (
                <span className="leading-none">{heart.emoji}</span>
              ) : (
                <Heart
                  style={{
                    width: `${heart.size}px`,
                    height: `${heart.size}px`,
                    color: heart.color,
                    fill: heart.color,
                  }}
                  className="filter drop-shadow-[0_0_10px_currentColor]"
                />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* 4. Floating Control Dock */}
      <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-40 w-[calc(100%-1.5rem)] max-w-xl bg-[#111116]/95 backdrop-blur-2xl border border-zinc-700/60 rounded-3xl p-3 px-4 shadow-[0_15px_50px_rgba(0,0,0,0.85)] flex items-center justify-between gap-1 sm:gap-2 transition-all duration-300">
        
        {/* A. Mute / Unmute Button */}
        <div className="flex flex-col items-center gap-1">
          <button
            onClick={handleToggleMic}
            className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-200 active:scale-90 relative ${
              isMuted
                ? 'bg-red-500/25 border-2 border-red-500 text-red-400 shadow-[0_0_20px_rgba(239,68,68,0.4)]'
                : isSpeaking
                ? 'bg-emerald-500/20 border-2 border-emerald-400 text-emerald-300 shadow-[0_0_25px_rgba(52,211,153,0.5)] scale-105'
                : 'bg-[#1C1C26] hover:bg-[#252533] border border-zinc-700/80 text-white shadow-sm'
            }`}
            title={isMuted ? 'Unmute Microphone' : 'Mute Microphone'}
          >
            {isMuted ? (
              <MicOff className="w-5 h-5 text-red-400" />
            ) : (
              <Mic className={`w-5 h-5 ${isSpeaking ? 'text-emerald-400' : 'text-white'}`} />
            )}

            {!isMuted && isSpeaking && (
              <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-emerald-400 animate-ping" />
            )}
          </button>
          <span className={`text-[10px] font-bold tracking-tight ${isMuted ? 'text-red-400' : 'text-zinc-300'}`}>
            {isMuted ? 'Muted' : 'Mic On'}
          </span>
        </div>

        {/* B. Camera Toggle Button */}
        <div className="flex flex-col items-center gap-1">
          <button
            onClick={handleToggleCamera}
            className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-200 active:scale-90 relative ${
              isVideoOff
                ? 'bg-red-500/25 border-2 border-red-500 text-red-400 shadow-[0_0_20px_rgba(239,68,68,0.4)]'
                : 'bg-[#1C1C26] hover:bg-[#252533] border border-zinc-700/80 text-cyan-400 shadow-sm'
            }`}
            title={isVideoOff ? 'Turn Camera On' : 'Turn Camera Off'}
          >
            {isVideoOff ? (
              <VideoOff className="w-5 h-5 text-red-400" />
            ) : (
              <Video className="w-5 h-5 text-cyan-400" />
            )}
          </button>
          <span className={`text-[10px] font-bold tracking-tight ${isVideoOff ? 'text-red-400' : 'text-zinc-300'}`}>
            {isVideoOff ? 'Cam Off' : 'Camera On'}
          </span>
        </div>

        {/* C. Screen Share Button */}
        <div className="flex flex-col items-center gap-1">
          <button
            onClick={handleToggleScreenShare}
            className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-200 active:scale-90 relative ${
              isScreenSharing
                ? 'bg-[#FF69B4] text-white shadow-[0_0_20px_rgba(255,105,180,0.6)]'
                : 'bg-[#1C1C26] hover:bg-[#252533] border border-zinc-700/80 text-zinc-300'
            }`}
            title={isScreenSharing ? 'Stop Screen Sharing' : 'Share Screen'}
          >
            {isScreenSharing ? <MonitorOff className="w-5 h-5" /> : <Monitor className="w-5 h-5" />}
          </button>
          <span className="text-[10px] font-bold tracking-tight text-zinc-300">
            {isScreenSharing ? 'Sharing' : 'Share'}
          </span>
        </div>

        {/* D. Live Chat Button */}
        <div className="flex flex-col items-center gap-1">
          <button
            onClick={() => setShowChat(!showChat)}
            className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-200 active:scale-90 relative ${
              showChat
                ? 'bg-purple-600 text-white shadow-[0_0_20px_rgba(147,51,234,0.6)]'
                : 'bg-[#1C1C26] hover:bg-[#252533] border border-zinc-700/80 text-zinc-300'
            }`}
            title="Meeting Chat"
          >
            <MessageSquare className="w-5 h-5" />
            {chatMessages.length > 0 && (
              <span className="absolute -top-1 -right-1 min-w-4 h-4 px-1 rounded-full bg-emerald-500 text-black text-[9px] font-black flex items-center justify-center">
                {chatMessages.length}
              </span>
            )}
          </button>
          <span className="text-[10px] font-bold tracking-tight text-zinc-300">Chat</span>
        </div>

        {/* E. Floating Heart Reaction Button */}
        <div className="flex flex-col items-center gap-1">
          <button
            onClick={handleSendHeart}
            className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-200 active:scale-90 relative select-none ${
              isHeartPopping
                ? 'bg-gradient-to-tr from-pink-600 to-rose-500 text-white shadow-[0_0_25px_rgba(255,105,180,0.85)] scale-110 animate-heart-pop'
                : 'bg-pink-500/15 hover:bg-pink-500/25 border border-pink-500/40 text-pink-400 shadow-[0_0_15px_rgba(255,105,180,0.25)]'
            }`}
            title="Send Floating Heart Reaction (Tap to shower love)"
          >
            <Heart
              className={`w-5 h-5 transition-transform duration-200 ${
                isHeartPopping ? 'fill-white stroke-white scale-110' : 'fill-pink-500 stroke-pink-400'
              }`}
            />
            {heartCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 min-w-5 h-5 px-1 rounded-full bg-gradient-to-r from-pink-500 to-rose-500 text-white text-[10px] font-black flex items-center justify-center shadow-lg border border-pink-300 animate-bounce">
                +{heartCount}
              </span>
            )}
          </button>
          <span className="text-[10px] font-bold tracking-tight text-pink-300">Heart</span>
        </div>

        {/* F. Owner Remote Mute Control */}
        {isOwner && (
          <div className="flex flex-col items-center gap-1">
            <button
              onClick={() => activeCall?.id && ownerMuteCall(activeCall.id, !isMuted)}
              className="w-12 h-12 rounded-2xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/50 text-amber-300 flex items-center justify-center transition active:scale-90"
              title="Owner Remote Mute"
            >
              <VolumeX className="w-5 h-5" />
            </button>
            <span className="text-[10px] font-bold tracking-tight text-amber-300">Owner</span>
          </div>
        )}

        {/* G. End Call Button */}
        <div className="flex flex-col items-center gap-1">
          <button
            onClick={handleExplicitEndCall}
            className="w-12 h-12 rounded-2xl bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white shadow-[0_0_25px_rgba(239,68,68,0.65)] flex items-center justify-center active:scale-90 transition transform"
            title={isOwner ? 'Owner: Terminate Meeting' : 'End Call'}
          >
            <PhoneOff className="w-5 h-5" />
          </button>
          <span className="text-[10px] font-bold tracking-tight text-red-400">End</span>
        </div>
      </div>

      {/* Floating Quick Reaction Heart Button (Right side, tap easily with one hand) */}
      <div className="fixed bottom-24 right-4 sm:right-8 z-40 flex flex-col items-center gap-1 select-none">
        <button
          onClick={handleSendHeart}
          className={`w-12 h-12 sm:w-14 sm:h-14 rounded-full flex items-center justify-center shadow-[0_4px_25px_rgba(255,105,180,0.5)] backdrop-blur-xl border border-pink-400/40 transition-all duration-150 active:scale-75 ${
            isHeartPopping
              ? 'bg-gradient-to-tr from-pink-600 via-rose-500 to-pink-400 text-white scale-120 animate-heart-pop shadow-[0_0_35px_rgba(255,105,180,0.9)]'
              : 'bg-[#181824]/90 hover:bg-pink-500/25 text-pink-400 hover:scale-105'
          }`}
          title="Quick Heart Reaction"
        >
          <Heart
            className={`w-6 h-6 sm:w-7 sm:h-7 transition-all ${
              isHeartPopping ? 'fill-white stroke-white scale-110' : 'fill-pink-500/90 stroke-pink-300'
            }`}
          />
          {heartCount > 1 && (
            <span className="absolute -top-1 -right-1 px-1.5 py-0.5 rounded-full bg-rose-500 text-white font-extrabold text-[10px] border border-white/60 shadow-md animate-bounce">
              x{heartCount}
            </span>
          )}
        </button>
      </div>

      {/* 5. In-Call Live Chat Drawer */}
      {showChat && (
        <div className="absolute right-3 bottom-28 z-50 w-80 max-w-[calc(100vw-24px)] bg-[#101016]/95 backdrop-blur-2xl border border-purple-500/40 rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-4">
          <div className="p-3 bg-[#151520] border-b border-zinc-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-purple-400" />
              <span className="text-xs font-bold text-white">In-Call Chat</span>
              <span className="px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 text-[9px] font-bold">
                Firestore Realtime
              </span>
            </div>
            <button
              onClick={() => setShowChat(false)}
              className="p-1 text-zinc-400 hover:text-white rounded-lg"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="p-3 h-56 overflow-y-auto space-y-2 text-xs">
            {chatMessages.length === 0 ? (
              <div className="text-center text-zinc-500 text-[11px] py-10">
                No messages yet. Send a message to chat in realtime!
              </div>
            ) : (
              chatMessages.map((msg, i) => {
                const isMe = (msg.senderId || msg.sender_id) === currentUser?.uid;
                const isMsgOwner = (msg.senderRole || msg.sender_role) === 'owner';
                const displayName = msg.senderName || msg.sender_name || (isMe ? 'You' : partnerName);
                const messageText = msg.text || msg.message;
                return (
                  <div
                    key={msg.id || i}
                    className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
                  >
                    <div className="text-[10px] text-zinc-500 mb-0.5 flex items-center gap-1">
                      <span>{displayName}</span>
                      {isMsgOwner && (
                        <span className="text-amber-400 font-bold">👑</span>
                      )}
                    </div>
                    <div
                      className={`py-1.5 px-3 rounded-2xl max-w-[85%] break-words ${
                        isMe
                          ? 'bg-purple-600 text-white rounded-tr-none'
                          : 'bg-[#1C1C28] text-zinc-200 border border-zinc-800 rounded-tl-none'
                      }`}
                    >
                      {messageText}
                    </div>
                  </div>
                );
              })
            )}
            <div ref={chatBottomRef} />
          </div>

          <form onSubmit={handleSendChat} className="p-2 border-t border-zinc-800 flex gap-1.5 bg-[#0C0C12]">
            <input
              type="text"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              placeholder="Type message..."
              className="flex-1 bg-[#161622] border border-zinc-700 rounded-xl px-3 py-1.5 text-xs text-white placeholder:text-zinc-600 focus:outline-none focus:border-purple-500"
            />
            <button
              type="submit"
              className="p-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white transition active:scale-95"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </form>
        </div>
      )}

      {/* 6. WebRTC Collapsible Debug Console Overlay */}
      <DebugConsole
        isOpen={showDebugConsole}
        onClose={() => setShowDebugConsole(false)}
        logs={logs}
        signalingState={signalingState}
        iceState={iceState}
        connectionState={connectionState}
        iceGatheringState={iceGatheringState}
        candidateCounts={candidateCounts}
        onClearLogs={() => setLogs([])}
        defaultCollapsed={true}
        isCollapsed={isDebugCollapsed}
        onToggleCollapse={setIsDebugCollapsed}
      />
    </div>
  );
};
