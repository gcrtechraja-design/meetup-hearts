import React, { useRef, useState } from 'react';
import { 
  User, 
  Coins, 
  Sparkles, 
  Receipt, 
  Globe, 
  Headphones, 
  HelpCircle, 
  Settings, 
  LogOut, 
  FileText, 
  Shield, 
  Trash2, 
  ChevronRight,
  UserCheck,
  Camera,
  Video,
  CheckCircle2,
  Crown,
  Heart,
  Pencil,
  Check,
  X,
  Loader2,
  Image as ImageIcon,
  Bell,
  MapPin,
  AlertCircle
} from 'lucide-react';
import { FavoritesModal } from './FavoritesModal';
import { AvatarPickerBottomSheet } from './AvatarPickerBottomSheet';
import { BackgroundCallNotificationsModal } from './BackgroundCallNotificationsModal';
import { useAuth, stripUndefinedFields } from '../context/AuthContext';
import { useTranslation, SupportedLanguage, LANGUAGES } from '../utils/i18n';
import { getStaticCdnUrl, uploadImageToStaticCdn, getUserAvatarUrl, getDefaultFemaleAvatar } from '../services/staticCdnService';
import { uploadPhotoToSupabase, syncUserToSupabase } from '../services/supabase';
import { doc, updateDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { updateProfile } from 'firebase/auth';
import { db, auth } from '../firebase/config';
import { isListenerOffline } from '../utils/presence';
import { CITIES, findCity } from '../utils/cities';
import { isUserAdmin, isMeetupOwner } from '../utils/admin';
import { loadCoins } from '../utils/coins';
import appLogo from '../assets/images/app_logo_1790170748297.jpg';

interface ProfileViewProps {
  onOpenWallet: () => void;
  onOpenTransactions: () => void;
  onOpenLanguage: () => void;
  onOpenListenerApply: () => void;
  onOpenTerms: () => void;
  onOpenPrivacy: () => void;
  onOpenHelp: () => void;
  onOpenZegoConfig: () => void;
  onOpenAdmin?: () => void;
  onOpenOwner?: () => void;
  onOpenAuth?: () => void;
  onVoiceCall?: (user: any) => void;
  onVideoCall?: (user: any) => void;
  onOpenProfile?: (user: any) => void;
}

export const ProfileView: React.FC<ProfileViewProps> = ({
  onOpenWallet,
  onOpenTransactions,
  onOpenLanguage,
  onOpenListenerApply,
  onOpenTerms,
  onOpenPrivacy,
  onOpenHelp,
  onOpenZegoConfig,
  onOpenAdmin,
  onOpenOwner,
  onOpenAuth,
  onVoiceCall,
  onVideoCall,
  onOpenProfile,
}) => {
  const { currentUser, logout, deleteMyAccount, requestPushPermission } = useAuth();
  const lang = (currentUser?.language?.toUpperCase() || 'EN') as SupportedLanguage;
  const { t } = useTranslation(lang);
  const [showFavorites, setShowFavorites] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [uploadingPic, setUploadingPic] = useState(false);
  const [uploadNotice, setUploadNotice] = useState<string | null>(null);
  const [updatingPresence, setUpdatingPresence] = useState(false);

  // Avatar Picker Bottom Sheet & Edit Name State
  const [showAvatarSheet, setShowAvatarSheet] = useState(false);
  const [sheetInitialView, setSheetInitialView] = useState<'menu' | 'avatars'>('menu');
  const [isEditingName, setIsEditingName] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [savingName, setSavingName] = useState(false);
  const [isEditingCity, setIsEditingCity] = useState(false);

  // Bio, Age, Gender & Interests Editing State
  const [isEditingBio, setIsEditingBio] = useState(false);
  const [bioInput, setBioInput] = useState('');
  const [ageInput, setAgeInput] = useState<number>(24);
  const [genderInput, setGenderInput] = useState<'male' | 'female' | 'other'>('other');
  const [interestsInput, setInterestsInput] = useState<string[]>([]);
  const [customInterest, setCustomInterest] = useState('');
  const [savingDetails, setSavingDetails] = useState(false);
  const [detailsError, setDetailsError] = useState<string | null>(null);

  const POPULAR_INTERESTS = [
    'Dating', 'Conversations', 'Music', 'Travel', 'Movies',
    'Deep Talks', 'Fitness', 'Foodie', 'Art', 'Reading',
    'Mindfulness', 'Gaming', 'Coffee', 'Photography'
  ];

  const handleStartEditDetails = () => {
    setBioInput(currentUser?.bio || '');
    setAgeInput(currentUser?.age || 24);
    setGenderInput(currentUser?.gender || 'other');
    setInterestsInput(currentUser?.interests && currentUser.interests.length > 0 ? currentUser.interests : ['Dating', 'Conversations']);
    setDetailsError(null);
    setIsEditingBio(true);
  };

  const handleToggleInterest = (interest: string) => {
    setInterestsInput((prev) => 
      prev.includes(interest) ? prev.filter((i) => i !== interest) : [...prev, interest]
    );
  };

  const handleAddCustomInterest = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = customInterest.trim();
    if (trimmed && !interestsInput.includes(trimmed)) {
      setInterestsInput((prev) => [...prev, trimmed]);
      setCustomInterest('');
    }
  };

  const handleSaveDetails = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!currentUser) return;

    if (ageInput < 18) {
      setDetailsError('Age requirement: You must be at least 18 years old to use Meet Up.');
      return;
    }
    if (ageInput > 99) {
      setDetailsError('Please enter a valid age between 18 and 99.');
      return;
    }
    if (!bioInput.trim()) {
      setDetailsError('Bio cannot be empty.');
      return;
    }

    setSavingDetails(true);
    setDetailsError(null);
    try {
      await updateDoc(doc(db, 'users', currentUser.uid), stripUndefinedFields({
        bio: bioInput.trim(),
        age: Number(ageInput),
        gender: genderInput,
        interests: interestsInput.length > 0 ? interestsInput : ['Dating', 'Conversations'],
      }));
      setIsEditingBio(false);
      setUploadNotice('Profile bio, age & interests updated successfully!');
      setTimeout(() => setUploadNotice(null), 3000);
    } catch (err: any) {
      console.error('Failed to update profile details:', err);
      setDetailsError(err.message || 'Failed to update profile details.');
    } finally {
      setSavingDetails(false);
    }
  };

  // Background Call Notifications Bottom Sheet & Toast State
  const [showNotificationModal, setShowNotificationModal] = useState(false);
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'info' | 'error' } | null>(null);
  const toastTimerRef = useRef<any>(null);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleLogout = async (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (isLoggingOut) return;
    setIsLoggingOut(true);
    try {
      await logout();
    } catch (err) {
      console.error('[ProfileView] Logout error:', err);
    } finally {
      setIsLoggingOut(false);
      if (typeof window !== 'undefined') {
        localStorage.removeItem('meetup_active_user_uid');
        localStorage.removeItem('meetup_supabase_auth_token');
        localStorage.removeItem('meetup_owner_authenticated');
        sessionStorage.removeItem('meetup_owner_token');
        window.history.replaceState({}, '', '/login');
        window.dispatchEvent(new PopStateEvent('popstate'));
        window.location.href = '/login';
      }
    }
  };

  const showToast = (text: string, type: 'success' | 'info' | 'error' = 'success') => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToastMessage({ text, type });
    toastTimerRef.current = setTimeout(() => {
      setToastMessage(null);
    }, 3500);
  };

  const isBgNotifyActive = 
    currentUser?.background_call_notify !== false &&
    (typeof window !== 'undefined' ? localStorage.getItem('background_call_notify') !== 'false' : true);

  const currentLangLabel = LANGUAGES.find((l) => l.code === lang)?.label || 'English';
  const isCurrentListenerOffline = isListenerOffline(currentUser);
  const isAdmin = isUserAdmin(currentUser);

  if (!currentUser) {
    return (
      <div className="space-y-4 pb-24">
        {/* Guest Profile Card */}
        <div className="p-6 bg-[#16161C] border border-[#23232C] rounded-3xl text-center relative overflow-hidden">
          <div className="relative w-20 h-20 mx-auto mb-3 rounded-full p-[2px] bg-gradient-to-tr from-[#FF69B4] to-purple-500 shadow-[0_0_16px_rgba(255,105,180,0.4)]">
            <img
              src={appLogo}
              alt="Meet Up Guest"
              className="w-full h-full rounded-full object-cover bg-black"
            />
          </div>
          <h2 className="text-xl font-black text-white">Welcome, Guest!</h2>
          <p className="text-xs text-zinc-400 mt-1 max-w-xs mx-auto">
            You are browsing Meet Up in public mode. Explore listeners, voice intros, or sign in to start live 1-on-1 calls.
          </p>

          <button
            onClick={onOpenAuth}
            className="mt-4 w-full py-3 rounded-2xl bg-gradient-to-r from-[#FF69B4] to-pink-600 text-white text-sm font-bold shadow-[0_0_20px_rgba(255,105,180,0.4)] hover:brightness-110 active:scale-98 transition flex items-center justify-center gap-2"
          >
            <Sparkles className="w-4 h-4 text-white" />
            Sign In / Create Account
          </button>
        </div>

        {/* Quick Settings & Help for Guests */}
        <div className="bg-[#16161C] border border-[#23232C] rounded-2xl p-2 divide-y divide-[#23232C]/50 text-sm">
          <button
            onClick={onOpenLanguage}
            className="w-full p-3 flex items-center justify-between text-zinc-300 hover:text-white transition"
          >
            <div className="flex items-center gap-3">
              <Globe className="w-5 h-5 text-indigo-400" />
              <span>Language: <strong className="text-white">{currentLangLabel}</strong></span>
            </div>
            <ChevronRight className="w-4 h-4 text-zinc-600" />
          </button>

          <button
            onClick={onOpenListenerApply}
            className="w-full p-3 flex items-center justify-between text-zinc-300 hover:text-white transition"
          >
            <div className="flex items-center gap-3">
              <UserCheck className="w-5 h-5 text-emerald-400" />
              <span>Become a Verified Listener</span>
            </div>
            <ChevronRight className="w-4 h-4 text-zinc-600" />
          </button>

          <button
            onClick={onOpenTerms}
            className="w-full p-3 flex items-center justify-between text-zinc-300 hover:text-white transition"
          >
            <div className="flex items-center gap-3">
              <FileText className="w-5 h-5 text-zinc-400" />
              <span>Terms of Service</span>
            </div>
            <ChevronRight className="w-4 h-4 text-zinc-600" />
          </button>

          <button
            onClick={onOpenPrivacy}
            className="w-full p-3 flex items-center justify-between text-zinc-300 hover:text-white transition"
          >
            <div className="flex items-center gap-3">
              <Shield className="w-5 h-5 text-zinc-400" />
              <span>Privacy Policy</span>
            </div>
            <ChevronRight className="w-4 h-4 text-zinc-600" />
          </button>

          <button
            onClick={onOpenHelp}
            className="w-full p-3 flex items-center justify-between text-zinc-300 hover:text-white transition"
          >
            <div className="flex items-center gap-3">
              <HelpCircle className="w-5 h-5 text-zinc-400" />
              <span>Help & Safety Center</span>
            </div>
            <ChevronRight className="w-4 h-4 text-zinc-600" />
          </button>
        </div>
      </div>
    );
  }

  const handleToggleListenerPresence = async () => {
    if (!currentUser || updatingPresence) return;
    setUpdatingPresence(true);
    try {
      const willBeOffline = !isCurrentListenerOffline;
      const newStatus = willBeOffline ? 'unavailable' : 'online';
      const newPresence = willBeOffline ? 'unavailable' : 'available';
      const newIsAvailable = !willBeOffline;

      await updateDoc(doc(db, 'users', currentUser.uid), {
        status: newStatus,
        presence_status: newPresence,
        presence: newPresence,
        is_available: newIsAvailable,
      });
      setUploadNotice(`Presence updated: ${willBeOffline ? 'Unavailable (Offline)' : 'Available (Online)'}`);
      setTimeout(() => setUploadNotice(null), 3000);
    } catch (e: any) {
      console.error('Failed to update presence status in Firestore:', e);
      alert(e.message || 'Failed to update presence.');
    } finally {
      setUpdatingPresence(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (confirm('CRITICAL: Are you sure you want to permanently delete your Meet Up account? All coins, records and data will be erased.')) {
      await deleteMyAccount();
    }
  };

  // Upload user profile image through Supabase Storage 'photos' bucket
  const handleProfileImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !currentUser) return;

    // File validation (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      alert('Photo size exceeds 10MB limit. Please select a smaller photo.');
      if (e.target) e.target.value = '';
      return;
    }

    setUploadingPic(true);
    setUploadNotice("Uploading photo to Supabase Storage 'photos' bucket...");

    // 5. Add a 15 second timeout - if upload takes longer, show error and reset the "Uploading..." text
    let isFinished = false;
    const timeoutId = setTimeout(() => {
      if (!isFinished) {
        isFinished = true;
        setUploadingPic(false);
        setUploadNotice(null);
        alert('Photo upload timed out after 15 seconds. Please check your network and try again.');
      }
    }, 15000);

    try {
      // 1. uploadPhotoToSupabase logs before and after upload
      // 2. wraps in try/catch and shows actual error
      // 3. calls getPublicUrl()
      // 4. updates profiles table in separate try/catch
      const publicUrl = await uploadPhotoToSupabase(file, currentUser.uid);

      if (isFinished) return;
      isFinished = true;
      clearTimeout(timeoutId);

      // Persist public URL to Firestore user profile (non-blocking if offline)
      try {
        const userDocRef = doc(db, 'users', currentUser.uid);
        await setDoc(userDocRef, {
          profile_pic: publicUrl,
          avatar_url: publicUrl,
          avatar: publicUrl,
          photoURL: publicUrl,
          updated_at: serverTimestamp(),
        }, { merge: true });

        if (auth.currentUser) {
          try {
            await updateProfile(auth.currentUser, { photoURL: publicUrl });
          } catch {}
        }
      } catch (fsErr) {
        console.warn('[ProfileView] Firestore user doc update notice:', fsErr);
      }

      setUploadNotice('Photo uploaded to Supabase Storage & updated successfully!');
      setTimeout(() => setUploadNotice(null), 3500);
    } catch (err: any) {
      if (isFinished) return;
      isFinished = true;
      clearTimeout(timeoutId);
      console.error('[ProfileView] Photo upload error:', err);
      // 2. Show the actual error with alert(error.message)
      const errorMsg = err?.message || 'Failed to upload photo to Supabase Storage.';
      alert(errorMsg);
      setUploadNotice(errorMsg);
      setTimeout(() => setUploadNotice(null), 4000);
    } finally {
      clearTimeout(timeoutId);
      // 6. Reset the uploading status text on both success and failure
      setUploadingPic(false);
      // Reset input element value so user can re-upload if needed
      if (e.target) e.target.value = '';
    }
  };

  // Revert / set cute female avatar for real customers
  const handleUseFemaleAvatar = async () => {
    if (!currentUser) return;
    setUploadingPic(true);
    try {
      const avatarUrl = getDefaultFemaleAvatar(currentUser.uid);
      await updateDoc(doc(db, 'users', currentUser.uid), {
        profile_pic: avatarUrl,
      });
      setUploadNotice('Cute female avatar illustration set as your default!');
      setTimeout(() => setUploadNotice(null), 3000);
    } catch (err: any) {
      console.error('Failed to set female avatar:', err);
    } finally {
      setUploadingPic(false);
    }
  };

  // 2. Create function saveAvatar(url) that ONLY does localStorage.setItem('meetup_avatar', url) and updates the <img> src.
  // Do NOT touch coins, do NOT call Firestore, do NOT call any profile save function.
  const [displayedAvatar, setDisplayedAvatar] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('meetup_avatar') || localStorage.getItem('meetup_user_avatar');
      if (saved && saved.trim()) return saved;
    }
    return getUserAvatarUrl(currentUser);
  });

  const saveAvatar = async (url: string) => {
    if (!url) return;
    if (typeof window !== 'undefined') {
      localStorage.setItem('meetup_avatar', url);
      localStorage.setItem('meetup_user_avatar', url);
    }
    setDisplayedAvatar(url);
    setShowAvatarSheet(false);
    setUploadNotice('Avatar updated successfully!');
    setTimeout(() => setUploadNotice(null), 3000);
  };

  const handleSaveAvatar = (avatarUrl: string) => {
    saveAvatar(avatarUrl);
  };

  // Save updated name to Firestore user profile and sync auth display name
  const handleSaveName = async () => {
    const trimmed = nameInput.trim();
    if (!trimmed || !currentUser) return;
    setSavingName(true);
    try {
      await updateDoc(doc(db, 'users', currentUser.uid), {
        name: trimmed,
      });
      if (auth.currentUser) {
        try {
          await updateProfile(auth.currentUser, { displayName: trimmed });
        } catch {
          // Non-critical if auth display name sync fails
        }
      }
      setIsEditingName(false);
      setUploadNotice('Name updated successfully!');
      setTimeout(() => setUploadNotice(null), 3000);
    } catch (err: any) {
      console.error('Failed to update name in Firestore:', err);
      alert(err.message || 'Failed to update name.');
    } finally {
      setSavingName(false);
    }
  };

  const cdnAvatarUrl = getUserAvatarUrl(currentUser);
  const isCustomUploadedPhoto = !!(
    currentUser?.profile_pic &&
    (currentUser.profile_pic.startsWith('data:image/') ||
      currentUser.profile_pic.startsWith('blob:') ||
      (currentUser.profile_pic.startsWith('http') && !currentUser.profile_pic.includes('dicebear.com')))
  );

  return (
    <div className="space-y-4 pb-24">
      {/* Profile Header Card */}
      <div className="p-5 bg-[#16161C] border border-[#23232C] rounded-3xl relative overflow-hidden">
        <div className="flex items-center gap-4">
          {/* Avatar with photo upload button & bottom sheet trigger */}
          <div 
            onClick={() => {
              setSheetInitialView('menu');
              setShowAvatarSheet(true);
            }}
            className="relative group cursor-pointer"
            title="Change Profile Picture"
          >
            <img
              src={displayedAvatar || cdnAvatarUrl}
              alt={currentUser?.name}
              className="w-16 h-16 rounded-full object-cover border-2 border-[#FF69B4] shadow-[0_0_12px_rgba(255,105,180,0.4)] group-hover:brightness-90 transition"
            />
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setSheetInitialView('menu');
                setShowAvatarSheet(true);
              }}
              disabled={uploadingPic}
              className="absolute -bottom-1 -right-1 p-1.5 rounded-full bg-[#FF69B4] hover:bg-pink-600 text-white shadow-md transition active:scale-95"
              title="Change profile picture"
            >
              <Camera className="w-3.5 h-3.5" />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleProfileImageChange}
            />
          </div>

          <div className="flex-1 min-w-0">
            {isEditingName ? (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSaveName();
                }}
                className="flex items-center gap-1.5 mb-1"
              >
                <input
                  type="text"
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  placeholder="Enter name"
                  maxLength={32}
                  autoFocus
                  disabled={savingName}
                  className="bg-[#0B0B0E] border border-[#FF69B4] rounded-xl px-2.5 py-1 text-sm font-bold text-white focus:outline-none focus:ring-1 focus:ring-[#FF69B4] min-w-0 flex-1 max-w-[170px]"
                />
                <button
                  type="submit"
                  disabled={savingName || !nameInput.trim()}
                  className="p-1.5 rounded-xl bg-[#FF69B4] hover:bg-pink-600 text-white transition active:scale-95 disabled:opacity-50"
                  title="Save name"
                >
                  {savingName ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                </button>
                <button
                  type="button"
                  onClick={() => setIsEditingName(false)}
                  disabled={savingName}
                  className="p-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white transition active:scale-95"
                  title="Cancel"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </form>
            ) : (
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg font-black text-white truncate max-w-[180px]">{currentUser?.name || 'Member'}</h2>
                <button
                  type="button"
                  onClick={() => {
                    setNameInput(currentUser?.name || '');
                    setIsEditingName(true);
                  }}
                  className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition active:scale-95"
                  title="Edit name"
                >
                  <Pencil className="w-3.5 h-3.5 text-[#FF69B4]" />
                </button>
                {isAdmin && (
                  <span className="px-2 py-0.5 rounded-full bg-[#FF69B4]/20 border border-[#FF69B4] text-[#FF69B4] text-[10px] font-bold">
                    Admin
                  </span>
                )}
                {currentUser?.role === 'listener' && (
                  <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-bold flex items-center gap-1">
                    <UserCheck className="w-3 h-3" />
                    Listener
                  </span>
                )}
              </div>
            )}
            <p className="text-xs text-zinc-400 mt-0.5">{currentUser?.email}</p>
            {/* City & Location selector */}
            <div className="mt-1 flex items-center gap-1.5 flex-wrap">
              <MapPin className="w-3.5 h-3.5 text-[#FF69B4] shrink-0" />
              {isEditingCity ? (
                <div className="flex items-center gap-1">
                  <select
                    value={currentUser?.city || 'Chennai'}
                    onChange={async (e) => {
                      const cityName = e.target.value;
                      const cityInfo = findCity(cityName);
                      await updateDoc(doc(db, 'users', currentUser.uid), {
                        city: cityInfo.name,
                        location: `${cityInfo.name}, ${cityInfo.state}`,
                        latitude: cityInfo.lat,
                        longitude: cityInfo.lng,
                      });
                      setIsEditingCity(false);
                      setUploadNotice('City & GPS coordinates saved!');
                      setTimeout(() => setUploadNotice(null), 3000);
                    }}
                    className="bg-[#0B0B0E] border border-[#FF69B4] rounded-lg px-2 py-0.5 text-xs text-white focus:outline-none"
                  >
                    {CITIES.map((c) => (
                      <option key={c.name} value={c.name}>
                        {c.name}, {c.state}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={() => setIsEditingCity(false)}
                    className="p-1 rounded bg-zinc-800 text-zinc-400 hover:text-white text-[10px]"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-1">
                  <span className="text-xs text-zinc-300 font-medium">
                    {currentUser?.city ? `${currentUser.city} (${currentUser.location})` : currentUser?.location || 'Chennai, Tamil Nadu'}
                  </span>
                  <button
                    onClick={() => setIsEditingCity(true)}
                    className="p-0.5 text-[#FF69B4] hover:text-pink-300 transition"
                    title="Change City"
                  >
                    <Pencil className="w-3 h-3" />
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Real Customer Avatar Controls: Upload Real Photo or Choose from 100 Avatars */}
        {currentUser?.role === 'user' && (
          <div className="mt-4 pt-3 border-t border-zinc-800/80 flex flex-wrap items-center justify-between gap-2">
            <div className="text-[11px] text-zinc-400 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#FF69B4]"></span>
              {isCustomUploadedPhoto ? (
                <span>Using <strong className="text-white">Uploaded Photo</strong></span>
              ) : currentUser?.profile_pic?.includes('dicebear.com/7.x/avataaars') ? (
                <span>Using <strong className="text-[#FF69B4]">Cartoon Avatar</strong></span>
              ) : (
                <span>Using <strong className="text-[#FF69B4]">Cute Female Avatar</strong></span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  setSheetInitialView('menu');
                  setShowAvatarSheet(true);
                }}
                disabled={uploadingPic}
                className="px-2.5 py-1 text-[11px] font-semibold rounded-lg bg-[#FF69B4]/15 hover:bg-[#FF69B4]/25 text-[#FF69B4] border border-[#FF69B4]/30 transition flex items-center gap-1"
              >
                <Camera className="w-3 h-3" />
                Change Picture
              </button>
              <button
                onClick={() => {
                  setSheetInitialView('avatars');
                  setShowAvatarSheet(true);
                }}
                disabled={uploadingPic}
                className="px-2.5 py-1 text-[11px] font-semibold rounded-lg bg-[#FF69B4]/15 hover:bg-[#FF69B4]/25 text-[#FF69B4] border border-[#FF69B4]/30 transition flex items-center gap-1 cursor-pointer"
              >
                <Sparkles className="w-3 h-3 text-[#FF69B4]" />
                15 3D Realistic Avatars
              </button>
            </div>
          </div>
        )}

        {/* Listener Availability & Presence Toggle */}
        {currentUser?.role === 'listener' && (
          <div className="mt-4 p-3.5 bg-[#0B0B0E] rounded-2xl border border-zinc-800 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className={`w-2.5 h-2.5 rounded-full ${isCurrentListenerOffline ? 'bg-zinc-500' : 'bg-emerald-400 animate-pulse'}`}></span>
              <div>
                <span className="text-xs font-bold text-white block">
                  Presence Status: {isCurrentListenerOffline ? 'Unavailable (Offline)' : 'Available (Online)'}
                </span>
                <span className="text-[10px] text-zinc-400 block">
                  {isCurrentListenerOffline
                    ? 'Your card is marked Offline in the discovery feed.'
                    : 'Your card is active and accepting incoming calls.'}
                </span>
              </div>
            </div>

            <button
              onClick={handleToggleListenerPresence}
              disabled={updatingPresence}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                isCurrentListenerOffline
                  ? 'bg-emerald-500/20 border border-emerald-500/50 text-emerald-300 hover:bg-emerald-500/30'
                  : 'bg-zinc-800 border border-zinc-700 text-zinc-300 hover:bg-zinc-700'
              }`}
            >
              {updatingPresence
                ? 'Updating...'
                : isCurrentListenerOffline
                ? 'Go Online'
                : 'Set Unavailable'}
            </button>
          </div>
        )}

        {/* Listener Call Preference Toggle (Allow Video Calls ON/OFF) */}
        {currentUser?.role === 'listener' && (
          <div className="mt-3 p-3.5 bg-[#0B0B0E] rounded-2xl border border-zinc-800 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className={`p-2 rounded-xl ${currentUser.allowVideoCalls !== false ? 'bg-[#FF69B4]/20 text-[#FF69B4]' : 'bg-zinc-800 text-zinc-500'}`}>
                <Video className="w-4 h-4" />
              </div>
              <div>
                <span className="text-xs font-bold text-white block">
                  Allow Video Calls: {currentUser.allowVideoCalls !== false ? 'ON' : 'OFF'}
                </span>
                <span className="text-[10px] text-zinc-400 block">
                  {currentUser.allowVideoCalls !== false
                    ? 'Both Audio and Video call buttons are visible on your card & profile.'
                    : 'Audio Only: Video call button is hidden on your card & profile.'}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={async () => {
                const newPref = currentUser.allowVideoCalls === false;
                await updateDoc(doc(db, 'users', currentUser.uid), {
                  allowVideoCalls: newPref,
                });
                setUploadNotice(`Video calls ${newPref ? 'enabled (Audio + Video)' : 'disabled (Audio Only)'}`);
                setTimeout(() => setUploadNotice(null), 3000);
              }}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                currentUser.allowVideoCalls !== false ? 'bg-[#FF69B4]' : 'bg-zinc-700'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                  currentUser.allowVideoCalls !== false ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        )}

        {/* Listener 3D Avatar Picker Row */}
        {currentUser?.role === 'listener' && (
          <div className="mt-3 p-3.5 bg-[#0B0B0E] rounded-2xl border border-zinc-800 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-pink-500/20 text-[#FF69B4]">
                <Sparkles className="w-4 h-4 text-[#FF69B4]" />
              </div>
              <div>
                <span className="text-xs font-bold text-white block">
                  Listener 3D Realistic Avatar
                </span>
                <span className="text-[10px] text-zinc-400 block">
                  Choose from 15 realistic 3D illustrated portraits (10 Female, 5 Male)
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                setSheetInitialView('avatars');
                setShowAvatarSheet(true);
              }}
              className="px-3 py-1.5 rounded-xl bg-[#FF69B4]/20 border border-[#FF69B4]/40 text-[#FF69B4] hover:bg-[#FF69B4]/30 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
            >
              <span>Choose Avatar</span>
            </button>
          </div>
        )}

        {uploadingPic && (
          <div className="mt-3 text-xs text-pink-300 font-medium flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[#FF69B4] animate-ping"></span>
            Uploading photo to Supabase Storage 'photos' bucket...
          </div>
        )}

        {uploadNotice && (
          <div className="mt-3 p-2 bg-emerald-500/20 border border-emerald-500/40 rounded-xl text-emerald-300 text-xs flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{uploadNotice}</span>
          </div>
        )}

        {/* Balance Badges */}
        <div className="grid grid-cols-2 gap-2 mt-4 pt-4 border-t border-zinc-800">
          <div
            onClick={onOpenWallet}
            className="p-3 bg-[#0B0B0E] rounded-2xl border border-zinc-800/80 cursor-pointer hover:border-amber-500/50 transition flex items-center justify-between"
          >
            <div>
              <span className="text-[11px] text-zinc-400 block font-medium">Coin Balance</span>
              <span className="text-lg font-black text-amber-300">
                {loadCoins().toLocaleString()}
              </span>
            </div>
            <div className="w-7 h-7 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center">
              <Coins className="w-4 h-4" />
            </div>
          </div>

          <div className="p-3 bg-[#0B0B0E] rounded-2xl border border-zinc-800/80 flex items-center justify-between">
            <div>
              <span className="text-[11px] text-zinc-400 block font-medium">Diamonds</span>
              <span className="text-lg font-black text-cyan-400">
                {currentUser?.diamonds_balance?.toLocaleString() ?? 0}
              </span>
            </div>
            <div className="w-7 h-7 rounded-full bg-cyan-500/20 text-cyan-400 flex items-center justify-center">
              <Sparkles className="w-4 h-4" />
            </div>
          </div>
        </div>
      </div>

      {/* Dating Profile Details Card (Bio, Age, Gender, Interests) */}
      <div className="p-4 bg-[#16161C] border border-[#23232C] rounded-3xl relative overflow-hidden">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-white">About Me & Dating Profile</span>
            <span className="px-2 py-0.5 rounded-full bg-[#FF69B4]/15 text-[#FF69B4] text-[10px] font-bold">
              {currentUser?.age || 24} yrs • {currentUser?.gender ? currentUser.gender.toUpperCase() : 'OTHER'}
            </span>
          </div>
          {!isEditingBio && (
            <button
              type="button"
              onClick={handleStartEditDetails}
              className="p-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-[#FF69B4] hover:text-white transition flex items-center gap-1 text-xs font-semibold cursor-pointer active:scale-95"
              title="Edit Profile Details"
            >
              <Pencil className="w-3.5 h-3.5" />
              <span>Edit</span>
            </button>
          )}
        </div>

        {isEditingBio ? (
          <form onSubmit={handleSaveDetails} className="space-y-3.5 animate-in fade-in">
            {detailsError && (
              <div className="p-2.5 rounded-xl bg-red-500/15 border border-red-500/30 text-red-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                <span>{detailsError}</span>
              </div>
            )}

            {/* Age & Gender Row */}
            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="text-[11px] font-semibold text-zinc-400 block mb-1">
                  Age <span className="text-zinc-500">(18+)</span>
                </label>
                <input
                  type="number"
                  min="18"
                  max="99"
                  value={ageInput}
                  onChange={(e) => setAgeInput(Number(e.target.value))}
                  className="w-full bg-[#0B0B0E] border border-zinc-700 focus:border-[#FF69B4] rounded-xl px-3 py-2 text-xs text-white outline-none font-bold"
                  required
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-zinc-400 block mb-1">Gender</label>
                <select
                  value={genderInput}
                  onChange={(e) => setGenderInput(e.target.value as any)}
                  className="w-full bg-[#0B0B0E] border border-zinc-700 focus:border-[#FF69B4] rounded-xl px-3 py-2 text-xs text-white outline-none font-bold cursor-pointer"
                >
                  <option value="female">Female</option>
                  <option value="male">Male</option>
                  <option value="other">Other / Non-Binary</option>
                </select>
              </div>
            </div>

            {/* Bio Textarea */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[11px] font-semibold text-zinc-400">Bio / About You</label>
                <span className="text-[10px] text-zinc-500">{bioInput.length}/300</span>
              </div>
              <textarea
                value={bioInput}
                onChange={(e) => setBioInput(e.target.value.slice(0, 300))}
                placeholder="Share a little bit about yourself, what you like talking about..."
                rows={3}
                className="w-full bg-[#0B0B0E] border border-zinc-700 focus:border-[#FF69B4] rounded-xl p-3 text-xs text-white outline-none resize-none placeholder-zinc-500"
                required
              />
            </div>

            {/* Interests Tag Selector */}
            <div>
              <label className="text-[11px] font-semibold text-zinc-400 block mb-1.5">
                Interests & Passions
              </label>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {POPULAR_INTERESTS.map((tag) => {
                  const selected = interestsInput.includes(tag);
                  return (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => handleToggleInterest(tag)}
                      className={`px-2.5 py-1 rounded-xl text-[11px] font-medium transition cursor-pointer ${
                        selected
                          ? 'bg-[#FF69B4] text-white shadow-sm'
                          : 'bg-[#0B0B0E] border border-zinc-800 text-zinc-400 hover:text-zinc-200'
                      }`}
                    >
                      {tag} {selected ? '✓' : '+'}
                    </button>
                  );
                })}
              </div>

              {/* Add Custom Tag */}
              <div className="flex items-center gap-1.5">
                <input
                  type="text"
                  value={customInterest}
                  onChange={(e) => setCustomInterest(e.target.value)}
                  placeholder="Add custom interest..."
                  className="flex-1 bg-[#0B0B0E] border border-zinc-800 rounded-xl px-3 py-1.5 text-xs text-white placeholder-zinc-500 outline-none"
                  maxLength={25}
                />
                <button
                  type="button"
                  onClick={handleAddCustomInterest}
                  className="px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-bold transition cursor-pointer"
                >
                  Add
                </button>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-2 pt-1 border-t border-zinc-800">
              <button
                type="button"
                onClick={() => setIsEditingBio(false)}
                disabled={savingDetails}
                className="px-3.5 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-semibold transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={savingDetails}
                className="px-4 py-2 rounded-xl bg-[#FF69B4] hover:bg-pink-600 text-white text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-md disabled:opacity-60"
              >
                {savingDetails ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>Save Profile</span>
                  </>
                )}
              </button>
            </div>
          </form>
        ) : (
          <div className="space-y-3">
            {/* Bio Display */}
            <p className="text-xs text-zinc-300 leading-relaxed italic bg-[#0B0B0E] p-3 rounded-2xl border border-zinc-800/60">
              "{currentUser?.bio || 'Hey there! Exploring Meet Up.'}"
            </p>

            {/* Interests Chips Display */}
            <div>
              <span className="text-[10px] uppercase tracking-wider font-bold text-zinc-400 block mb-1.5">
                Interests
              </span>
              <div className="flex flex-wrap gap-1.5">
                {(currentUser?.interests && currentUser.interests.length > 0
                  ? currentUser.interests
                  : ['Dating', 'Conversations', 'Music']
                ).map((tag, idx) => (
                  <span
                    key={idx}
                    className="px-2.5 py-1 rounded-xl bg-[#0B0B0E] border border-zinc-800/90 text-zinc-300 text-[11px] font-medium"
                  >
                    #{tag}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Profile Menu Actions */}
      <div className="bg-[#16161C] border border-[#23232C] rounded-3xl divide-y divide-zinc-800/70 overflow-hidden">
        {/* Wallet */}
        <button
          onClick={onOpenWallet}
          className="w-full p-4 flex items-center justify-between text-left hover:bg-[#1E1E26] transition"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400">
              <Coins className="w-4 h-4" />
            </div>
            <div>
              <div className="text-sm font-bold text-white">{t('wallet')}</div>
              <div className="text-[11px] text-zinc-400">Recharge coins for voice & video calls</div>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-zinc-500" />
        </button>

        {/* My Favourites */}
        <button
          onClick={() => setShowFavorites(true)}
          className="w-full p-4 flex items-center justify-between text-left hover:bg-[#1E1E26] transition"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-[#ff4d8d]/20 text-[#ff4d8d]">
              <Heart className="w-4 h-4 fill-[#ff4d8d]" />
            </div>
            <div>
              <div className="text-sm font-bold text-white">My Favourites</div>
              <div className="text-[11px] text-zinc-400">View and call your saved listeners</div>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-zinc-500" />
        </button>

        {/* ZEGOCLOUD Video/Voice Settings - ADMIN ONLY */}
        {currentUser?.role === 'admin' && (
          <button
            onClick={onOpenZegoConfig}
            className="w-full p-4 flex items-center justify-between text-left hover:bg-[#1E1E26] transition"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-[#FF69B4]/20 text-[#FF69B4]">
                <Video className="w-4 h-4" />
              </div>
              <div>
                <div className="text-sm font-bold text-white flex items-center gap-2">
                  <span>ZEGOCLOUD Calling SDK</span>
                  <span className="px-1.5 py-0.5 rounded bg-amber-500/20 border border-amber-500/40 text-amber-300 text-[9px] font-black uppercase">Admin Only</span>
                </div>
                <div className="text-[11px] text-zinc-400">AppID, Server Secret & Screen Share config</div>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-zinc-500" />
          </button>
        )}

        {/* Transactions */}
        <button
          onClick={onOpenTransactions}
          className="w-full p-4 flex items-center justify-between text-left hover:bg-[#1E1E26] transition"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400">
              <Receipt className="w-4 h-4" />
            </div>
            <div>
              <div className="text-sm font-bold text-white">{t('transactions')}</div>
              <div className="text-[11px] text-zinc-400">View recharge payment records</div>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-zinc-500" />
        </button>

        {/* Background Call Notifications (FCM / WhatsApp-style) */}
        <button
          onClick={async () => {
            if (requestPushPermission) {
              await requestPushPermission();
              setUploadNotice('Notification permission requested!');
              setTimeout(() => setUploadNotice(null), 3000);
            }
          }}
          className="w-full p-4 flex items-center justify-between text-left hover:bg-[#1E1E26] transition"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-purple-500/20 text-purple-400">
              <Bell className="w-4 h-4" />
            </div>
            <div>
              <div className="text-sm font-bold text-white flex items-center gap-2">
                <span>Background Call Notifications</span>
                {typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted' && (
                  <span className="px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-[9px] font-bold">
                    Active
                  </span>
                )}
              </div>
              <div className="text-[11px] text-zinc-400">
                {typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted'
                  ? 'FCM background push alerts active (WhatsApp-style)'
                  : 'Tap to enable background incoming call alerts'}
              </div>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-zinc-500" />
        </button>

        {/* Language Switcher */}
        <button
          onClick={onOpenLanguage}
          className="w-full p-4 flex items-center justify-between text-left hover:bg-[#1E1E26] transition"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-blue-500/20 text-blue-400">
              <Globe className="w-4 h-4" />
            </div>
            <div>
              <div className="text-sm font-bold text-white">{t('language')}</div>
              <div className="text-[11px] text-zinc-400">{currentLangLabel} ({lang})</div>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-zinc-500" />
        </button>

        {/* Become a Listener */}
        {currentUser?.role !== 'listener' && (
          <button
            onClick={onOpenListenerApply}
            className="w-full p-4 flex items-center justify-between text-left hover:bg-[#1E1E26] transition"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-[#FF69B4]/20 text-[#FF69B4]">
                <Headphones className="w-4 h-4" />
              </div>
              <div>
                <div className="text-sm font-bold text-white">{t('switchToListener')}</div>
                <div className="text-[11px] text-zinc-400">Apply to earn diamonds from live calls</div>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-zinc-500" />
          </button>
        )}

        {/* Super Owner Control Center */}
        {onOpenOwner && isMeetupOwner(currentUser?.email) && (
          <button
            onClick={onOpenOwner}
            className="w-full p-4 flex items-center justify-between text-left hover:bg-amber-500/10 transition border-l-2 border-amber-500"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400">
                <Crown className="w-4 h-4" />
              </div>
              <div>
                <div className="text-sm font-bold text-amber-300 flex items-center gap-1.5">
                  <span>Meet Up Owner Control</span>
                  <span className="px-1.5 py-0.2 rounded bg-amber-500 text-black text-[9px] font-black uppercase">👑 Super</span>
                </div>
                <div className="text-[11px] text-zinc-400">Live calls, mute/kick, Supabase & APK build</div>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-amber-400" />
          </button>
        )}

        {/* Admin Dashboard if role == admin */}
        {isAdmin && onOpenAdmin && (
          <button
            onClick={onOpenAdmin}
            className="w-full p-4 flex items-center justify-between text-left hover:bg-[#1E1E26] transition"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-purple-500/20 text-purple-400">
                <Shield className="w-4 h-4" />
              </div>
              <div>
                <div className="text-sm font-bold text-white">{t('adminDashboard')}</div>
                <div className="text-[11px] text-zinc-400">Manage users, reports, approvals & revenue</div>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-zinc-500" />
          </button>
        )}

        {/* Help */}
        <button
          onClick={onOpenHelp}
          className="w-full p-4 flex items-center justify-between text-left hover:bg-[#1E1E26] transition"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-cyan-500/20 text-cyan-400">
              <HelpCircle className="w-4 h-4" />
            </div>
            <div className="text-sm font-bold text-white">{t('help')}</div>
          </div>
          <ChevronRight className="w-4 h-4 text-zinc-500" />
        </button>

        {/* Terms */}
        <button
          onClick={onOpenTerms}
          className="w-full p-4 flex items-center justify-between text-left hover:bg-[#1E1E26] transition"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-zinc-700/30 text-zinc-400">
              <FileText className="w-4 h-4" />
            </div>
            <div className="text-sm font-bold text-white">{t('terms')}</div>
          </div>
          <ChevronRight className="w-4 h-4 text-zinc-500" />
        </button>

        {/* Privacy */}
        <button
          onClick={onOpenPrivacy}
          className="w-full p-4 flex items-center justify-between text-left hover:bg-[#1E1E26] transition"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-zinc-700/30 text-zinc-400">
              <Shield className="w-4 h-4" />
            </div>
            <div className="text-sm font-bold text-white">{t('privacy')}</div>
          </div>
          <ChevronRight className="w-4 h-4 text-zinc-500" />
        </button>
      </div>

      {/* Danger Zone & Logout */}
      <div className="space-y-2 pt-2">
        <button
          type="button"
          onClick={handleLogout}
          disabled={isLoggingOut}
          className="w-full p-3.5 rounded-2xl bg-[#16161C] hover:bg-[#202028] border border-[#23232C] text-zinc-300 hover:text-white font-bold text-xs flex items-center justify-center gap-2 transition disabled:opacity-50 cursor-pointer active:scale-98"
        >
          <LogOut className={`w-4 h-4 ${isLoggingOut ? 'animate-spin' : ''}`} />
          {isLoggingOut ? 'Logging out...' : t('logout')}
        </button>

        <button
          onClick={handleDeleteAccount}
          className="w-full p-3.5 rounded-2xl bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 font-bold text-xs flex items-center justify-center gap-2 transition"
        >
          <Trash2 className="w-4 h-4" />
          Delete My Account (Hard Delete)
        </button>
      </div>

      {/* My Favourites Modal */}
      <FavoritesModal
        isOpen={showFavorites}
        onClose={() => setShowFavorites(false)}
        onVoiceCall={onVoiceCall || (() => {})}
        onVideoCall={onVideoCall || (() => {})}
        onOpenProfile={onOpenProfile || (() => {})}
      />

      {/* Profile Picture Change Bottom Sheet (Upload or 100 Avatars) */}
      <AvatarPickerBottomSheet
        isOpen={showAvatarSheet}
        onClose={() => setShowAvatarSheet(false)}
        currentAvatarUrl={displayedAvatar || cdnAvatarUrl}
        onUploadFromDevice={() => {
          setShowAvatarSheet(false);
          fileInputRef.current?.click();
        }}
        onSaveAvatar={saveAvatar}
        initialView={sheetInitialView}
      />
    </div>
  );
};
