import { 
  doc, 
  updateDoc, 
  onSnapshot, 
  collection, 
  addDoc, 
  serverTimestamp
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { ringtoneService } from './ringtoneService';

export interface WebRTCLogEntry {
  id: string;
  timestamp: string;
  type: 'info' | 'warn' | 'error' | 'success' | 'signaling' | 'ice' | 'conn';
  tag: string;
  message: string;
}

export type WebRTCLogListener = (entry: WebRTCLogEntry) => void;

export interface CandidateCounts {
  host: number;
  srflx: number;
  relay: number;
  total: number;
}

/**
 * Public STUN servers for NAT traversal & srflx candidate discovery
 * Configured with 4 reliable STUN servers as required.
 */
export const STUN_SERVERS: RTCIceServer[] = [
  {
    urls: [
      'stun:stun.l.google.com:19302',
      'stun:stun1.l.google.com:19302',
      'stun:stun2.l.google.com:19302',
      'stun:global.stun.twilio.com:3478',
    ],
  },
];

/**
 * Free TURN server for NAT traversal (OpenRelay / Metered)
 * Configured with working URLs and credentials. TURN is treated as an optional fallback.
 */
export const TURN_SERVERS: (RTCIceServer & { password?: string })[] = [
  {
    urls: [
      'turn:openrelay.metered.ca:80',
      'turn:openrelay.metered.ca:443',
    ],
    username: 'openrelayproject',
    credential: 'openrelayproject',
    password: 'openrelayproject',
  },
];

/**
 * Primary WebRTC Configuration with STUN (4 servers) and optional TURN fallback
 */
export const RTC_CONFIGURATION: RTCConfiguration = {
  iceServers: [
    ...STUN_SERVERS,
    ...TURN_SERVERS,
  ],
  iceCandidatePoolSize: 10,
};

/**
 * STUN-only fallback configuration in case TURN is unreachable or fails DNS resolution
 */
export const STUN_ONLY_CONFIGURATION: RTCConfiguration = {
  iceServers: STUN_SERVERS,
  iceCandidatePoolSize: 10,
};

export interface WebRTCSessionOptions {
  callId: string;
  isCaller: boolean;
  isVideo: boolean;
  localStream: MediaStream;
  onRemoteStream: (stream: MediaStream) => void;
  onCallEnded: (reason: string) => void;
  onLog: (entry: WebRTCLogEntry) => void;
  onCandidateCountsChange?: (counts: CandidateCounts) => void;
}

export class WebRTCSession {
  public pc: RTCPeerConnection;
  private callId: string;
  private isCaller: boolean;
  private isVideo: boolean;
  private localStream: MediaStream;
  private remoteStream: MediaStream | null = null;
  private onRemoteStream: (stream: MediaStream) => void;
  private onCallEnded: (reason: string) => void;
  private onLog: (entry: WebRTCLogEntry) => void;
  private onCandidateCountsChange?: (counts: CandidateCounts) => void;
  
  // 15-second grace timer for 'failed' state (Requirement 3)
  private failedTimer: any = null;

  // Active Firestore listeners - kept alive until destroy (Requirement 1)
  private unsubCallDoc: (() => void) | null = null;
  private unsubCandidates: (() => void) | null = null;

  // Candidate queuing before remote description is set (Requirement 1)
  private remoteCandidatesQueue: RTCIceCandidateInit[] = [];
  private remoteDescriptionSet = false;
  private appliedCandidateKeys = new Set<string>();
  private destroyed = false;

  // ICE Candidate Tracking for host/srflx/relay (Requirement 2 & 6)
  private candidateCounts: CandidateCounts = {
    host: 0,
    srflx: 0,
    relay: 0,
    total: 0,
  };
  private hasSrflxCandidate = false;
  private hasRelayCandidate = false;
  private onSrflxListeners: (() => void)[] = [];

  constructor(options: WebRTCSessionOptions) {
    this.callId = options.callId;
    this.isCaller = options.isCaller;
    this.isVideo = options.isVideo;
    this.localStream = options.localStream;
    this.onRemoteStream = options.onRemoteStream;
    this.onCallEnded = options.onCallEnded;
    this.onLog = options.onLog;
    this.onCandidateCountsChange = options.onCandidateCountsChange;

    this.log('info', 'CONFIG', 'Initializing RTCPeerConnection with 4 STUN servers & optional TURN fallback (iceCandidatePoolSize: 10)...');
    try {
      this.pc = new RTCPeerConnection(RTC_CONFIGURATION);
    } catch (err: any) {
      this.log('warn', 'CONFIG-FALLBACK', `Failed to init with TURN config (${err?.message}). Falling back to STUN only.`);
      this.pc = new RTCPeerConnection(STUN_ONLY_CONFIGURATION);
    }

    this.setupPeerConnectionEvents();
    
    // Requirement 4: Ensure localStream tracks are added before createOffer
    this.attachLocalTracks();
  }

  private formatTime(): string {
    const now = new Date();
    const h = now.getHours().toString().padStart(2, '0');
    const m = now.getMinutes().toString().padStart(2, '0');
    const s = now.getSeconds().toString().padStart(2, '0');
    const ms = now.getMilliseconds().toString().padStart(3, '0');
    return `${h}:${m}:${s}.${ms}`;
  }

  public log(type: WebRTCLogEntry['type'], tag: string, message: string) {
    const entry: WebRTCLogEntry = {
      id: `${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      timestamp: this.formatTime(),
      type,
      tag,
      message,
    };
    
    const consoleMsg = `[WebRTC ${tag}] ${message}`;
    if (type === 'error') {
      console.error(consoleMsg);
    } else if (type === 'warn') {
      console.warn(consoleMsg);
    } else {
      console.log(consoleMsg);
    }

    try {
      this.onLog(entry);
    } catch {}
  }

  public getCandidateCounts(): CandidateCounts {
    return { ...this.candidateCounts };
  }

  private setupPeerConnectionEvents() {
    // 1. Signaling State Change Logging
    this.pc.onsignalingstatechange = () => {
      const state = this.pc.signalingState;
      console.log('[WebRTC Signaling State]', state);
      this.log('signaling', 'SIGNALING', `Signaling state changed to: ${state}`);
      this.handleStateTransitions();
    };

    // 2. ICE Connection State Change
    this.pc.oniceconnectionstatechange = () => {
      const state = this.pc.iceConnectionState;
      console.log('[WebRTC ICE Connection State]', state);
      this.log('ice', 'ICE-STATE', `ICE connection state changed to: ${state}`);
      this.handleStateTransitions();
    };

    // 3. Connection State Change
    this.pc.onconnectionstatechange = () => {
      const state = this.pc.connectionState;
      console.log('[WebRTC Connection State]', state);
      this.log('conn', 'CONN-STATE', `Peer connection state changed to: ${state}`);
      this.handleStateTransitions();
    };

    // 4. ICE Candidate Errors & Fail-Soft Optional TURN Handling (Requirement 2)
    this.pc.onicecandidateerror = (event: any) => {
      const errorCode = event.errorCode;
      const errorText = event.errorText || '';
      const url = event.url || 'direct/unknown';
      const address = event.address;
      const port = event.port;

      const isTurn = url.toLowerCase().includes('turn:') || url.toLowerCase().includes('metered') || url.toLowerCase().includes('openrelay');
      const is701 = errorCode === 701;

      // Fail-soft logic: TURN is an optional fallback.
      // Do NOT fail the call on TURN 701 or server unreachable errors. Log warning and continue with STUN.
      if (is701 || isTurn) {
        console.warn(`[WebRTC Optional TURN Warning - Error ${errorCode}]`, {
          errorCode,
          errorText,
          url,
          address,
          port,
        });
        this.log(
          'warn',
          'TURN-OPTIONAL',
          `TURN server warning (${errorCode}): ${errorText || 'DNS resolution or server unreachable'} for ${url}. TURN is optional; proceeding with STUN.`
        );
        return;
      }

      console.error('[WebRTC ICE Candidate Error]', { errorCode, errorText, url, address, port });
      this.log(
        'error',
        'ICE-ERROR',
        `Candidate error (${errorCode}): ${errorText || 'Failed to gather from ' + url}`
      );
    };

    // 5. ICE Gathering State Change (Requirement 3: Never auto-close on gathering)
    this.pc.onicegatheringstatechange = () => {
      const state = this.pc.iceGatheringState;
      console.log('[WebRTC ICE Gathering State]', state);
      this.log('ice', 'ICE-GATHER', `ICE gathering state: ${state}`);
    };

    // 6. ICE Candidate Found (Trickle + Vanilla + Categorization) (Requirements 1, 2, 6)
    this.pc.onicecandidate = async (event) => {
      if (event.candidate) {
        const c = event.candidate;
        console.log('[WebRTC ICE Candidate]', c.candidate);

        const candStr = (c.candidate || '').toLowerCase();
        const candType = (c.type || '').toLowerCase();
        const isSrflx = candType === 'srflx' || candStr.includes('typ srflx');
        const isRelay = candType === 'relay' || candStr.includes('typ relay');
        const isHost = candType === 'host' || candStr.includes('typ host') || (!isSrflx && !isRelay);

        if (isSrflx) {
          this.candidateCounts.srflx++;
          this.hasSrflxCandidate = true;
          this.log(
            'success',
            'ICE-SRFLX',
            `STUN srflx candidate gathered: ip=${c.address || c.relatedAddress || 'srflx'} port=${c.port} proto=${c.protocol || 'udp'}`
          );
          // Notify any waiting srflx promise immediately
          const listeners = [...this.onSrflxListeners];
          this.onSrflxListeners = [];
          listeners.forEach((fn) => fn());
        } else if (isRelay) {
          this.candidateCounts.relay++;
          this.hasRelayCandidate = true;
          this.log(
            'success',
            'ICE-RELAY',
            `TURN relay candidate gathered: ip=${c.address || 'relay'} port=${c.port} proto=${c.protocol || 'udp'}`
          );
        } else {
          this.candidateCounts.host++;
          this.log(
            'ice',
            'ICE-HOST',
            `Host candidate gathered: proto=${c.protocol} ip=${c.address || c.relatedAddress || 'host'} port=${c.port}`
          );
        }
        this.candidateCounts.total++;

        // Notify UI of candidate counts change
        if (this.onCandidateCountsChange) {
          try {
            this.onCandidateCountsChange({ ...this.candidateCounts });
          } catch {}
        }
        
        // Write candidate to Firestore subcollection for real-time NAT traversal
        try {
          const subCol = this.isCaller ? 'caller_candidates' : 'receiver_candidates';
          await addDoc(collection(db, 'calls', this.callId, subCol), c.toJSON());
        } catch (e: any) {
          console.warn('[WebRTC ICE Candidate Write Warning]', e);
        }
      } else {
        console.log('[WebRTC ICE Candidate]', 'All ICE candidates gathered (end-of-candidates)');
        this.log('info', 'ICE-GATHER-DONE', `All candidates gathered. Counts: host=${this.candidateCounts.host}, srflx=${this.candidateCounts.srflx}, relay=${this.candidateCounts.relay}`);
        
        // Requirement 2: If only host candidates, log explicit network warning
        if (this.candidateCounts.host > 0 && this.candidateCounts.srflx === 0 && this.candidateCounts.relay === 0) {
          this.log(
            'warn',
            'ICE-HOST-ONLY',
            `Network Warning: Only host candidates (${this.candidateCounts.host}) gathered; no STUN srflx or TURN relay candidates found. Direct NAT traversal across external networks may fail if peers are not on the same LAN.`
          );
        }
      }
    };

    // 7. Remote Media Stream Track Received (Requirement 4)
    this.pc.ontrack = (event) => {
      // Requirement 2: Immediately stop ringing tone when remote track arrives
      ringtoneService.stopAll();

      // Requirement 5: For audio-only call, ensure local audio stream is not looping back
      if (this.localStream && this.localStream.getTracks().some((t) => t.id === event.track.id)) {
        this.log('warn', 'LOOPBACK', 'Ignoring local audio track in ontrack to prevent audio loopback');
        return;
      }

      this.log('success', 'TRACK', `Remote track received: kind=${event.track.kind}, id=${event.track.id}`);
      
      // Requirement 4: Explicit debug log for "REMOTE-AUDIO-TRACK received"
      if (event.track.kind === 'audio') {
        this.log(
          'success', 
          'REMOTE-AUDIO-TRACK', 
          `REMOTE-AUDIO-TRACK received: id=${event.track.id}, enabled=${event.track.enabled}, readyState=${event.track.readyState}`
        );
      }
      
      let stream = event.streams && event.streams[0];
      if (!stream) {
        if (!this.remoteStream) {
          this.remoteStream = new MediaStream();
        }
        if (!this.remoteStream.getTracks().some((t) => t.id === event.track.id)) {
          this.remoteStream.addTrack(event.track);
        }
        stream = this.remoteStream;
      } else {
        if (!stream.getTracks().some((t) => t.id === event.track.id)) {
          stream.addTrack(event.track);
        }
        this.remoteStream = stream;
      }

      this.onRemoteStream(stream);
    };
  }

  /**
   * Requirement 3: Lifecycle management
   * - Don't auto-close on 'disconnected' or 'gathering' state.
   * - Only close on explicit End call or after 15 sec 'failed'.
   */
  private handleStateTransitions() {
    if (this.destroyed) return;

    const iceState = this.pc.iceConnectionState;
    const connState = this.pc.connectionState;

    // Check if reconnected or completed -> cancel any pending failed timer
    if (iceState === 'connected' || connState === 'connected' || iceState === 'completed') {
      if (this.failedTimer) {
        clearTimeout(this.failedTimer);
        this.failedTimer = null;
        this.log('success', 'CONN-RECOVER', 'Connection restored to connected! Cancelled 15s failure timer.');
      }
      return;
    }

    // Handle 'disconnected' state: DO NOT auto-close. WebRTC can self-heal or switch ICE paths.
    if (iceState === 'disconnected' || connState === 'disconnected') {
      this.log('warn', 'DISCONNECTED', 'Connection entered disconnected state. Retrying network path (will not auto-close)...');
      return;
    }

    // Handle 'gathering' state: DO NOT auto-close.
    if (this.pc.iceGatheringState === 'gathering') {
      return;
    }

    // Handle 'failed' state: Only close after 15 seconds in failed state
    if (iceState === 'failed' || connState === 'failed') {
      if (!this.failedTimer) {
        this.log('warn', 'FAILED-GRACE', 'Connection entered failed state. Starting 15-second grace period before closing...');
        this.failedTimer = setTimeout(() => {
          if (this.destroyed) return;
          const currentIce = this.pc.iceConnectionState;
          const currentConn = this.pc.connectionState;
          if (currentIce === 'failed' || currentConn === 'failed') {
            this.log('error', 'FAILED-TIMEOUT', 'Failed state persisted for 15 seconds. Closing call now.');
            this.onCallEnded('Call failed: WebRTC connection failure after 15s');
          } else {
            this.log('success', 'CONN-RECOVER', `Connection recovered from failed state to ICE=${currentIce}, Conn=${currentConn}.`);
          }
        }, 15000);
      }
      return;
    }
  }

  /**
   * Requirement 1: Ensure both sides add local audio track via addTrack before creating offer/answer
   */
  public ensureLocalAudioTrack(): boolean {
    try {
      if (!this.localStream) {
        this.log('error', 'MEDIA', 'Cannot ensure local audio track: localStream is missing');
        return false;
      }

      const audioTracks = this.localStream.getAudioTracks();
      if (audioTracks.length === 0) {
        this.log('warn', 'MEDIA', 'No audio track found in localStream');
        return false;
      }

      const audioTrack = audioTracks[0];
      // Requirement 3: Ensure mic is enabled (not muted by default)
      if (!audioTrack.enabled) {
        audioTrack.enabled = true;
        this.log('info', 'MEDIA', `Enabled local audio track before offer/answer: id=${audioTrack.id}`);
      }

      const senders = this.pc.getSenders();
      const existingAudioSender = senders.find(
        (s) => s.track && (s.track.kind === 'audio' || s.track.id === audioTrack.id)
      );

      if (!existingAudioSender) {
        this.pc.addTrack(audioTrack, this.localStream);
        this.log(
          'success',
          'LOCAL-AUDIO-TRACK',
          `Added local audio track via addTrack: id=${audioTrack.id}, kind=audio, enabled=${audioTrack.enabled}`
        );
      } else {
        this.log(
          'info',
          'LOCAL-AUDIO-TRACK',
          `Local audio track already attached to sender: id=${existingAudioSender.track?.id}, enabled=${existingAudioSender.track?.enabled}`
        );
      }

      // Also ensure all other tracks (e.g. video if video call) are attached
      this.localStream.getTracks().forEach((track) => {
        if (track.kind !== 'audio') {
          const hasSender = senders.some((s) => s.track && s.track.id === track.id);
          if (!hasSender) {
            this.pc.addTrack(track, this.localStream);
            this.log('info', 'MEDIA', `Added local track: ${track.kind} (id=${track.id})`);
          }
        }
      });

      return true;
    } catch (err: any) {
      this.log('error', 'MEDIA', `Failed to ensure local audio track: ${err?.message}`);
      return false;
    }
  }

  private attachLocalTracks() {
    this.ensureLocalAudioTrack();
  }

  /**
   * Requirement 2 & 5:
   * Wait up to 5 seconds for srflx candidate before sending offer (or answer).
   * - If an srflx candidate is received, resolves immediately.
   * - If ICE gathering completes or 5s timeout elapses with no srflx found:
   *   logs a clear warning, but DOES NOT close the PeerConnection or run cleanup,
   *   proceeding with available host candidates and optional TURN relay candidates.
   */
  private async waitForSrflxOrTimeout(timeoutMs = 5000): Promise<void> {
    if (this.hasSrflxCandidate) {
      this.log('success', 'ICE-SRFLX', 'STUN srflx candidate already gathered. Proceeding immediately.');
      return;
    }

    if (this.pc.iceGatheringState === 'complete') {
      this.log(
        'warn',
        'ICE-NO-SRFLX',
        'ICE gathering already complete with no srflx candidates found from STUN servers. Proceeding with host & TURN relay (PeerConnection kept open).'
      );
      if (this.candidateCounts.host > 0 && this.candidateCounts.srflx === 0 && this.candidateCounts.relay === 0) {
        this.log('warn', 'ICE-HOST-ONLY', `Network Warning: Only host candidates gathered (${this.candidateCounts.host}).`);
      }
      return;
    }

    this.log('info', 'ICE-WAIT', `Waiting up to ${timeoutMs / 1000}s for STUN srflx candidate before sending SDP...`);

    return new Promise((resolve) => {
      let resolved = false;
      let timer: any = null;

      const finish = (reason: 'srflx-found' | 'ice-complete' | 'timeout') => {
        if (resolved) return;
        resolved = true;
        if (timer) clearTimeout(timer);
        this.pc.removeEventListener('icegatheringstatechange', checkGathering);
        this.onSrflxListeners = this.onSrflxListeners.filter((l) => l !== onSrflx);

        if (reason === 'srflx-found') {
          this.log('success', 'ICE-SRFLX', 'STUN srflx candidate received! Proceeding with SDP transmission.');
        } else if (reason === 'ice-complete') {
          this.log(
            'warn',
            'ICE-NO-SRFLX',
            'ICE gathering complete: no srflx candidate produced by STUN servers. Proceeding with host & TURN relay (PeerConnection kept open).'
          );
        } else {
          this.log(
            'warn',
            'ICE-NO-SRFLX',
            `Timeout (${timeoutMs / 1000}s) reached: no srflx candidate found from STUN servers. Proceeding with host & TURN relay (PeerConnection kept open).`
          );
        }

        if (this.candidateCounts.host > 0 && this.candidateCounts.srflx === 0 && this.candidateCounts.relay === 0) {
          this.log('warn', 'ICE-HOST-ONLY', `Network Warning: Only host candidates discovered (${this.candidateCounts.host}).`);
        }

        resolve();
      };

      const onSrflx = () => finish('srflx-found');
      this.onSrflxListeners.push(onSrflx);

      const checkGathering = () => {
        if (this.pc.iceGatheringState === 'complete') {
          if (this.hasSrflxCandidate) {
            finish('srflx-found');
          } else {
            finish('ice-complete');
          }
        }
      };

      this.pc.addEventListener('icegatheringstatechange', checkGathering);

      timer = setTimeout(() => {
        finish('timeout');
      }, timeoutMs);
    });
  }

  /**
   * Start Signaling Flow
   */
  public async start() {
    if (this.isCaller) {
      await this.startCallerFlow();
    } else {
      await this.startReceiverFlow();
    }
  }

  /**
   * Caller Flow (Requirements 1, 2, 4, 5):
   * 1. Start listening for receiver candidates early (queues any early candidates)
   * 2. Create Offer (local tracks already attached)
   * 3. Set Local Description
   * 4. Wait up to 5s for srflx candidate
   * 5. Send Offer to Firestore
   * 6. Listen for Answer in Firestore (listener kept alive until destroy)
   */
  private async startCallerFlow() {
    this.log('info', 'CALLER', 'Starting caller signaling flow...');
    try {
      // 1. Listen for receiver candidates right away to queue them if receiver responds quickly
      this.listenForRemoteCandidates('receiver_candidates');

      // 2. Setup Firestore Answer listener right away so signaling channel is immediately active and stays alive
      this.unsubCallDoc = onSnapshot(
        doc(db, 'calls', this.callId),
        async (snap) => {
          if (!snap.exists() || this.destroyed) return;
          const data = snap.data();
          if (data?.answer && !this.remoteDescriptionSet && this.pc.signalingState === 'have-local-offer') {
            this.log('signaling', 'ANSWER-RECV', 'Remote answer detected in Firestore! Setting remote description...');
            try {
              await this.pc.setRemoteDescription(new RTCSessionDescription(data.answer));
              this.remoteDescriptionSet = true;
              this.log('success', 'ANSWER-SET', 'Remote answer applied. Signaling state is now: ' + this.pc.signalingState);
              await this.processQueuedCandidates();
            } catch (e: any) {
              this.log('error', 'ANSWER-ERR', `Failed to apply remote answer: ${e?.message}`);
            }
          }
        },
        (err) => {
          this.log('error', 'SIGNALING', `Firestore call listener error: ${err?.message}`);
        }
      );

      // 3. Ensure local audio track is attached via addTrack before creating offer (Requirement 1)
      this.ensureLocalAudioTrack();

      const offer = await this.pc.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: this.isVideo,
      });

      await this.pc.setLocalDescription(offer);
      this.log('signaling', 'OFFER', 'Local description set to offer.');

      // 4. Wait up to 5 seconds for srflx candidate before sending offer (log warning if none, keep connection open)
      await this.waitForSrflxOrTimeout(5000);

      const completeOffer = {
        type: this.pc.localDescription?.type || 'offer',
        sdp: this.pc.localDescription?.sdp || offer.sdp,
      };

      this.log('signaling', 'OFFER-SEND', `Sending offer to Firestore (SDP size: ${completeOffer.sdp?.length || 0} chars)...`);
      await updateDoc(doc(db, 'calls', this.callId), {
        offer: completeOffer,
        offer_sent_at: serverTimestamp(),
      });
      this.log('success', 'OFFER-SENT', 'Offer stored in Firestore calls collection.');
    } catch (err: any) {
      this.log('error', 'CALLER-ERR', `Caller signaling failed: ${err?.message}`);
    }
  }

  /**
   * Receiver Flow (Requirements 1, 2, 4, 5):
   * 1. Start listening for caller candidates early (queues any early candidates)
   * 2. Listen for Offer from Caller
   * 3. Set Remote Description (Offer)
   * 4. Drain queued candidates
   * 5. Create Answer
   * 6. Set Local Description
   * 7. Wait up to 5s for srflx candidate
   * 8. Send Answer to Firestore
   */
  private async startReceiverFlow() {
    this.log('info', 'RECEIVER', 'Starting receiver signaling flow, waiting for caller offer...');
    
    // 1. Listen for caller candidates early to queue them before remote description is set
    this.listenForRemoteCandidates('caller_candidates');

    // 2. Listen for Offer (kept alive until explicit destroy)
    this.unsubCallDoc = onSnapshot(
      doc(db, 'calls', this.callId),
      async (snap) => {
        if (!snap.exists() || this.destroyed) return;
        const data = snap.data();

        if (data?.offer && !this.remoteDescriptionSet && this.pc.signalingState === 'stable') {
          this.log('signaling', 'OFFER-RECV', 'Caller offer found in Firestore! Applying remote description...');
          try {
            await this.pc.setRemoteDescription(new RTCSessionDescription(data.offer));
            this.remoteDescriptionSet = true;
            this.log('success', 'OFFER-SET', 'Remote offer applied. Creating answer...');

            // Drain any caller candidates that arrived before the offer was set
            await this.processQueuedCandidates();

            // Requirement 1: Ensure local audio track is attached via addTrack before creating answer
            this.ensureLocalAudioTrack();

            const answer = await this.pc.createAnswer();
            await this.pc.setLocalDescription(answer);
            this.log('signaling', 'ANSWER', 'Local description set to answer.');

            // Wait up to 5 seconds for srflx candidate before sending answer (log warning if none, keep connection open)
            await this.waitForSrflxOrTimeout(5000);

            const completeAnswer = {
              type: this.pc.localDescription?.type || 'answer',
              sdp: this.pc.localDescription?.sdp || answer.sdp,
            };

            this.log('signaling', 'ANSWER-SEND', `Sending answer to Firestore (SDP size: ${completeAnswer.sdp?.length || 0} chars)...`);
            await updateDoc(doc(db, 'calls', this.callId), {
              answer: completeAnswer,
              answer_sent_at: serverTimestamp(),
            });
            this.log('success', 'ANSWER-SENT', 'Answer stored in Firestore calls collection.');
          } catch (e: any) {
            this.log('error', 'RECEIVER-ERR', `Receiver negotiation failed: ${e?.message}`);
          }
        }
      },
      (err) => {
        this.log('error', 'SIGNALING', `Firestore receiver listener error: ${err?.message}`);
      }
    );
  }

  /**
   * Listen for Remote Candidates from Firestore (Requirement 1)
   * Ensures listeners are not removed early and candidates added before remote description set are queued.
   */
  private listenForRemoteCandidates(subCol: string) {
    this.unsubCandidates = onSnapshot(
      collection(db, 'calls', this.callId, subCol),
      (snapshot) => {
        if (this.destroyed) return;
        snapshot.docChanges().forEach(async (change) => {
          if (change.type === 'added') {
            const candidateInit = change.doc.data() as RTCIceCandidateInit;
            if (!candidateInit || !candidateInit.candidate) {
              return;
            }

            if (this.remoteDescriptionSet && this.pc.remoteDescription) {
              await this.applyCandidate(candidateInit);
            } else {
              this.remoteCandidatesQueue.push(candidateInit);
              this.log('ice', 'CAND-QUEUE', `Queued remote candidate before remote description (${(candidateInit as any).protocol || 'candidate'})`);
            }
          }
        });
      },
      (err) => {
        this.log('error', 'CAND-ERR', `Firestore candidate listener error: ${err?.message}`);
      }
    );
  }

  /**
   * Process and drain all candidates queued before remote description was set
   */
  private async processQueuedCandidates() {
    if (!this.remoteDescriptionSet || !this.pc.remoteDescription) return;
    if (this.remoteCandidatesQueue.length === 0) return;

    this.log('info', 'CAND-DRAIN', `Draining ${this.remoteCandidatesQueue.length} queued remote candidates...`);
    const queue = [...this.remoteCandidatesQueue];
    this.remoteCandidatesQueue = [];

    for (const candidateInit of queue) {
      await this.applyCandidate(candidateInit);
    }
  }

  /**
   * Apply a single candidate with deduplication and error handling
   */
  private async applyCandidate(candidateInit: RTCIceCandidateInit) {
    if (!candidateInit || !candidateInit.candidate) return;

    const candKey = `${candidateInit.sdpMid}_${candidateInit.sdpMLineIndex}_${candidateInit.candidate}`;
    if (this.appliedCandidateKeys.has(candKey)) {
      return;
    }
    this.appliedCandidateKeys.add(candKey);

    try {
      await this.pc.addIceCandidate(new RTCIceCandidate(candidateInit));
      this.log('ice', 'CAND-ADD', `Applied remote candidate: ${(candidateInit as any).protocol || 'candidate'} (${candidateInit.candidate.slice(0, 25)}...)`);
    } catch (err: any) {
      this.log('error', 'CAND-ERR', `Failed to add ICE candidate: ${err?.message}`);
    }
  }

  /**
   * Requirement 5: Cleanup should ONLY run on user End (or 15s failed timeout),
   * NOT on ICE gathering timeout.
   */
  public destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    ringtoneService.stopAll();
    this.onSrflxListeners = [];
    
    if (this.failedTimer) {
      clearTimeout(this.failedTimer);
      this.failedTimer = null;
    }
    if (this.unsubCallDoc) {
      this.unsubCallDoc();
      this.unsubCallDoc = null;
    }
    if (this.unsubCandidates) {
      this.unsubCandidates();
      this.unsubCandidates = null;
    }
    try {
      this.pc.close();
      this.log('info', 'CLEANUP', 'PeerConnection closed and session cleaned up on explicit call termination.');
    } catch {}
  }
}
