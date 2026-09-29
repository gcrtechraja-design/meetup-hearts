import React, { useEffect, useState } from 'react';
import { PhoneOff, Video, Phone, Sparkles } from 'lucide-react';
import { useCall } from '../context/CallContext';
import { useAuth } from '../context/AuthContext';
import { getDefaultFemaleAvatar } from '../services/staticCdnService';

export const OutgoingCallModal: React.FC = () => {
  const { activeCall, endCall } = useCall();
  const { currentUser } = useAuth();
  const [secondsElapsed, setSecondsElapsed] = useState<number>(0);

  const isCaller = activeCall?.caller_id === currentUser?.uid;
  const isRinging = activeCall?.status === 'ringing';

  // 30 seconds countdown / elapsed timer
  useEffect(() => {
    if (!isRinging || !isCaller) {
      setSecondsElapsed(0);
      return;
    }

    setSecondsElapsed(0);
    const interval = setInterval(() => {
      setSecondsElapsed((prev) => {
        if (prev >= 30) {
          clearInterval(interval);
          endCall(); // Auto timeout after 30s
          return 30;
        }
        return prev + 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [activeCall?.id, isRinging, isCaller, endCall]);

  // Only show when the current user is the caller, call status is 'ringing', and not a surprise call (which has its own modal)
  if (!activeCall || !isCaller || !isRinging || activeCall.is_surprise) {
    return null;
  }

  const isVideo = activeCall.type === 'video' || activeCall.call_type === 'video';
  const partnerName = activeCall.receiver_name || 'Listener';
  const partnerPic = activeCall.receiver_pic || getDefaultFemaleAvatar(partnerName);
  const remainingSeconds = Math.max(0, 30 - secondsElapsed);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md p-4 animate-in fade-in">
      <div 
        className="w-full max-w-sm bg-[#13131c] border-2 border-[#ff4d8d] rounded-3xl p-6 text-center shadow-[0_0_35px_rgba(255,77,141,0.45)] relative flex flex-col items-center"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Outgoing Call Badge */}
        <div className="px-3 py-1 mb-2 rounded-full bg-gradient-to-r from-[#ff4d8d] to-purple-600 text-white text-[11px] font-bold flex items-center gap-1.5 shadow-[0_0_12px_rgba(255,77,141,0.5)]">
          {isVideo ? <Video className="w-3.5 h-3.5 text-white" /> : <Phone className="w-3.5 h-3.5 text-white" />}
          <span>Outgoing {isVideo ? 'Video' : 'Voice'} Call</span>
        </div>

        {/* Ringing Avatar with Pulsing Rings */}
        <div className="relative my-4">
          <div className="absolute inset-0 rounded-full bg-[#ff4d8d]/30 animate-ping"></div>
          <div className="absolute -inset-3 rounded-full bg-[#ff4d8d]/20 animate-pulse"></div>
          <img
            src={partnerPic}
            alt={partnerName}
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).src = getDefaultFemaleAvatar(partnerName);
            }}
            className="w-24 h-24 rounded-full object-cover border-4 border-[#ff4d8d] relative z-10 shadow-lg"
          />
        </div>

        {/* Details */}
        <div className="space-y-1 my-2">
          <h3 className="text-2xl font-black text-white">{partnerName}</h3>
          
          <div className="flex items-center justify-center gap-2 pt-1 text-sm font-semibold text-emerald-400">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            <span>Ringing...</span>
          </div>

          <p className="text-xs text-zinc-400 pt-1">
            Rate: <strong className="text-amber-300 font-bold">{activeCall.rate_per_min || 20} Coins</strong> / min
          </p>

          {/* 30s Countdown timer indicator */}
          <div className="pt-2">
            <span className="inline-block px-3 py-1 rounded-full bg-zinc-800 border border-zinc-700 text-[11px] text-zinc-300">
              Waiting for answer... (<strong className="text-white">{remainingSeconds}s</strong>)
            </span>
          </div>
        </div>

        {/* Cancel Call Button */}
        <div className="w-full mt-6">
          <button
            onClick={endCall}
            className="w-full py-3.5 px-4 rounded-2xl bg-red-500/20 hover:bg-red-500/30 border border-red-500/50 text-red-400 font-bold text-sm flex items-center justify-center gap-2 transition active:scale-95 cursor-pointer shadow-lg"
          >
            <PhoneOff className="w-4 h-4" />
            Cancel Call
          </button>
        </div>
      </div>
    </div>
  );
};
