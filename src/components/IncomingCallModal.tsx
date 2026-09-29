import React, { useEffect, useState } from 'react';
import { Phone, PhoneOff, Video, Sparkles, Zap } from 'lucide-react';
import { useCall } from '../context/CallContext';
import { getDefaultFemaleAvatar } from '../services/staticCdnService';
import { ringtoneService } from '../services/ringtoneService';

export const IncomingCallModal: React.FC = () => {
  const { incomingCall, acceptCall, declineCall } = useCall();
  const [secondsRemaining, setSecondsRemaining] = useState<number>(30);

  // 30 seconds countdown timer
  useEffect(() => {
    if (!incomingCall) {
      setSecondsRemaining(30);
      return;
    }

    setSecondsRemaining(30);
    const interval = setInterval(() => {
      setSecondsRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          declineCall(); // Auto timeout after 30s
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [incomingCall?.id]);

  // Requirement 2: Play incoming ringtone in loop with vibrate
  // Requirement 3: Stop ringtone when call is answered, rejected, or timeout after 30s
  useEffect(() => {
    if (!incomingCall) {
      ringtoneService.stopIncomingRingtone();
      return;
    }

    ringtoneService.startIncomingRingtone();

    return () => {
      ringtoneService.stopIncomingRingtone();
    };
  }, [incomingCall?.id]);

  if (!incomingCall) return null;

  const isVideo = incomingCall.type === 'video' || incomingCall.call_type === 'video';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md p-4 animate-in fade-in">
      <div 
        className="w-full max-w-sm bg-[#13131c] border-2 border-[#ff4d8d] rounded-3xl p-6 text-center shadow-[0_0_35px_rgba(255,77,141,0.45)] relative flex flex-col items-center"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Surprise Call Badge */}
        {incomingCall.is_surprise && (
          <div className="px-3 py-1 mb-2 rounded-full bg-gradient-to-r from-[#ff4d8d] to-purple-600 text-white text-[11px] font-bold flex items-center gap-1.5 shadow-[0_0_12px_rgba(255,77,141,0.5)]">
            <Zap className="w-3.5 h-3.5 fill-amber-300 text-amber-300" />
            <span>Surprise Call</span>
          </div>
        )}

        {/* Ringing Avatar with Pulsing Rings */}
        <div className="relative my-3">
          <div className="absolute inset-0 rounded-full bg-[#ff4d8d]/30 animate-ping"></div>
          <div className="absolute -inset-3 rounded-full bg-[#ff4d8d]/20 animate-pulse"></div>
          <img
            src={
              incomingCall.caller_pic && !incomingCall.caller_pic.includes('bottts')
                ? incomingCall.caller_pic
                : getDefaultFemaleAvatar(incomingCall.caller_name)
            }
            alt={incomingCall.caller_name}
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).src = getDefaultFemaleAvatar(incomingCall.caller_name);
            }}
            className="w-24 h-24 rounded-full object-cover border-4 border-[#ff4d8d] relative z-10 shadow-lg"
          />
        </div>

        {/* Incoming Details */}
        <div className="space-y-1 my-2">
          <span className="text-xs font-bold uppercase tracking-wider text-[#ff4d8d] flex items-center justify-center gap-1.5">
            {isVideo ? <Video className="w-4 h-4" /> : <Phone className="w-4 h-4" />}
            Incoming {isVideo ? 'Video' : 'Audio'} Call
          </span>
          <h3 className="text-2xl font-black text-white">{incomingCall.caller_name}</h3>
          <p className="text-xs text-zinc-400">
            Earn <span className="text-amber-300 font-bold">{Math.floor(incomingCall.rate_per_min / 10)} Diamonds</span> / min
          </p>

          {/* 30s Countdown timer indicator */}
          <div className="pt-2">
            <span className="inline-block px-2.5 py-0.5 rounded-full bg-zinc-800 border border-zinc-700 text-[11px] text-zinc-300">
              Auto-declines in <strong className="text-white">{secondsRemaining}s</strong>
            </span>
          </div>
        </div>

        {/* Call Controls: Accept / Decline */}
        <div className="grid grid-cols-2 gap-4 w-full mt-5">
          <button
            onClick={declineCall}
            className="py-3.5 px-4 rounded-2xl bg-red-500/20 hover:bg-red-500/30 border border-red-500/50 text-red-400 font-bold text-sm flex items-center justify-center gap-2 transition active:scale-95 cursor-pointer"
          >
            <PhoneOff className="w-4 h-4" />
            Decline
          </button>

          <button
            onClick={acceptCall}
            className="py-3.5 px-4 rounded-2xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(16,185,129,0.5)] transition active:scale-95 cursor-pointer"
          >
            <Phone className="w-4 h-4" />
            Accept
          </button>
        </div>
      </div>
    </div>
  );
};
