import React, { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  onSnapshot, 
  addDoc, 
  deleteDoc, 
  doc,
  serverTimestamp,
  limit,
  startAfter,
  QueryDocumentSnapshot,
  DocumentData
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { UserProfile } from '../types';
import { useAuth } from '../context/AuthContext';
import { useCall } from '../context/CallContext';
import { DiscoveryCard } from './DiscoveryCard';
import { DiscoveryCardSkeleton } from './DiscoveryCardSkeleton';
import { 
  Search, 
  Sparkles, 
  Phone, 
  Video, 
  X, 
  Loader2, 
  AlertCircle, 
  Heart,
  SlidersHorizontal,
  Zap,
  MapPin,
  RotateCcw
} from 'lucide-react';
import { isListenerOffline } from '../utils/presence';
import { CITIES, findCity, calculateDistanceKm } from '../utils/cities';
import { getConsistentListenerAvatar } from '../data/listenerAvatars';

interface DiscoveryFeedProps {
  onVoiceCall: (user: UserProfile) => void;
  onVideoCall: (user: UserProfile) => void;
  onOpenProfile: (user: UserProfile) => void;
  onOpenReportBlock: (user: UserProfile) => void;
}

const PAGE_SIZE = 20;

export const DiscoveryFeed: React.FC<DiscoveryFeedProps> = ({
  onVoiceCall,
  onVideoCall,
  onOpenProfile,
  onOpenReportBlock,
}) => {
  const { currentUser } = useAuth();
  const { 
    startSurpriseCall, 
    surpriseCallState, 
    cancelSurpriseCall, 
    closeNoListenersPopup 
  } = useCall();

  // Listeners state with infinite scroll pagination
  const [listeners, setListeners] = useState<UserProfile[]>([]);
  const [lastVisibleDoc, setLastVisibleDoc] = useState<QueryDocumentSnapshot<DocumentData> | null>(null);
  const [hasMore, setHasMore] = useState<boolean>(true);
  const [loadingInitial, setLoadingInitial] = useState<boolean>(true);
  const [loadingMore, setLoadingMore] = useState<boolean>(false);

  // User relationships
  const [blockedUserIds, setBlockedUserIds] = useState<string[]>([]);
  const [favoriteUserIds, setFavoriteUserIds] = useState<string[]>([]);
  const [favoriteDocMap, setFavoriteDocMap] = useState<Record<string, string>>({});

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [selectedLanguage, setSelectedLanguage] = useState<string>('all');
  const [filterOnlineOnly, setFilterOnlineOnly] = useState<boolean>(false);

  // Location & Distance Filter (Requirement 3)
  const defaultCityName = currentUser?.city || (currentUser?.location ? findCity(currentUser.location).name : 'Chennai');
  const [selectedUserCity, setSelectedUserCity] = useState<string>(defaultCityName);
  const [isDistanceFilterActive, setIsDistanceFilterActive] = useState<boolean>(false);
  const [distanceRangeKm, setDistanceRangeKm] = useState<number>(200);

  useEffect(() => {
    if (currentUser?.city) {
      setSelectedUserCity(currentUser.city);
    } else if (currentUser?.location) {
      setSelectedUserCity(findCity(currentUser.location).name);
    }
  }, [currentUser?.city, currentUser?.location]);

  // Compute reference GPS coordinates based on selected city or user document
  const userCoordinates = useMemo(() => {
    const cityObj = CITIES.find((c) => c.name.toLowerCase() === selectedUserCity.toLowerCase()) || findCity(selectedUserCity);
    const lat = currentUser?.city === selectedUserCity && currentUser?.latitude != null ? currentUser.latitude : cityObj.lat;
    const lng = currentUser?.city === selectedUserCity && currentUser?.longitude != null ? currentUser.longitude : cityObj.lng;
    return { lat, lng };
  }, [selectedUserCity, currentUser]);

  // Great-circle distance between current user and a listener
  const getListenerDistance = useCallback((listener: UserProfile): number => {
    let lat = listener.latitude;
    let lng = listener.longitude;
    if (lat == null || lng == null) {
      const cityData = findCity(listener.city || listener.location);
      lat = cityData.lat;
      lng = cityData.lng;
    }
    return calculateDistanceKm(userCoordinates.lat, userCoordinates.lng, lat, lng);
  }, [userCoordinates]);

  // Observer sentinel reference for auto-loading
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  // 1. Listen to Blocks for current user from blocked_users and blocks
  useEffect(() => {
    if (!currentUser) {
      setBlockedUserIds([]);
      return;
    }

    const q1 = query(collection(db, 'blocked_users'), where('blocker_id', '==', currentUser.uid));
    const q2 = query(collection(db, 'blocks'), where('blocker_id', '==', currentUser.uid));

    const unsub1 = onSnapshot(q1, (snap) => {
      const ids = snap.docs.map((d) => d.data().blocked_id);
      setBlockedUserIds((prev) => Array.from(new Set([...prev, ...ids])));
    });

    const unsub2 = onSnapshot(q2, (snap) => {
      const ids = snap.docs.map((d) => d.data().blocked_id);
      setBlockedUserIds((prev) => Array.from(new Set([...prev, ...ids])));
    });

    return () => {
      unsub1();
      unsub2();
    };
  }, [currentUser]);

  // 2. Listen to Favourites (from user_favourites collection)
  useEffect(() => {
    if (!currentUser) {
      setFavoriteUserIds([]);
      setFavoriteDocMap({});
      return;
    }

    const favsRef = collection(db, 'user_favourites');
    const q = query(favsRef, where('user_id', '==', currentUser.uid));
    const unsubscribe = onSnapshot(q, (snap) => {
      const ids: string[] = [];
      const map: Record<string, string> = {};
      snap.docs.forEach((d) => {
        const targetId = d.data().favorited_user_id;
        if (targetId) {
          ids.push(targetId);
          map[targetId] = d.id;
        }
      });
      setFavoriteUserIds(ids);
      setFavoriteDocMap(map);
    });

    return () => unsubscribe();
  }, [currentUser]);

  // Helper timestamp parser for sorting newest first
  const getCreatedTimestamp = (u: any): number => {
    const val = u.created_at || u.createdAt;
    if (!val) return 0;
    if (typeof val.toMillis === 'function') return val.toMillis();
    if (typeof val.toDate === 'function') return val.toDate().getTime();
    if (val instanceof Date) return val.getTime();
    if (typeof val === 'number') return val;
    return 0;
  };

  // 3. Real-time load and listener subscription for listener profiles
  useEffect(() => {
    setLoadingInitial(true);
    const usersRef = collection(db, 'users');
    const q = query(
      usersRef,
      where('role', '==', 'listener'),
      limit(PAGE_SIZE)
    );

    const unsubscribe = onSnapshot(q, (snap) => {
      const items: UserProfile[] = [];
      snap.forEach((docSnap) => {
        const data = docSnap.data() as UserProfile;
        const uid = docSnap.id;
        const rawPic = (data as any).photoURL || data.profile_pic || data.avatar_url;
        const safePic = rawPic && rawPic.trim() && !rawPic.includes('randomuser.me') 
          ? rawPic 
          : getConsistentListenerAvatar(uid);

        items.push({
          ...data,
          uid,
          profile_pic: safePic,
          avatar_url: safePic,
        });
      });

      // Sort newest users first
      items.sort((a, b) => getCreatedTimestamp(b) - getCreatedTimestamp(a));

      setListeners(items);
      setLastVisibleDoc(snap.docs.length > 0 ? snap.docs[snap.docs.length - 1] : null);
      setHasMore(snap.docs.length >= PAGE_SIZE);
      setLoadingInitial(false);
    }, (err) => {
      console.error('Failed to listen to listeners:', err);
      setLoadingInitial(false);
    });

    return () => unsubscribe();
  }, []);

  // 4. Infinite scroll: Load next 20 profiles when user reaches bottom
  const fetchMoreListeners = useCallback(async () => {
    if (!lastVisibleDoc || loadingMore || !hasMore) return;

    setLoadingMore(true);
    try {
      const usersRef = collection(db, 'users');
      const nextQ = query(
        usersRef,
        where('role', '==', 'listener'),
        startAfter(lastVisibleDoc),
        limit(PAGE_SIZE)
      );

      const snap = await getDocs(nextQ);
      if (snap.empty) {
        setHasMore(false);
        setLoadingMore(false);
        return;
      }

      const newItems: UserProfile[] = [];
      snap.forEach((docSnap) => {
        const data = docSnap.data() as UserProfile;
        const uid = docSnap.id;
        const rawPic = (data as any).photoURL || data.profile_pic || data.avatar_url;
        const safePic = rawPic && rawPic.trim() && !rawPic.includes('randomuser.me') 
          ? rawPic 
          : getConsistentListenerAvatar(uid);

        newItems.push({
          ...data,
          uid,
          profile_pic: safePic,
          avatar_url: safePic,
        });
      });

      setListeners((prev) => {
        const existingIds = new Set(prev.map((p) => p.uid));
        const filteredNew = newItems.filter((p) => !existingIds.has(p.uid));
        const combined = [...prev, ...filteredNew];
        combined.sort((a, b) => getCreatedTimestamp(b) - getCreatedTimestamp(a));
        return combined;
      });

      setLastVisibleDoc(snap.docs[snap.docs.length - 1]);
      setHasMore(snap.docs.length >= PAGE_SIZE);
    } catch (err) {
      console.error('Failed to fetch more listeners:', err);
    } finally {
      setLoadingMore(false);
    }
  }, [lastVisibleDoc, loadingMore, hasMore]);

  // IntersectionObserver for bottom sentinel
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loadingMore && !loadingInitial) {
          fetchMoreListeners();
        }
      },
      { threshold: 0.1, rootMargin: '200px' }
    );

    const currentSentinel = sentinelRef.current;
    if (currentSentinel) {
      observer.observe(currentSentinel);
    }

    return () => {
      if (currentSentinel) {
        observer.unobserve(currentSentinel);
      }
    };
  }, [fetchMoreListeners, hasMore, loadingMore, loadingInitial]);

  // 5. Toggle Favourite: Saves to user_favourites table
  const handleToggleFavorite = async (targetUserId: string) => {
    if (!currentUser) {
      alert('Please login to save favourites');
      return;
    }

    const isFav = favoriteUserIds.includes(targetUserId);

    // Optimistic UI update
    if (isFav) {
      setFavoriteUserIds((prev) => prev.filter((id) => id !== targetUserId));
      const favDocId = favoriteDocMap[targetUserId];
      if (favDocId) {
        try {
          await deleteDoc(doc(db, 'user_favourites', favDocId));
        } catch (e) {
          console.error('Failed to delete favourite:', e);
        }
      }
    } else {
      setFavoriteUserIds((prev) => [...prev, targetUserId]);
      try {
        const newDoc = await addDoc(collection(db, 'user_favourites'), {
          user_id: currentUser.uid,
          favorited_user_id: targetUserId,
          created_at: serverTimestamp(),
        });
        setFavoriteDocMap((prev) => ({ ...prev, [targetUserId]: newDoc.id }));
      } catch (e) {
        console.error('Failed to add favourite:', e);
      }
    }
  };

  // 6. Block User: adds to blocked_users table and hides profile immediately
  const handleBlockUser = async (targetUser: UserProfile) => {
    if (!currentUser) {
      alert('Please log in to block users');
      return;
    }

    // Immediately hide that profile from Discover list
    setBlockedUserIds((prev) => Array.from(new Set([...prev, targetUser.uid])));
    setListeners((prev) => prev.filter((u) => u.uid !== targetUser.uid));

    try {
      // Add to blocked_users table (blocker_id, blocked_id)
      await addDoc(collection(db, 'blocked_users'), {
        blocker_id: currentUser.uid,
        blocked_id: targetUser.uid,
        created_at: serverTimestamp(),
      });

      // Also add to blocks table for backwards compatibility
      await addDoc(collection(db, 'blocks'), {
        blocker_id: currentUser.uid,
        blocked_id: targetUser.uid,
        created_at: serverTimestamp(),
      });
    } catch (err) {
      console.error('Failed to add to blocked_users:', err);
    }
  };

  // Filter list by search query, blocked users, tag, language
  const filteredListeners = useMemo(() => {
    return listeners.filter((u) => {
      if (blockedUserIds.includes(u.uid)) return false;
      if (u.isBlocked || u.is_blocked) return false;

      // Online only filter
      if (filterOnlineOnly && isListenerOffline(u)) {
        return false;
      }

      // Search query filter (name, location, bio, languages)
      if (searchQuery.trim()) {
        const queryLower = searchQuery.toLowerCase();
        const nameMatch = u.name?.toLowerCase().includes(queryLower);
        const locMatch = u.location?.toLowerCase().includes(queryLower);
        const bioMatch = u.bio?.toLowerCase().includes(queryLower);
        const langMatch = u.language?.toLowerCase().includes(queryLower);
        const tagMatch = u.interests?.some((tag) => tag.toLowerCase().includes(queryLower));

        if (!nameMatch && !locMatch && !bioMatch && !langMatch && !tagMatch) {
          return false;
        }
      }

      // Tag filter
      if (selectedTag) {
        if (!u.interests || !u.interests.includes(selectedTag)) {
          return false;
        }
      }

      // Language filter
      if (selectedLanguage !== 'all') {
        if (u.language?.toLowerCase() !== selectedLanguage.toLowerCase()) {
          return false;
        }
      }

      // Distance range filter (Requirement 3: "If user sets 200 km, show only listeners within 200 km. Update list dynamically when slider changes. Add Clear filter button to show all listeners")
      if (isDistanceFilterActive) {
        const dist = getListenerDistance(u);
        if (dist > distanceRangeKm) {
          return false;
        }
      }

      return true;
    });
  }, [listeners, blockedUserIds, filterOnlineOnly, searchQuery, selectedTag, selectedLanguage, isDistanceFilterActive, distanceRangeKm, getListenerDistance]);

  // Extract common interest tags
  const allTags = useMemo(() => {
    const tagSet = new Set<string>();
    listeners.forEach((l) => {
      if (Array.isArray(l.interests)) {
        l.interests.forEach((t) => tagSet.add(t));
      }
    });
    return Array.from(tagSet).slice(0, 10);
  }, [listeners]);

  return (
    <div className="space-y-4 pb-36 text-white">
      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search listeners by name, language, tag..."
          className="w-full bg-[#161622] border border-[#232334] focus:border-[#ff4d8d] rounded-2xl pl-10 pr-10 py-2.5 text-xs text-white placeholder-zinc-500 outline-none transition"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-zinc-400 hover:text-white"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Location Filter & Distance Range Slider (Requirement 3) */}
      <div className="p-3.5 rounded-2xl bg-[#161622] border border-[#232334] space-y-2.5 shadow-sm">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2 min-w-0">
            <div className="p-1.5 rounded-xl bg-[#ff4d8d]/15 text-[#ff4d8d] shrink-0">
              <MapPin className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">
                Location
              </span>
              <select
                value={selectedUserCity}
                onChange={(e) => setSelectedUserCity(e.target.value)}
                className="bg-transparent text-xs font-bold text-white focus:outline-none cursor-pointer py-0.5 border-b border-dashed border-zinc-600 hover:border-[#ff4d8d]"
              >
                {CITIES.map((c) => (
                  <option key={c.name} value={c.name} className="bg-[#161622] text-white">
                    {c.name}, {c.state}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isDistanceFilterActive && (
              <button
                type="button"
                onClick={() => {
                  setIsDistanceFilterActive(false);
                  setDistanceRangeKm(200);
                }}
                className="px-2.5 py-1 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-[11px] font-semibold flex items-center gap-1 transition cursor-pointer"
                title="Clear filter to show all listeners"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Clear filter</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setIsDistanceFilterActive(!isDistanceFilterActive)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                isDistanceFilterActive
                  ? 'bg-[#ff4d8d] text-white shadow-[0_0_12px_rgba(255,77,141,0.4)]'
                  : 'bg-[#202030] text-zinc-400 hover:text-white border border-[#2b2b3d]'
              }`}
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>{isDistanceFilterActive ? `≤ ${distanceRangeKm} km` : 'Filter Distance'}</span>
            </button>
          </div>
        </div>

        {/* Distance Range Slider: 1 km to 1000 km, default 200 km */}
        <div className="space-y-1 pt-1 border-t border-zinc-800/60">
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-zinc-400">
              Max Distance:{' '}
              <strong className={isDistanceFilterActive ? 'text-[#ff4d8d] text-xs' : 'text-zinc-200'}>
                {distanceRangeKm} km
              </strong>{' '}
              {isDistanceFilterActive && (
                <span className="text-[10px] text-[#ff4d8d]/80 font-medium">(Filter Active)</span>
              )}
            </span>
            <span className="text-[10px] text-zinc-500 font-mono">1 km – 1000 km</span>
          </div>

          <input
            type="range"
            min="1"
            max="1000"
            step="1"
            value={distanceRangeKm}
            onChange={(e) => {
              setDistanceRangeKm(Number(e.target.value));
              if (!isDistanceFilterActive) {
                setIsDistanceFilterActive(true);
              }
            }}
            className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-[#ff4d8d]"
          />

          <div className="flex justify-between text-[10px] text-zinc-500 font-mono">
            <span>1 km</span>
            <span>200 km (Default)</span>
            <span>500 km</span>
            <span>1000 km</span>
          </div>
        </div>
      </div>

      {/* Language & Tag Filter Pills */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar text-xs">
        <button
          onClick={() => setFilterOnlineOnly(!filterOnlineOnly)}
          className={`px-3 py-1.5 rounded-full shrink-0 flex items-center gap-1.5 font-medium transition ${
            filterOnlineOnly
              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/50'
              : 'bg-[#161622] text-zinc-400 border border-[#232334] hover:text-white'
          }`}
        >
          <span className={`w-2 h-2 rounded-full ${filterOnlineOnly ? 'bg-emerald-400' : 'bg-zinc-600'}`}></span>
          Online Only
        </button>

        <button
          onClick={() => setSelectedTag(null)}
          className={`px-3 py-1.5 rounded-full shrink-0 font-medium transition ${
            selectedTag === null
              ? 'bg-[#ff4d8d] text-white shadow-[0_0_12px_rgba(255,77,141,0.4)]'
              : 'bg-[#161622] text-zinc-400 border border-[#232334] hover:text-white'
          }`}
        >
          All
        </button>

        {allTags.map((tag) => (
          <button
            key={tag}
            onClick={() => setSelectedTag(selectedTag === tag ? null : tag)}
            className={`px-3 py-1.5 rounded-full shrink-0 font-medium transition ${
              selectedTag === tag
                ? 'bg-[#ff4d8d] text-white shadow-[0_0_12px_rgba(255,77,141,0.4)]'
                : 'bg-[#161622] text-zinc-400 border border-[#232334] hover:text-white'
            }`}
          >
            {tag}
          </button>
        ))}
      </div>

      {/* Listeners Count Header */}
      <div className="flex items-center justify-between text-xs text-zinc-400 px-1">
        <span className="flex items-center gap-1.5 flex-wrap">
          <span>Showing <strong className="text-white">{filteredListeners.length}</strong> {filteredListeners.length === 1 ? 'listener' : 'listeners'}</span>
          {isDistanceFilterActive && (
            <span className="text-zinc-400 text-[11px]">• within <strong className="text-[#ff4d8d]">{distanceRangeKm} km</strong> of {selectedUserCity}</span>
          )}
        </span>
        {filterOnlineOnly && (
          <span className="text-emerald-400 font-medium flex items-center gap-1 shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
            Live free now
          </span>
        )}
      </div>

      {/* Discover Cards List */}
      {loadingInitial ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <DiscoveryCardSkeleton key={i} />
          ))}
        </div>
      ) : filteredListeners.length === 0 ? (
        <div className="text-center py-16 px-4 bg-[#161622] rounded-3xl border border-[#232334]">
          <AlertCircle className="w-10 h-10 text-zinc-500 mx-auto mb-2" />
          <h3 className="text-base font-bold text-white">No listeners found</h3>
          <p className="text-xs text-zinc-400 mt-1 max-w-xs mx-auto">
            Try adjusting your search query, clearing filters, or checking back soon.
          </p>
          {(searchQuery || selectedTag || filterOnlineOnly || isDistanceFilterActive) && (
            <button
              onClick={() => {
                setSearchQuery('');
                setSelectedTag(null);
                setFilterOnlineOnly(false);
                setIsDistanceFilterActive(false);
                setDistanceRangeKm(200);
              }}
              className="mt-4 px-4 py-2 rounded-xl bg-zinc-800 text-xs font-semibold text-white hover:bg-zinc-700 transition cursor-pointer"
            >
              Clear Filters
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filteredListeners.map((user) => (
            <DiscoveryCard
              key={user.uid}
              user={user}
              distanceKm={getListenerDistance(user)}
              isFavorited={favoriteUserIds.includes(user.uid)}
              onToggleFavorite={handleToggleFavorite}
              onVoiceCall={onVoiceCall}
              onVideoCall={onVideoCall}
              onOpenProfile={onOpenProfile}
              onBlockUser={handleBlockUser}
              onOpenReportBlock={onOpenReportBlock}
            />
          ))}
        </div>
      )}

      {/* Infinite scroll sentinel & bottom loading spinner */}
      <div ref={sentinelRef} className="py-4 text-center">
        {loadingMore && (
          <div className="flex items-center justify-center gap-2 text-xs text-zinc-400 py-2">
            <Loader2 className="w-4 h-4 animate-spin text-[#ff4d8d]" />
            <span>Loading more profiles...</span>
          </div>
        )}
        {!hasMore && listeners.length > 0 && (
          <div className="text-[11px] text-zinc-600 py-3">
            You've reached the end of the list
          </div>
        )}
      </div>

      {/* Sticky Bottom Floating Button: "Surprise call now" */}
      <div className="fixed bottom-20 left-0 right-0 z-30 px-4 max-w-md mx-auto pointer-events-none">
        <div
          onClick={() => startSurpriseCall('video')}
          className="pointer-events-auto w-full bg-gradient-to-r from-[#ff4d8d] to-[#ff7ab8] text-white rounded-full p-2 pl-5 pr-2.5 flex items-center justify-between shadow-[0_8px_25px_rgba(255,77,141,0.55)] cursor-pointer hover:brightness-105 active:scale-[0.98] transition-all duration-200"
        >
          {/* Left: Sparkle icon + "Surprise call now" */}
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-white animate-pulse" />
            <span className="font-bold text-sm tracking-wide">Surprise call now</span>
          </div>

          {/* Right: Two white circular buttons with pink phone and video icons */}
          <div className="flex items-center gap-2">
            {/* Audio Call Circle */}
            <button
              type="button"
              title="Surprise Audio Call"
              onClick={(e) => {
                e.stopPropagation();
                startSurpriseCall('audio');
              }}
              className="w-9 h-9 rounded-full bg-white flex items-center justify-center shadow-md hover:scale-110 active:scale-95 transition cursor-pointer"
            >
              <Phone className="w-4 h-4 text-[#ff4d8d] fill-[#ff4d8d]" />
            </button>

            {/* Video Call Circle */}
            <button
              type="button"
              title="Surprise Video Call"
              onClick={(e) => {
                e.stopPropagation();
                startSurpriseCall('video');
              }}
              className="w-9 h-9 rounded-full bg-white flex items-center justify-center shadow-md hover:scale-110 active:scale-95 transition cursor-pointer"
            >
              <Video className="w-4 h-4 text-[#ff4d8d] fill-[#ff4d8d]" />
            </button>
          </div>
        </div>
      </div>

      {/* Surprise Call Ongoing / Connecting Overlay */}
      {surpriseCallState.active && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-in fade-in">
          <div className="w-full max-w-sm bg-[#161622] border border-[#ff4d8d] rounded-3xl p-6 text-center shadow-[0_0_35px_rgba(255,77,141,0.4)] relative flex flex-col items-center">
            {/* Pulsing rings */}
            <div className="relative my-4">
              <div className="absolute inset-0 rounded-full bg-[#ff4d8d]/30 animate-ping"></div>
              <div className="w-20 h-20 rounded-full bg-gradient-to-tr from-[#ff4d8d] to-purple-600 flex items-center justify-center text-white shadow-lg relative z-10">
                {surpriseCallState.type === 'audio' ? (
                  <Phone className="w-8 h-8 animate-bounce" />
                ) : (
                  <Video className="w-8 h-8 animate-bounce" />
                )}
              </div>
            </div>

            <div className="space-y-1">
              <span className="text-[11px] uppercase tracking-widest font-bold text-[#ff4d8d] flex items-center justify-center gap-1">
                <Zap className="w-3.5 h-3.5" />
                Surprise {surpriseCallState.type.toUpperCase()} Call
              </span>
              <h3 className="text-lg font-black text-white">
                {surpriseCallState.targetListenerName 
                  ? `Connecting to ${surpriseCallState.targetListenerName}...` 
                  : 'Finding free online listener...'}
              </h3>
              <p className="text-xs text-zinc-400">
                Attempt {surpriseCallState.attempt} of 3 • Ringing for up to 30s
              </p>
            </div>

            <button
              onClick={cancelSurpriseCall}
              className="mt-6 w-full py-3 rounded-2xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-bold text-xs transition active:scale-95"
            >
              Cancel Call
            </button>
          </div>
        </div>
      )}

      {/* "No free listeners right now, try again in a bit" Popup */}
      {surpriseCallState.showNoListenersPopup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-in fade-in">
          <div className="w-full max-w-sm bg-[#161622] border border-zinc-700 rounded-3xl p-6 text-center shadow-2xl relative flex flex-col items-center">
            <div className="w-14 h-14 rounded-full bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 mb-3">
              <AlertCircle className="w-7 h-7" />
            </div>

            <h3 className="text-lg font-black text-white">All Listeners Busy</h3>
            <p className="text-xs text-zinc-400 mt-2 max-w-xs">
              No free listeners right now, try again in a bit.
            </p>

            <button
              onClick={closeNoListenersPopup}
              className="mt-6 w-full py-3 rounded-2xl bg-gradient-to-r from-[#ff4d8d] to-[#ff7ab8] text-white font-bold text-xs shadow-md hover:brightness-110 active:scale-95 transition"
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
