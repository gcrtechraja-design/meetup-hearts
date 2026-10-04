import React, { useEffect, useState } from 'react';
import { Clock, Heart, Phone, Video, Coins, ArrowUpRight, ArrowDownLeft, Calendar, MessageCircle } from 'lucide-react';
import { collection, query, where, getDocs, orderBy, doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../context/AuthContext';
import { CallLog, UserProfile } from '../types';
import { useTranslation, SupportedLanguage } from '../utils/i18n';
import { getUserAvatarUrl, getDefaultFemaleAvatar } from '../services/staticCdnService';

interface RecentsViewProps {
  onVoiceCall: (user: UserProfile) => void;
  onVideoCall: (user: UserProfile) => void;
  onOpenProfile: (user: UserProfile) => void;
  onOpenChat?: (user: UserProfile) => void;
}

export const RecentsView: React.FC<RecentsViewProps> = ({
  onVoiceCall,
  onVideoCall,
  onOpenProfile,
  onOpenChat,
}) => {
  const { currentUser } = useAuth();
  const lang = (currentUser?.language?.toUpperCase() || 'EN') as SupportedLanguage;
  const { t } = useTranslation(lang);

  const [activeTab, setActiveTab] = useState<'calls' | 'favourites'>('calls');
  const [callFilter, setCallFilter] = useState<'all' | 'today' | 'yesterday'>('all');
  const [callLogs, setCallLogs] = useState<CallLog[]>([]);
  const [favouriteUsers, setFavouriteUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch Call Logs and Bookmarks from Firestore
  useEffect(() => {
    if (!currentUser?.uid) {
      setLoading(false);
      return;
    }

    const fetchData = async () => {
      setLoading(true);
      try {
        // 1. Fetch Call Logs where current user is caller or receiver
        const logsRef = collection(db, 'call_logs');
        const qCaller = query(logsRef, where('caller_id', '==', currentUser.uid));
        const qReceiver = query(logsRef, where('receiver_id', '==', currentUser.uid));

        const [callerSnap, receiverSnap] = await Promise.all([
          getDocs(qCaller),
          getDocs(qReceiver),
        ]);

        const allLogs: CallLog[] = [];
        callerSnap.forEach((d) => allLogs.push({ id: d.id, ...d.data() } as CallLog));
        receiverSnap.forEach((d) => allLogs.push({ id: d.id, ...d.data() } as CallLog));

        // Sort descending by started_at
        allLogs.sort((a, b) => {
          const tA = a.started_at?.toMillis ? a.started_at.toMillis() : (a.started_at ? new Date(a.started_at).getTime() : 0);
          const tB = b.started_at?.toMillis ? b.started_at.toMillis() : (b.started_at ? new Date(b.started_at).getTime() : 0);
          return tB - tA;
        });
        setCallLogs(allLogs);

        // 2. Fetch Favourites from user_favourites (and bookmarks)
        const favsRef = collection(db, 'user_favourites');
        const fq = query(favsRef, where('user_id', '==', currentUser.uid));
        const [favSnap, bookmarkSnap] = await Promise.all([
          getDocs(fq),
          getDocs(query(collection(db, 'bookmarks'), where('user_id', '==', currentUser.uid))).catch(() => ({ docs: [] } as any)),
        ]);

        const favIds = Array.from(new Set([
          ...favSnap.docs.map((d: any) => d.data().favorited_user_id),
          ...bookmarkSnap.docs.map((d: any) => d.data().favorited_user_id),
        ])).filter(Boolean);
        if (favIds.length > 0) {
          const userPromises = favIds.map((uid) => getDoc(doc(db, 'users', uid)));
          const userSnaps = await Promise.all(userPromises);
          const favUsers = userSnaps
            .filter((s) => s.exists())
            .map((s) => ({ uid: s.id, ...s.data() } as UserProfile));
          setFavouriteUsers(favUsers);
        } else {
          setFavouriteUsers([]);
        }
      } catch (err) {
        console.error('Error loading recents:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [currentUser]);

  // Filter logs by Today / Yesterday / All
  const filteredLogs = callLogs.filter((log) => {
    if (callFilter === 'all') return true;
    const logDate = log.started_at?.toDate ? log.started_at.toDate() : new Date(log.started_at || Date.now());
    const now = new Date();
    const isToday = logDate.toDateString() === now.toDateString();
    if (callFilter === 'today') return isToday;
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    const isYesterday = logDate.toDateString() === yesterday.toDateString();
    return isYesterday;
  });

  const formatDuration = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const remainder = secs % 60;
    return `${mins}m ${remainder}s`;
  };

  const handleCallBack = async (partnerId: string, type: 'voice' | 'video') => {
    try {
      const snap = await getDoc(doc(db, 'users', partnerId));
      if (snap.exists()) {
        const target = { uid: snap.id, ...snap.data() } as UserProfile;
        if (type === 'voice') onVoiceCall(target);
        else onVideoCall(target);
      }
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="space-y-4 pb-24">
      {/* Top Header & Tabs */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-black text-white flex items-center gap-2">
          <Clock className="w-5 h-5 text-[#FF69B4]" />
          Recents & Saved
        </h2>
      </div>

      {/* Main Switcher: Calls vs Favourites */}
      <div className="grid grid-cols-2 p-1 bg-[#16161C] rounded-2xl border border-[#23232C]">
        <button
          onClick={() => setActiveTab('calls')}
          className={`py-2 text-xs font-bold rounded-xl transition flex items-center justify-center gap-2 ${
            activeTab === 'calls'
              ? 'bg-[#FF69B4] text-white shadow-[0_0_10px_rgba(255,105,180,0.5)]'
              : 'text-zinc-400 hover:text-white'
          }`}
        >
          <Clock className="w-4 h-4" />
          Call History ({callLogs.length})
        </button>

        <button
          onClick={() => setActiveTab('favourites')}
          className={`py-2 text-xs font-bold rounded-xl transition flex items-center justify-center gap-2 ${
            activeTab === 'favourites'
              ? 'bg-[#FF69B4] text-white shadow-[0_0_10px_rgba(255,105,180,0.5)]'
              : 'text-zinc-400 hover:text-white'
          }`}
        >
          <Heart className="w-4 h-4" />
          {t('favourites')} ({favouriteUsers.length})
        </button>
      </div>

      {/* Tab 1: Calls */}
      {activeTab === 'calls' && (
        <div className="space-y-3">
          {/* Subfilter: All / Today / Yesterday */}
          <div className="flex items-center gap-2">
            {(['all', 'today', 'yesterday'] as const).map((filter) => (
              <button
                key={filter}
                onClick={() => setCallFilter(filter)}
                className={`px-3 py-1 rounded-full text-xs font-semibold capitalize transition ${
                  callFilter === filter
                    ? 'bg-[#2A2A36] text-[#FF69B4] border border-[#FF69B4]/40'
                    : 'bg-[#16161C] text-zinc-400 border border-[#23232C]'
                }`}
              >
                {filter === 'all' ? t('allCalls') : filter === 'today' ? t('today') : t('yesterday')}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="py-12 text-center text-zinc-500 text-xs">Loading call records...</div>
          ) : filteredLogs.length === 0 ? (
            <div className="py-16 text-center bg-[#16161C] rounded-2xl border border-[#23232C] p-6 space-y-2">
              <Clock className="w-10 h-10 text-zinc-600 mx-auto" />
              <p className="text-white font-bold text-sm">No recent calls found</p>
              <p className="text-xs text-zinc-500">
                Connect with any listener from the Home discovery feed to start a conversation.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredLogs.map((log) => {
                const isOutgoing = log.caller_id === currentUser?.uid;
                const partnerName = isOutgoing ? (log.receiver_name || 'Listener') : (log.caller_name || 'Caller');
                const partnerPic = isOutgoing ? log.receiver_pic : log.caller_pic;
                const partnerId = isOutgoing ? log.receiver_id : log.caller_id;

                return (
                  <div
                    key={log.id}
                    className="p-3.5 bg-[#16161C] border border-[#23232C] hover:border-zinc-700 rounded-2xl flex items-center justify-between gap-3 transition"
                  >
                    <div className="flex items-center gap-3">
                      <div className="relative">
                        <img
                          src={
                            partnerPic && !partnerPic.includes('bottts')
                              ? partnerPic
                              : getDefaultFemaleAvatar(partnerName || 'caller')
                          }
                          alt={partnerName}
                          className="w-11 h-11 rounded-full object-cover border border-zinc-700"
                        />
                        <div
                          className={`absolute -bottom-1 -right-1 p-0.5 rounded-full ${
                            isOutgoing ? 'bg-amber-500/20 text-amber-400' : 'bg-emerald-500/20 text-emerald-400'
                          }`}
                        >
                          {isOutgoing ? (
                            <ArrowUpRight className="w-3 h-3" />
                          ) : (
                            <ArrowDownLeft className="w-3 h-3" />
                          )}
                        </div>
                      </div>

                      <div>
                        <h4 className="text-sm font-bold text-white">{partnerName}</h4>
                        <div className="flex items-center gap-2 text-[11px] text-zinc-400 mt-0.5">
                          <span className="flex items-center gap-1">
                            {log.type === 'video' ? (
                              <Video className="w-3 h-3 text-[#FF69B4]" />
                            ) : (
                              <Phone className="w-3 h-3 text-emerald-400" />
                            )}
                            {formatDuration(log.duration_sec || 0)}
                          </span>
                          <span>•</span>
                          <span className="text-amber-300 font-semibold">{log.coins_spent || 0} coins</span>
                        </div>
                      </div>
                    </div>

                    {/* Quick Call Back & Chat Buttons */}
                    <div className="flex items-center gap-1.5">
                      {onOpenChat && (
                        <button
                          type="button"
                          onClick={async () => {
                            try {
                              const snap = await getDoc(doc(db, 'users', partnerId));
                              if (snap.exists()) {
                                onOpenChat({ uid: snap.id, ...snap.data() } as UserProfile);
                              }
                            } catch (e) {
                              console.error(e);
                            }
                          }}
                          className="p-2.5 rounded-xl bg-[#202028] hover:bg-[#FF69B4]/20 hover:text-[#FF69B4] text-zinc-300 transition cursor-pointer"
                          title="Chat"
                        >
                          <MessageCircle className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => handleCallBack(partnerId, log.type)}
                        className="p-2.5 rounded-xl bg-[#202028] hover:bg-[#FF69B4]/20 hover:text-[#FF69B4] text-zinc-300 transition cursor-pointer"
                        title="Call Back"
                      >
                        {log.type === 'video' ? <Video className="w-4 h-4" /> : <Phone className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Favourites */}
      {activeTab === 'favourites' && (
        <div className="space-y-3">
          {favouriteUsers.length === 0 ? (
            <div className="py-16 text-center bg-[#16161C] rounded-2xl border border-[#23232C] p-6 space-y-2">
              <Heart className="w-10 h-10 text-zinc-600 mx-auto" />
              <p className="text-white font-bold text-sm">No favourites yet</p>
              <p className="text-xs text-zinc-500">
                Tap the heart icon on any listener profile card to save them here for quick access.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-2.5">
              {favouriteUsers.map((user) => (
                <div
                  key={user.uid}
                  onClick={() => onOpenProfile(user)}
                  className="p-3 bg-[#16161C] border border-[#23232C] hover:border-[#FF69B4] rounded-2xl flex items-center justify-between gap-3 cursor-pointer transition"
                >
                  <div className="flex items-center gap-3">
                    <img
                      src={getUserAvatarUrl(user)}
                      alt={user.name}
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).src = 'https://randomuser.me/api/portraits/women/11.jpg';
                      }}
                      className="w-12 h-12 rounded-full object-cover border-2 border-[#FF69B4]"
                    />
                    <div>
                      <h4 className="text-sm font-bold text-white flex items-center gap-1.5">
                        {user.name}, {user.age}
                        <span
                          className={`w-2 h-2 rounded-full ${
                            user.status === 'online' ? 'bg-emerald-400' : 'bg-zinc-600'
                          }`}
                        />
                      </h4>
                      <p className="text-xs text-zinc-400">{user.location}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                    {onOpenChat && (
                      <button
                        type="button"
                        onClick={() => onOpenChat(user)}
                        className="p-2.5 rounded-xl bg-[#202028] text-zinc-300 hover:text-[#FF69B4] hover:bg-[#FF69B4]/15 transition cursor-pointer"
                        title="Chat"
                      >
                        <MessageCircle className="w-4 h-4" />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => onVoiceCall(user)}
                      className="p-2.5 rounded-xl bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 transition cursor-pointer"
                      title="Voice Call"
                    >
                      <Phone className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onVideoCall(user)}
                      className="p-2.5 rounded-xl bg-[#FF69B4]/20 text-[#FF69B4] hover:bg-[#FF69B4]/30 transition cursor-pointer"
                      title="Video Call"
                    >
                      <Video className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
