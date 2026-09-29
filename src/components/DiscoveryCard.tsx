import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Phone, Video, Heart, MapPin, MoreVertical, Ban, Flag, Coins, X } from 'lucide-react';
import { UserProfile } from '../types';
import { getUserAvatarUrl } from '../services/staticCdnService';
import { getConsistentListenerAvatar } from '../data/listenerAvatars';
import { isListenerOffline, getListenerPresence } from '../utils/presence';

interface DiscoveryCardProps {
  user: UserProfile;
  isFavorited: boolean;
  distanceKm?: number;
  onToggleFavorite: (targetUserId: string) => void;
  onVoiceCall: (user: UserProfile) => void;
  onVideoCall: (user: UserProfile) => void;
  onOpenProfile: (user: UserProfile) => void;
  onBlockUser: (user: UserProfile) => void;
  onOpenReportBlock?: (user: UserProfile) => void;
}

export const DiscoveryCard: React.FC<DiscoveryCardProps> = ({
  user,
  isFavorited,
  distanceKm,
  onToggleFavorite,
  onVoiceCall,
  onVideoCall,
  onOpenProfile,
  onBlockUser,
  onOpenReportBlock,
}) => {
  const [imgLoaded, setImgLoaded] = useState(false);
  const [heartAnimating, setHeartAnimating] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [showBlockConfirm, setShowBlockConfirm] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const toastTimerRef = useRef<any>(null);

  const isOffline = isListenerOffline(user);
  const presence = getListenerPresence(user);
  const isBusy = Boolean(user.in_call === true || presence === 'busy' || (user as any).status === 'busy');

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  }, []);

  const handleHeartClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setHeartAnimating(true);
    setTimeout(() => setHeartAnimating(false), 400);
    onToggleFavorite(user.uid);
  };

  // Wait time calculation: (call_started_at + average_duration) - now, round to nearest 5 mins, minimum 5 mins
  const waitTimeMinutes = useMemo(() => {
    let startedAtMs: number | null = null;
    if (user.call_started_at) {
      if (typeof user.call_started_at.toMillis === 'function') {
        startedAtMs = user.call_started_at.toMillis();
      } else if (typeof user.call_started_at.seconds === 'number') {
        startedAtMs = user.call_started_at.seconds * 1000;
      } else if (user.call_started_at instanceof Date) {
        startedAtMs = user.call_started_at.getTime();
      } else if (typeof user.call_started_at === 'number') {
        startedAtMs = user.call_started_at;
      } else if (typeof user.call_started_at === 'string') {
        const parsed = new Date(user.call_started_at).getTime();
        if (!isNaN(parsed)) startedAtMs = parsed;
      }
    }

    // Default average duration 15 minutes unless specified
    let avgDurationMs = 15 * 60 * 1000;
    if (user.average_duration && typeof user.average_duration === 'number') {
      avgDurationMs = user.average_duration > 1000 ? user.average_duration : user.average_duration * 60 * 1000;
    }

    const now = Date.now();
    let remainingMs: number;

    if (startedAtMs && !isNaN(startedAtMs)) {
      remainingMs = (startedAtMs + avgDurationMs) - now;
    } else {
      // Deterministic remaining offset based on uid hash if not set yet
      const hash = (user.uid || '').split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
      const elapsedMins = (hash % 10) + 2; // 2 to 11 minutes elapsed
      remainingMs = avgDurationMs - (elapsedMins * 60 * 1000);
    }

    const remainingMinutes = remainingMs / (60 * 1000);
    let rounded = Math.round(remainingMinutes / 5) * 5;
    if (isNaN(rounded) || rounded < 5) {
      rounded = 5;
    }
    return rounded;
  }, [user.call_started_at, user.average_duration, user.uid]);

  // Handle tap on busy button -> show toast "Listener is busy, please wait"
  const handleBusyTap = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowToast(true);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => {
      setShowToast(false);
    }, 2200);
  };

  // Real or calculated distance for UI badge
  const displayDistance = useMemo(() => {
    if (distanceKm != null && !isNaN(distanceKm)) {
      return distanceKm;
    }
    const hash = (user.uid || '').split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return Math.round(15 + (hash % 185));
  }, [distanceKm, user.uid]);

  const allowVideo = user.allowVideoCalls !== false;
  const audioCoins = user.audio_rate_coins ?? user.voice_rate ?? 10;
  const videoCoins = user.video_rate_coins ?? user.video_rate ?? 50;

  return (
    <div className="bg-[#161622] border border-[#232334] hover:border-[#ff4d8d]/50 hover:shadow-[0_4px_20px_rgba(255,77,141,0.2)] rounded-2xl p-3.5 transition-all duration-200 flex flex-col gap-3 relative">
      {/* Toast Notification when busy button is tapped */}
      {showToast && (
        <div className="absolute top-2 left-1/2 -translate-x-1/2 z-40 px-3.5 py-1.5 rounded-full bg-zinc-900/95 border border-orange-500/60 text-orange-400 text-xs font-bold shadow-[0_4px_20px_rgba(249,115,22,0.4)] flex items-center gap-1.5 animate-in fade-in zoom-in-95 pointer-events-none whitespace-nowrap">
          <span className="w-1.5 h-1.5 rounded-full bg-orange-400 animate-pulse"></span>
          Listener is busy, please wait
        </div>
      )}

      {/* Top Section: Photo Left, Info & Actions Right */}
      <div className="flex items-start gap-3.5 cursor-pointer" onClick={() => onOpenProfile(user)}>
        {/* Profile Photo on Left */}
        <div className="relative w-24 h-24 sm:w-28 sm:h-28 rounded-2xl overflow-hidden shrink-0 bg-zinc-900 border border-zinc-800">
          <img
            src={getUserAvatarUrl(user)}
            alt={user.name}
            onLoad={() => setImgLoaded(true)}
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).src = getConsistentListenerAvatar(user.uid || user.name);
              setImgLoaded(true);
            }}
            className={`w-full h-full object-cover transition-opacity duration-300 ${
              imgLoaded ? 'opacity-100' : 'opacity-0'
            } ${isOffline ? 'grayscale-[30%] brightness-90' : ''}`}
          />

          {/* Online/Busy/Offline indicator dot */}
          <div className="absolute bottom-1.5 right-1.5 flex items-center justify-center">
            {isOffline ? (
              <span className="w-3.5 h-3.5 rounded-full bg-zinc-500 border-2 border-[#161622]" title="Offline"></span>
            ) : isBusy ? (
              <span className="w-3.5 h-3.5 rounded-full bg-orange-400 border-2 border-[#161622]" title="On Call"></span>
            ) : (
              <span className="relative flex h-3.5 w-3.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-emerald-500 border-2 border-[#161622]" title="Online"></span>
              </span>
            )}
          </div>
        </div>

        {/* Info Column & Header Actions */}
        <div className="flex-1 min-w-0 flex flex-col justify-between self-stretch">
          {/* Card Header: Name/Age + Online/On Call badge on left, 3-dot and Heart Button on right */}
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <h3 className="text-base font-bold text-white truncate tracking-tight hover:text-[#ff4d8d] transition">
                  {user.name}, {user.age}
                </h3>

                {/* Keep Online green badge and On Call orange badge near name as before */}
                {isBusy ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-orange-500/15 border border-orange-500/40 text-orange-400 shrink-0">
                    <span className="w-1.5 h-1.5 rounded-full bg-orange-400 animate-pulse"></span>
                    On Call
                  </span>
                ) : !isOffline ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 border border-emerald-500/40 text-emerald-400 shrink-0">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                    Online
                  </span>
                ) : null}
              </div>

              {/* Location & distance */}
              <div className="flex items-center gap-1.5 text-[11px] text-zinc-400 mt-0.5 truncate">
                <MapPin className="w-3 h-3 text-[#ff4d8d] shrink-0" />
                <span className="truncate">{user.city || user.location || 'Chennai, Tamil Nadu'}</span>
                <span className="inline-flex items-center px-1.5 py-0.2 rounded-md bg-[#252538] text-zinc-300 text-[10px] font-semibold shrink-0">
                  {displayDistance} km away
                </span>
              </div>
            </div>

            {/* Top-right Actions: 3-dot menu and Favourite Heart */}
            <div className="flex items-center gap-0.5 shrink-0">
              {/* 3-dot vertical icon (⋮) placed at top-right corner next to favourite heart */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowMenu(true);
                }}
                className="p-1.5 rounded-full text-zinc-400 hover:text-white hover:bg-zinc-800 transition cursor-pointer active:scale-95"
                title="Options"
                aria-label="Options"
              >
                <MoreVertical className="w-4 h-4" />
              </button>

              {/* Favourite Heart Icon Button */}
              <button
                type="button"
                onClick={handleHeartClick}
                className={`p-1.5 rounded-full transition-transform duration-200 cursor-pointer ${
                  heartAnimating ? 'scale-125' : 'scale-100 hover:scale-110'
                }`}
                title={isFavorited ? 'Remove from Favourites' : 'Add to Favourites'}
              >
                {isFavorited ? (
                  <Heart className="w-5 h-5 fill-[#ff4d8d] text-[#ff4d8d] drop-shadow-[0_0_8px_#ff4d8d]" />
                ) : (
                  <Heart className="w-5 h-5 text-zinc-500 hover:text-[#ff4d8d]" />
                )}
              </button>
            </div>
          </div>

          {/* Tags */}
          <div className="flex flex-wrap gap-1 mt-1.5">
            {(user.interests || ['Friendly Chats', 'Music']).slice(0, 2).map((tag, idx) => (
              <span
                key={idx}
                className="px-2 py-0.5 rounded-lg bg-[#202030] text-zinc-300 text-[10px] font-medium"
              >
                {tag}
              </span>
            ))}
            {user.language && (
              <span className="px-2 py-0.5 rounded-lg bg-[#202030] text-zinc-400 text-[10px] font-medium uppercase">
                {user.language}
              </span>
            )}
          </div>

          {/* Rates: audio rate, and video rate only if allowed */}
          <div className="flex items-center gap-1.5 text-[11px] text-zinc-400 mt-1 flex-wrap">
            <span className="inline-flex items-center gap-1 font-medium text-zinc-300">
              <Coins className="w-3.5 h-3.5 text-amber-400 fill-amber-400/80 shrink-0" />
              <span className="font-semibold text-white">{audioCoins}</span> coins/m Audio
            </span>
            {allowVideo && (
              <>
                <span className="text-zinc-600">•</span>
                <span className="inline-flex items-center gap-1 font-medium text-zinc-300">
                  <Coins className="w-3.5 h-3.5 text-amber-400 fill-amber-400/80 shrink-0" />
                  <span className="font-semibold text-white">{videoCoins}</span> coins/m Video
                </span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Under each profile:
          For busy listeners (in_call = true): single full-width button with "On call, wait time ~ X minutes"
          For audio-only listeners (allowVideoCalls = false): single full-width button for Audio Call (Video Call button completely hidden)
          For regular listeners: Audio Call + Video Call buttons
      */}
      <div className="pt-1 border-t border-zinc-800/80">
        {isBusy ? (
          <button
            type="button"
            onClick={handleBusyTap}
            className="w-full py-2.5 px-4 rounded-xl bg-[#14141e] border border-zinc-700/60 text-orange-400 hover:border-zinc-600 active:scale-[0.99] font-semibold text-xs flex items-center justify-center gap-2 transition cursor-pointer select-none shadow-inner"
            title="Listener is on a call"
          >
            <span>On call, wait time ~ {waitTimeMinutes} minutes</span>
          </button>
        ) : !allowVideo ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onVoiceCall(user);
            }}
            className="w-full py-2.5 px-3 rounded-xl border border-[#ff4d8d] bg-[#ff4d8d]/10 hover:bg-[#ff4d8d]/20 text-[#ff4d8d] active:scale-[0.98] font-bold text-xs flex items-center justify-center gap-2 transition cursor-pointer shadow-sm"
          >
            <Phone className="w-3.5 h-3.5" />
            <span>Audio Call</span>
          </button>
        ) : (
          <div className="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onVoiceCall(user);
              }}
              className="py-2 px-3 rounded-xl border border-[#ff4d8d] text-[#ff4d8d] hover:bg-[#ff4d8d]/15 active:scale-[0.98] font-semibold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer"
            >
              <Phone className="w-3.5 h-3.5" />
              <span>Audio Call</span>
            </button>

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onVideoCall(user);
              }}
              className="py-2 px-3 rounded-xl border border-[#ff4d8d] text-[#ff4d8d] hover:bg-[#ff4d8d]/15 active:scale-[0.98] font-semibold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer"
            >
              <Video className="w-3.5 h-3.5" />
              <span>Video Call</span>
            </button>
          </div>
        )}
      </div>

      {/* 3-Dot Options Bottom Sheet / Popup Menu */}
      {showMenu && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/75 backdrop-blur-xs p-4 animate-in fade-in"
          onClick={(e) => {
            e.stopPropagation();
            setShowMenu(false);
          }}
        >
          <div
            className="w-full max-w-sm bg-[#161622] border border-[#2e2e42] rounded-3xl p-4 shadow-2xl flex flex-col gap-1 text-left"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header with user name */}
            <div className="px-3 py-2 border-b border-zinc-800/80 mb-1 flex items-center justify-between">
              <span className="text-xs font-bold text-zinc-400 truncate">{user.name}</span>
              <button
                type="button"
                onClick={() => setShowMenu(false)}
                className="text-zinc-500 hover:text-zinc-300 p-1 rounded-full cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Block User (with block icon, red text) */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setShowMenu(false);
                setShowBlockConfirm(true);
              }}
              className="w-full py-3 px-3.5 rounded-2xl flex items-center gap-3 text-red-500 hover:bg-red-500/10 active:scale-[0.99] font-bold text-sm transition cursor-pointer"
            >
              <div className="w-8 h-8 rounded-full bg-red-500/15 flex items-center justify-center text-red-500 shrink-0">
                <Ban className="w-4 h-4" />
              </div>
              <span>Block User</span>
            </button>

            {/* Report User (with flag icon, red text) */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setShowMenu(false);
                if (onOpenReportBlock) {
                  onOpenReportBlock(user);
                }
              }}
              className="w-full py-3 px-3.5 rounded-2xl flex items-center gap-3 text-red-500 hover:bg-red-500/10 active:scale-[0.99] font-bold text-sm transition cursor-pointer"
            >
              <div className="w-8 h-8 rounded-full bg-red-500/15 flex items-center justify-center text-red-500 shrink-0">
                <Flag className="w-4 h-4" />
              </div>
              <span>Report User</span>
            </button>

            {/* Cancel */}
            <div className="pt-1 mt-1 border-t border-zinc-800/80">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowMenu(false);
                }}
                className="w-full py-2.5 px-3.5 rounded-2xl text-center text-zinc-300 hover:bg-zinc-800/80 active:scale-[0.99] font-semibold text-sm transition cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Block User Confirmation Popup */}
      {showBlockConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4 animate-in fade-in"
          onClick={(e) => {
            e.stopPropagation();
            setShowBlockConfirm(false);
          }}
        >
          <div
            className="w-full max-w-sm bg-[#161622] border border-red-500/30 rounded-3xl p-6 text-center shadow-2xl relative flex flex-col items-center"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-12 h-12 rounded-full bg-red-500/15 border border-red-500/30 flex items-center justify-center text-red-400 mb-3">
              <Ban className="w-6 h-6" />
            </div>

            <h3 className="text-lg font-black text-white">Block User</h3>
            <p className="text-sm text-zinc-300 mt-2">
              Are you sure you want to block <strong className="text-white">{user.name}</strong>?
            </p>
            <p className="text-xs text-zinc-500 mt-1 max-w-xs">
              They will no longer appear in your discover list and cannot call you.
            </p>

            {/* Buttons: [Cancel / Block] */}
            <div className="grid grid-cols-2 gap-3 w-full mt-6">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowBlockConfirm(false);
                }}
                className="py-3 px-4 rounded-2xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-bold text-xs active:scale-95 transition cursor-pointer"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowBlockConfirm(false);
                  onBlockUser(user);
                }}
                className="py-3 px-4 rounded-2xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs shadow-[0_0_15px_rgba(239,68,68,0.4)] active:scale-95 transition cursor-pointer"
              >
                Block
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
