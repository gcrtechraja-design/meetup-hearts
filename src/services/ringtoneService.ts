/**
 * Ringtone Synthesizer Service using Web Audio API
 * Generates realistic outgoing ringback tone and pleasant melodic incoming ringtone without external files.
 * Includes instant oscillator stopping, gain cancellation, and interval clearing.
 */

class RingtoneService {
  private outgoingAudioCtx: AudioContext | null = null;
  private incomingAudioCtx: AudioContext | null = null;
  private outgoingInterval: any = null;
  private incomingInterval: any = null;
  private vibrationInterval: any = null;
  private isOutgoingPlaying = false;
  private isIncomingPlaying = false;

  // Active WebAudio nodes for instant cancellation
  private activeOutgoingOscs: OscillatorNode[] = [];
  private activeOutgoingGains: GainNode[] = [];
  private activeIncomingOscs: OscillatorNode[] = [];
  private activeIncomingGains: GainNode[] = [];

  private getAudioContext(): typeof AudioContext {
    return window.AudioContext || (window as any).webkitAudioContext;
  }

  // -----------------------------------------------------------------
  // 1. OUTGOING RINGBACK TONE (For Caller Waiting for Answer)
  // Standard dual-frequency (440Hz + 480Hz) cadence: 1.8s tone, 2.2s silence
  // -----------------------------------------------------------------
  public startOutgoingRingtone(): void {
    if (this.isOutgoingPlaying) return;
    this.isOutgoingPlaying = true;

    try {
      const AudioCtxClass = this.getAudioContext();
      if (!AudioCtxClass) return;

      this.outgoingAudioCtx = new AudioCtxClass();
      if (this.outgoingAudioCtx.state === 'suspended') {
        this.outgoingAudioCtx.resume().catch(() => {});
      }

      const playBurst = () => {
        if (!this.isOutgoingPlaying || !this.outgoingAudioCtx || this.outgoingAudioCtx.state === 'closed') {
          return;
        }

        try {
          const ctx = this.outgoingAudioCtx;
          const now = ctx.currentTime;

          // Dual tone: 440Hz + 480Hz
          const osc1 = ctx.createOscillator();
          const osc2 = ctx.createOscillator();
          const gainNode = ctx.createGain();

          this.activeOutgoingOscs.push(osc1, osc2);
          this.activeOutgoingGains.push(gainNode);

          const cleanupNodes = () => {
            this.activeOutgoingOscs = this.activeOutgoingOscs.filter((o) => o !== osc1 && o !== osc2);
            this.activeOutgoingGains = this.activeOutgoingGains.filter((g) => g !== gainNode);
          };

          osc1.onended = cleanupNodes;
          osc2.onended = cleanupNodes;

          osc1.type = 'sine';
          osc1.frequency.setValueAtTime(440, now);

          osc2.type = 'sine';
          osc2.frequency.setValueAtTime(480, now);

          // Smooth envelope for 1.8s ring tone to prevent clicks
          gainNode.gain.setValueAtTime(0.0001, now);
          gainNode.gain.linearRampToValueAtTime(0.06, now + 0.05); // 50ms attack
          gainNode.gain.setValueAtTime(0.06, now + 1.7);
          gainNode.gain.linearRampToValueAtTime(0.0001, now + 1.8); // 100ms decay

          osc1.connect(gainNode);
          osc2.connect(gainNode);
          gainNode.connect(ctx.destination);

          osc1.start(now);
          osc2.start(now);
          osc1.stop(now + 1.85);
          osc2.stop(now + 1.85);
        } catch (e) {
          console.warn('[RingtoneService] Outgoing burst error:', e);
        }
      };

      // Play initial burst immediately
      playBurst();

      // Loop: 1.8s ring + 2.2s pause = 4.0s cycle
      this.outgoingInterval = setInterval(playBurst, 4000);
    } catch (err) {
      console.warn('[RingtoneService] Failed to start outgoing ringtone:', err);
    }
  }

  public stopOutgoingRingtone(): void {
    this.isOutgoingPlaying = false;
    if (this.outgoingInterval) {
      clearInterval(this.outgoingInterval);
      this.outgoingInterval = null;
    }

    // Instantly mute and disconnect all active outgoing gain nodes
    for (const gain of this.activeOutgoingGains) {
      try {
        gain.gain.cancelScheduledValues(0);
        gain.gain.setValueAtTime(0, 0);
        gain.disconnect();
      } catch {}
    }
    this.activeOutgoingGains = [];

    // Instantly stop and disconnect all active outgoing oscillators
    for (const osc of this.activeOutgoingOscs) {
      try {
        osc.stop(0);
        osc.disconnect();
      } catch {}
    }
    this.activeOutgoingOscs = [];

    if (this.outgoingAudioCtx) {
      try {
        this.outgoingAudioCtx.close().catch(() => {});
      } catch {}
      this.outgoingAudioCtx = null;
    }
  }

  // -----------------------------------------------------------------
  // 2. INCOMING RINGTONE (For Listener Receiving Call)
  // Pleasant modern chime melody + repeating vibration
  // -----------------------------------------------------------------
  public startIncomingRingtone(): void {
    if (this.isIncomingPlaying) return;
    this.isIncomingPlaying = true;

    // Start hardware vibration loop if supported on device
    this.startVibration();

    try {
      const AudioCtxClass = this.getAudioContext();
      if (!AudioCtxClass) return;

      this.incomingAudioCtx = new AudioCtxClass();
      if (this.incomingAudioCtx.state === 'suspended') {
        this.incomingAudioCtx.resume().catch(() => {});
      }

      // Melodic notes sequence: D5 (587Hz), F#5 (740Hz), A5 (880Hz), D6 (1175Hz), B5 (988Hz), E6 (1319Hz)
      const notes = [
        { freq: 587.33, startOffset: 0.00, duration: 0.16, gain: 0.09 },
        { freq: 739.99, startOffset: 0.20, duration: 0.16, gain: 0.09 },
        { freq: 880.00, startOffset: 0.40, duration: 0.20, gain: 0.10 },
        { freq: 1174.66, startOffset: 0.65, duration: 0.32, gain: 0.12 },
        { freq: 987.77, startOffset: 1.05, duration: 0.18, gain: 0.10 },
        { freq: 1318.51, startOffset: 1.28, duration: 0.45, gain: 0.13 },
      ];

      const playMelody = () => {
        if (!this.isIncomingPlaying || !this.incomingAudioCtx || this.incomingAudioCtx.state === 'closed') {
          return;
        }

        try {
          const ctx = this.incomingAudioCtx;
          const now = ctx.currentTime;

          notes.forEach((note) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();

            this.activeIncomingOscs.push(osc);
            this.activeIncomingGains.push(gain);

            osc.onended = () => {
              this.activeIncomingOscs = this.activeIncomingOscs.filter((o) => o !== osc);
              this.activeIncomingGains = this.activeIncomingGains.filter((g) => g !== gain);
            };

            osc.type = 'triangle'; // Richer, warmer chime sound
            osc.frequency.setValueAtTime(note.freq, now + note.startOffset);

            const noteStart = now + note.startOffset;
            const noteEnd = noteStart + note.duration;

            gain.gain.setValueAtTime(0.0001, noteStart);
            gain.gain.linearRampToValueAtTime(note.gain, noteStart + 0.02); // crisp attack
            gain.gain.exponentialRampToValueAtTime(0.0001, noteEnd); // natural acoustic decay

            osc.connect(gain);
            gain.connect(ctx.destination);

            osc.start(noteStart);
            osc.stop(noteEnd + 0.05);
          });
        } catch (e) {
          console.warn('[RingtoneService] Incoming melody error:', e);
        }
      };

      // Play initial melody immediately
      playMelody();

      // Loop: 1.8s melody + 1.2s pause = 3.0s cadence
      this.incomingInterval = setInterval(playMelody, 3000);
    } catch (err) {
      console.warn('[RingtoneService] Failed to start incoming ringtone:', err);
    }
  }

  private startVibration(): void {
    if (typeof navigator === 'undefined' || !('vibrate' in navigator)) return;

    const vibratePattern = () => {
      if (!this.isIncomingPlaying) return;
      try {
        navigator.vibrate([400, 200, 400, 1000]);
      } catch {}
    };

    vibratePattern();
    if (this.vibrationInterval) clearInterval(this.vibrationInterval);
    this.vibrationInterval = setInterval(vibratePattern, 2000);
  }

  private stopVibration(): void {
    if (this.vibrationInterval) {
      clearInterval(this.vibrationInterval);
      this.vibrationInterval = null;
    }
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate(0);
      } catch {}
    }
  }

  public stopIncomingRingtone(): void {
    this.isIncomingPlaying = false;
    this.stopVibration();

    if (this.incomingInterval) {
      clearInterval(this.incomingInterval);
      this.incomingInterval = null;
    }

    // Instantly mute and disconnect all active incoming gain nodes
    for (const gain of this.activeIncomingGains) {
      try {
        gain.gain.cancelScheduledValues(0);
        gain.gain.setValueAtTime(0, 0);
        gain.disconnect();
      } catch {}
    }
    this.activeIncomingGains = [];

    // Instantly stop and disconnect all active incoming oscillators
    for (const osc of this.activeIncomingOscs) {
      try {
        osc.stop(0);
        osc.disconnect();
      } catch {}
    }
    this.activeIncomingOscs = [];

    if (this.incomingAudioCtx) {
      try {
        this.incomingAudioCtx.close().catch(() => {});
      } catch {}
      this.incomingAudioCtx = null;
    }
  }

  // -----------------------------------------------------------------
  // 3. STOP ALL RINGTONES (Answered, Rejected, Ended, or Component Unmount)
  // -----------------------------------------------------------------
  public stopAll(): void {
    this.stopOutgoingRingtone();
    this.stopIncomingRingtone();
  }

  // HTMLAudioElement compatibility interface (pause & currentTime)
  public pause(): void {
    this.stopAll();
  }

  public get currentTime(): number {
    return 0;
  }

  public set currentTime(_val: number) {
    this.stopAll();
  }
}

export const ringtoneService = new RingtoneService();
