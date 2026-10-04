import React, { useEffect, useState } from 'react';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  deleteDoc, 
  doc, 
  getDoc,
  documentId
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../context/AuthContext';
import { UserProfile } from '../types';
import { getUserAvatarUrl } from '../services/staticCdnService';
import { Heart, Phone, Video, X, Loader2, Sparkles, MapPin, Coins } from 'lucide-react';

interface FavoritesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onVoiceCall: (user: UserProfile) => void;
  onVideoCall: (user: UserProfile) => void;
  onOpenProfile: (user: UserProfile) => void;
}

export const FavoritesModal: React.FC<FavoritesModalProps> = ({
  isOpen,
  onClose,
  onVoiceCall,
  onVideoCall,
  onOpenProfile,
}) => {
  const { currentUser } = useAuth();
  const [favoriteUsers, setFavoriteUsers] = useState<{ profile: UserProfile; docId: string }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isOpen || !currentUser?.uid) {
      setFavoriteUsers([]);
      return;
    }

    setLoading(true);
    const favsRef = collection(db, 'user_favourites');
    const q = query(favsRef, where('user_id', '==', currentUser.uid));

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      if (snapshot.empty) {
        setFavoriteUsers([]);
        setLoading(false);
        return;
      }

      const promises = snapshot.docs.map(async (favDoc) => {
        const targetUserId = favDoc.data().favorited_user_id;
        if (!targetUserId) return null;
        try {
          const uSnap = await getDoc(doc(db, 'users', targetUserId));
          if (uSnap.exists()) {
            return {
              profile: { ...(uSnap.data() as UserProfile), uid: uSnap.id },
              docId: favDoc.id,
            };
          }
        } catch {}
        return null;
      });

      const results = await Promise.all(promises);
      setFavoriteUsers(results.filter((r): r is { profile: UserProfile; docId: string } => r !== null));
      setLoading(false);
    }, (err) => {
      console.error('Favorites query error:', err);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [isOpen, currentUser]);

  const handleUnfavorite = async (docId: string) => {
    try {
      await deleteDoc(doc(db, 'user_favourites', docId));
      setFavoriteUsers((prev) => prev.filter((item) => item.docId !== docId));
    } catch (err) {
      console.error('Error removing favorite:', err);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in">
      <div 
        className="w-full max-w-md bg-[#161622] border border-[#232334] rounded-3xl p-5 shadow-2xl relative flex flex-col max-h-[85vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-[#ff4d8d]/15 text-[#ff4d8d]">
              <Heart className="w-5 h-5 fill-[#ff4d8d]" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">My Favourites</h2>
              <p className="text-[11px] text-zinc-400">
                {favoriteUsers.length} {favoriteUsers.length === 1 ? 'listener' : 'listeners'} saved
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-zinc-400 hover:text-white hover:bg-zinc-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto py-3 space-y-2.5 no-scrollbar">
          {loading ? (
            <div className="flex items-center justify-center py-12 text-zinc-400 gap-2 text-xs">
              <Loader2 className="w-5 h-5 animate-spin text-[#ff4d8d]" />
              <span>Loading favourites...</span>
            </div>
          ) : favoriteUsers.length === 0 ? (
            <div className="text-center py-12 px-4">
              <Heart className="w-10 h-10 text-zinc-600 mx-auto mb-2 stroke-1" />
              <h4 className="text-sm font-bold text-white">No favourites yet</h4>
              <p className="text-xs text-zinc-400 mt-1 max-w-xs mx-auto">
                Tap the heart icon on any listener's card to quickly find them here anytime.
              </p>
            </div>
          ) : (
            favoriteUsers.map(({ profile, docId }) => (
              <div
                key={profile.uid}
                className="p-3 bg-[#13131c] border border-zinc-800/80 rounded-2xl flex items-center justify-between gap-3 hover:border-[#ff4d8d]/40 transition"
              >
                {/* Avatar & info */}
                <div 
                  className="flex items-center gap-3 cursor-pointer min-w-0 flex-1"
                  onClick={() => {
                    onClose();
                    onOpenProfile(profile);
                  }}
                >
                  <img
                    src={getUserAvatarUrl(profile)}
                    alt={profile.name}
                    className="w-12 h-12 rounded-xl object-cover border border-zinc-700 shrink-0"
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).src = 'https://randomuser.me/api/portraits/women/44.jpg';
                    }}
                  />
                  <div className="min-w-0">
                    <h4 className="text-sm font-bold text-white truncate hover:text-[#ff4d8d] transition">
                      {profile.name}, {profile.age}
                    </h4>
                    <p className="text-[11px] text-zinc-400 flex items-center gap-1 mt-0.5 truncate">
                      <MapPin className="w-3 h-3 text-[#ff4d8d] shrink-0" />
                      <span className="truncate">{profile.location || 'India'}</span>
                    </p>
                    <div className="flex items-center gap-1.5 text-[10px] text-zinc-400 mt-0.5">
                      <span className="inline-flex items-center gap-0.5 text-zinc-300 font-medium">
                        <Coins className="w-3 h-3 text-amber-400 fill-amber-400/80 shrink-0" />
                        <span className="text-white font-semibold">{profile.audio_rate_coins ?? profile.voice_rate ?? 10}</span> coins/m
                      </span>
                      <span className="text-zinc-600">•</span>
                      <span className="inline-flex items-center gap-0.5 text-zinc-300 font-medium">
                        <Coins className="w-3 h-3 text-amber-400 fill-amber-400/80 shrink-0" />
                        <span className="text-white font-semibold">{profile.video_rate_coins ?? profile.video_rate ?? 50}</span> coins/m
                      </span>
                    </div>
                  </div>
                </div>

                {/* Actions: Audio, Video, Unfavourite */}
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    onClick={() => {
                      onClose();
                      onVoiceCall(profile);
                    }}
                    title="Audio Call"
                    className="p-2 rounded-xl border border-[#ff4d8d] text-[#ff4d8d] hover:bg-[#ff4d8d]/15 active:scale-95 transition cursor-pointer"
                  >
                    <Phone className="w-3.5 h-3.5" />
                  </button>

                  <button
                    onClick={() => {
                      onClose();
                      onVideoCall(profile);
                    }}
                    title="Video Call"
                    className="p-2 rounded-xl border border-[#ff4d8d] text-[#ff4d8d] hover:bg-[#ff4d8d]/15 active:scale-95 transition cursor-pointer"
                  >
                    <Video className="w-3.5 h-3.5" />
                  </button>

                  <button
                    onClick={() => handleUnfavorite(docId)}
                    title="Remove from Favourites"
                    className="p-2 rounded-xl text-[#ff4d8d] hover:bg-zinc-800 active:scale-95 transition cursor-pointer"
                  >
                    <Heart className="w-4 h-4 fill-[#ff4d8d]" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
