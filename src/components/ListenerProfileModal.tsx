import React from 'react';
import { X, Heart, Phone, Video, MapPin, Globe, Sparkles, ShieldCheck, MessageCircle } from 'lucide-react';
import { UserProfile } from '../types';
import { useTranslation, SupportedLanguage, getLanguageInfo } from '../utils/i18n';
import { useAuth } from '../context/AuthContext';
import { getStaticCdnUrl, getUserAvatarUrl } from '../services/staticCdnService';
import { isListenerOffline, getListenerPresence } from '../utils/presence';

interface ListenerProfileModalProps {
  user: UserProfile | null;
  isFavorited: boolean;
  onToggleFavorite: (id: string) => void;
  onVoiceCall: (user: UserProfile) => void;
  onVideoCall: (user: UserProfile) => void;
  onOpenChat?: (user: UserProfile) => void;
  onClose: () => void;
}

export const ListenerProfileModal: React.FC<ListenerProfileModalProps> = ({
  user,
  isFavorited,
  onToggleFavorite,
  onVoiceCall,
  onVideoCall,
  onOpenChat,
  onClose,
}) => {
  const { currentUser } = useAuth();
  const lang = (currentUser?.language?.toUpperCase() || 'EN') as SupportedLanguage;
  const { t } = useTranslation(lang);

  if (!user) return null;

  const isOffline = isListenerOffline(user);
  const presence = getListenerPresence(user);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm p-0 sm:p-4 animate-in fade-in">
      <div 
        className="w-full max-w-md bg-[#16161C] border-t sm:border border-[#2A2A36] rounded-t-3xl sm:rounded-3xl max-h-[92vh] overflow-y-auto shadow-2xl relative flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Photo Container */}
        <div className="relative h-80 w-full bg-zinc-900">
          <img
            src={getUserAvatarUrl(user)}
            alt={user.name}
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).src = 'https://randomuser.me/api/portraits/women/11.jpg';
            }}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#16161C] via-[#16161C]/20 to-black/50"></div>

          {/* Top buttons */}
          <div className="absolute top-4 left-4 right-4 flex items-center justify-between z-10">
            <button
              onClick={onClose}
              className="p-2 rounded-full bg-black/60 text-white hover:bg-black/80 backdrop-blur-md transition"
            >
              <X className="w-5 h-5" />
            </button>

            <button
              onClick={() => onToggleFavorite(user.uid)}
              className={`p-2 rounded-full backdrop-blur-md transition ${
                isFavorited
                  ? 'bg-[#FF69B4] text-white shadow-[0_0_15px_#FF69B4]'
                  : 'bg-black/60 text-white hover:bg-black/80'
              }`}
            >
              <Heart className={`w-5 h-5 ${isFavorited ? 'fill-white' : ''}`} />
            </button>
          </div>

          {/* Name and Status over bottom of photo */}
          <div className="absolute bottom-4 left-4 right-4 z-10">
            <div className="flex items-center gap-2">
              <h2 className="text-2xl font-black text-white">{user.name}, {user.age}</h2>
              <span className="p-1 rounded-full bg-[#FF69B4]/20 text-[#FF69B4]">
                <ShieldCheck className="w-4 h-4" />
              </span>
            </div>
            <div className="flex items-center gap-3 text-xs text-zinc-300 mt-1">
              <span className="flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-[#FF69B4]" />
                {user.location}
              </span>
              {isOffline ? (
                <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-black/60 border border-zinc-700/80 text-zinc-400 font-semibold text-xs backdrop-blur-md">
                  <span className="w-2 h-2 rounded-full bg-zinc-500"></span>
                  {t('offline').toUpperCase()}
                </span>
              ) : presence === 'busy' ? (
                <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-400 font-semibold text-xs backdrop-blur-md">
                  <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                  {t('busy').toUpperCase()}
                </span>
              ) : (
                <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 font-semibold text-xs backdrop-blur-md">
                  <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                  {t('online').toUpperCase()}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-5 space-y-5 flex-1">
          {/* About Bio */}
          <div>
            <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2">About Me</h4>
            <p className="text-sm text-zinc-200 leading-relaxed bg-[#0B0B0E] p-3.5 rounded-2xl border border-[#23232C]">
              {user.bio}
            </p>
          </div>

          {/* Rates Banner */}
          <div>
            <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2">Call Rates</h4>
            <div className={`grid ${user.allowVideoCalls !== false ? 'grid-cols-2' : 'grid-cols-1'} gap-3`}>
              <div className="p-3 bg-[#0B0B0E] border border-zinc-800 rounded-2xl flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400">
                    <Phone className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs text-zinc-400 font-medium">Voice Call</div>
                    <div className="text-xs text-emerald-400 font-semibold">Crystal Audio</div>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-base font-black text-amber-300">{user.voice_rate || user.audio_rate_coins || 10}</span>
                  <span className="text-[10px] text-zinc-500 block">coins/min</span>
                </div>
              </div>

              {user.allowVideoCalls !== false && (
                <div className="p-3 bg-[#0B0B0E] border border-zinc-800 rounded-2xl flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded-xl bg-[#FF69B4]/20 text-[#FF69B4]">
                      <Video className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs text-zinc-400 font-medium">Video Call</div>
                      <div className="text-xs text-[#FF69B4] font-semibold">HD Quality</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-base font-black text-amber-300">{user.video_rate || user.video_rate_coins || 50}</span>
                    <span className="text-[10px] text-zinc-500 block">coins/min</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Spoken Language */}
          <div>
            <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2">Spoken Language</h4>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-2xl bg-purple-500/15 border border-purple-500/30 text-purple-300 text-xs font-semibold">
              <Globe className="w-3.5 h-3.5 text-purple-400" />
              <span>{getLanguageInfo(user.language).label}</span>
              <span className="text-[11px] text-purple-400/80">({getLanguageInfo(user.language).native})</span>
            </div>
          </div>

          {/* Interests */}
          {user.interests && user.interests.length > 0 && (
            <div>
              <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2">Interests & Topics</h4>
              <div className="flex flex-wrap gap-2">
                {user.interests.map((interest, i) => (
                  <span
                    key={i}
                    className="px-3 py-1.5 rounded-full text-xs font-medium bg-[#202028] text-zinc-200 border border-[#2C2C38]"
                  >
                    #{interest}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Community Safety Notice */}
          <div className="p-3 rounded-2xl bg-[#FF69B4]/5 border border-[#FF69B4]/20 flex items-start gap-3">
            <Sparkles className="w-4 h-4 text-[#FF69B4] shrink-0 mt-0.5" />
            <p className="text-[11px] text-zinc-400 leading-relaxed">
              All calls are 1-on-1 private and encrypted. Respectful behavior is strictly enforced. Any harassment results in immediate permanent ban.
            </p>
          </div>
        </div>

        {/* Bottom Sticky Action Bar */}
        <div className={`p-4 bg-[#0B0B0E] border-t border-[#23232C] grid ${user.allowVideoCalls !== false ? 'grid-cols-2' : 'grid-cols-1'} gap-3 sticky bottom-0`}>
          {isOffline && (
            <div className={`${user.allowVideoCalls !== false ? 'col-span-2' : 'col-span-1'} text-center text-xs text-zinc-400 pb-1 flex items-center justify-center gap-1.5 bg-zinc-900/60 py-2 rounded-xl border border-zinc-800`}>
              <span className="w-2 h-2 rounded-full bg-zinc-500"></span>
              <span>{user.name} is currently offline and unavailable for calls</span>
            </div>
          )}

          {onOpenChat && (
            <button
              onClick={() => {
                onClose();
                onOpenChat(user);
              }}
              className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-bold text-sm transition bg-[#1E1E28] hover:bg-[#282836] text-white border border-[#303042] active:scale-95 cursor-pointer shadow-md"
            >
              <MessageCircle className="w-4 h-4 text-[#FF69B4]" />
              <span>Chat</span>
            </button>
          )}

          <button
            onClick={() => {
              if (isOffline) return;
              onClose();
              onVoiceCall(user);
            }}
            disabled={isOffline}
            className={`flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-bold text-sm transition shadow-md active:scale-95 cursor-pointer ${
              isOffline
                ? 'bg-zinc-800/60 text-zinc-500 border border-zinc-800 cursor-not-allowed'
                : 'bg-emerald-500 hover:bg-emerald-600 text-white'
            }`}
          >
            <Phone className="w-4 h-4" />
            {isOffline ? t('offline') : t('voiceCall')}
          </button>

          {user.allowVideoCalls !== false && (
            <button
              onClick={() => {
                if (isOffline) return;
                onClose();
                onVideoCall(user);
              }}
              disabled={isOffline}
              className={`flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-bold text-sm transition active:scale-95 cursor-pointer ${
                isOffline
                  ? 'bg-zinc-800/60 text-zinc-500 border border-zinc-800 cursor-not-allowed'
                  : 'bg-gradient-to-r from-[#FF69B4] to-pink-600 hover:opacity-95 text-white shadow-[0_0_15px_rgba(255,105,180,0.5)]'
              }`}
            >
              <Video className="w-4 h-4" />
              {isOffline ? t('offline') : t('videoCall')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
