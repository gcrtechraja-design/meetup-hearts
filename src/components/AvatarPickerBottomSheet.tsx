import React, { useState, useEffect, useMemo } from 'react';
import { 
  X, 
  Upload, 
  Sparkles, 
  Check, 
  ArrowLeft, 
  Loader2, 
  Search,
  CheckCircle2,
  Heart,
  Shuffle,
  UserCheck
} from 'lucide-react';
import { 
  LISTENER_AVATARS, 
  ListenerAvatarItem, 
  getConsistentListenerAvatar, 
  getRandomListenerAvatar, 
  getListenerAvatarById 
} from '../data/listenerAvatars';

interface AvatarPickerBottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  currentAvatarUrl?: string;
  onUploadFromDevice: () => void;
  onSaveAvatar: (avatarUrl: string) => Promise<void>;
  initialView?: 'menu' | 'avatars';
}

export const AvatarPickerBottomSheet: React.FC<AvatarPickerBottomSheetProps> = ({
  isOpen,
  onClose,
  currentAvatarUrl,
  onUploadFromDevice,
  onSaveAvatar,
  initialView = 'menu',
}) => {
  const [viewMode, setViewMode] = useState<'menu' | 'avatars'>(initialView);
  const [selectedAvatar, setSelectedAvatar] = useState<ListenerAvatarItem>(LISTENER_AVATARS[0]);
  const [saving, setSaving] = useState<boolean>(false);
  const [selectedGender, setSelectedGender] = useState<'all' | 'female' | 'male'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Extract initial avatar from current URL if applicable
  useEffect(() => {
    if (isOpen) {
      setViewMode(initialView);
      if (currentAvatarUrl) {
        const found = LISTENER_AVATARS.find((a) => a.url === currentAvatarUrl || currentAvatarUrl.includes(`avatar_${a.id}`));
        if (found) {
          setSelectedAvatar(found);
          return;
        }
      }
      setSelectedAvatar(LISTENER_AVATARS[0]);
    }
  }, [isOpen, initialView, currentAvatarUrl]);

  const handleSelectAvatar = (avatar: ListenerAvatarItem) => {
    setSelectedAvatar(avatar);
  };

  const handleRandomPick = () => {
    const pool = selectedGender === 'all' 
      ? LISTENER_AVATARS 
      : LISTENER_AVATARS.filter((a) => a.gender === selectedGender);
    const randomIndex = Math.floor(Math.random() * pool.length);
    setSelectedAvatar(pool[randomIndex]);
  };

  const handleConfirmSave = async () => {
    if (!selectedAvatar?.url) return;
    setSaving(true);
    try {
      await onSaveAvatar(selectedAvatar.url);
      onClose();
    } catch (err) {
      console.error('Failed to save avatar:', err);
    } finally {
      setSaving(false);
    }
  };

  // Filter avatars based on gender and search query
  const filteredAvatars = useMemo(() => {
    return LISTENER_AVATARS.filter((avatar) => {
      if (selectedGender !== 'all' && avatar.gender !== selectedGender) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesName = avatar.name.toLowerCase().includes(q);
        const matchesStyle = avatar.style.toLowerCase().includes(q);
        const matchesGender = avatar.gender.toLowerCase().includes(q);
        const matchesId = `avatar ${avatar.id}`.includes(q) || `${avatar.id}` === q;
        return matchesName || matchesStyle || matchesGender || matchesId;
      }
      return true;
    });
  }, [selectedGender, searchQuery]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center p-0 sm:p-4 animate-in fade-in">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/85 backdrop-blur-sm transition-opacity"
        onClick={saving ? undefined : onClose}
      />

      {/* Bottom Sheet Modal Container */}
      <div className="relative w-full max-w-xl bg-[#141419] border border-[#23232C] rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col max-h-[92vh] z-10 overflow-hidden animate-in slide-in-from-bottom-6 duration-200">
        {/* Drag Handle Bar for Mobile */}
        <div className="w-12 h-1.5 bg-zinc-700/60 rounded-full mx-auto mt-3 mb-1 shrink-0 sm:hidden" />

        {/* View: Menu View (Choose upload or avatars) */}
        {viewMode === 'menu' && (
          <div className="p-6 space-y-6">
            <div className="flex items-center justify-between pb-2 border-b border-[#23232C]">
              <div>
                <h3 className="text-lg font-black text-white flex items-center gap-2">
                  <span>Profile Photo</span>
                  <Sparkles className="w-4 h-4 text-[#FF69B4]" />
                </h3>
                <p className="text-xs text-zinc-400 mt-0.5">Upload your own photo or choose a 3D realistic avatar</p>
              </div>
              <button
                onClick={onClose}
                className="p-2 rounded-full text-zinc-400 hover:text-white hover:bg-zinc-800 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Current Avatar Mini Preview */}
            {currentAvatarUrl && (
              <div className="flex items-center gap-3.5 p-3.5 bg-[#0B0B0E] rounded-2xl border border-zinc-800/80">
                <img
                  src={currentAvatarUrl}
                  alt="Current Avatar"
                  className="w-14 h-14 rounded-2xl object-cover border-2 border-[#FF69B4] shadow-[0_0_12px_rgba(255,105,180,0.3)] bg-zinc-900"
                />
                <div className="flex-1">
                  <span className="text-xs font-bold text-white block">Current Avatar</span>
                  <span className="text-[11px] text-zinc-400 block mt-0.5">Select a 3D illustrated realistic portrait or upload from device</span>
                </div>
              </div>
            )}

            {/* Main Action Cards */}
            <div className="grid grid-cols-1 gap-3.5">
              {/* Option 1: Choose 3D Avatar */}
              <button
                onClick={() => setViewMode('avatars')}
                className="w-full p-4 rounded-2xl bg-gradient-to-r from-[#1E1B2E] to-[#251A2C] border border-[#FF69B4]/30 hover:border-[#FF69B4] hover:shadow-[0_0_20px_rgba(255,105,180,0.25)] transition-all flex items-center gap-4 text-left group active:scale-[0.99] cursor-pointer"
              >
                <div className="w-13 h-13 rounded-2xl bg-gradient-to-tr from-[#FF69B4] via-pink-500 to-purple-500 flex items-center justify-center text-white shadow-[0_0_16px_rgba(255,105,180,0.4)] shrink-0 group-hover:scale-105 transition-transform">
                  <Sparkles className="w-6 h-6" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-white group-hover:text-[#FF69B4] transition flex items-center gap-1.5">
                      <span>Choose 3D Realistic Avatar</span>
                      <span className="text-xs">✨</span>
                    </span>
                    <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-[#FF69B4]/20 text-[#FF69B4] border border-[#FF69B4]/40">
                      15 Unique Avatars
                    </span>
                  </div>
                  <p className="text-xs text-zinc-300 mt-1 leading-relaxed">
                    10 Indian female & 5 Indian male realistic 3D illustrated portraits (Saree, Kurti, Salwar, Shirts)
                  </p>
                </div>
              </button>

              {/* Option 2: Upload from device */}
              <button
                onClick={() => {
                  onUploadFromDevice();
                  onClose();
                }}
                className="w-full p-4 rounded-2xl bg-[#1A1A22] border border-[#2E2E3A] hover:border-zinc-500 hover:bg-[#20202B] transition-all flex items-center gap-4 text-left group active:scale-[0.99] cursor-pointer"
              >
                <div className="w-13 h-13 rounded-2xl bg-zinc-800 border border-zinc-700 flex items-center justify-center text-zinc-300 group-hover:text-white shrink-0 group-hover:scale-105 transition-transform">
                  <Upload className="w-6 h-6" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-zinc-200 group-hover:text-white transition">
                      Upload from Device
                    </span>
                    <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-400 border border-zinc-700">
                      Gallery
                    </span>
                  </div>
                  <p className="text-xs text-zinc-400 mt-1">
                    Select an image file from your camera or photo gallery (JPG, PNG)
                  </p>
                </div>
              </button>
            </div>

            <div className="pt-1">
              <button
                onClick={onClose}
                className="w-full py-3 rounded-2xl bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white text-xs font-bold transition cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* View: Avatar Grid View (15 3D Realistic Avatars) */}
        {viewMode === 'avatars' && (
          <div className="flex flex-col h-full max-h-[90vh]">
            {/* Header */}
            <div className="p-4 px-5 border-b border-[#23232C] flex items-center justify-between shrink-0 bg-[#141419]">
              <div className="flex items-center gap-2.5">
                <button
                  onClick={() => setViewMode('menu')}
                  className="p-1.5 -ml-1 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-800 transition cursor-pointer"
                  title="Back to options"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <div>
                  <h3 className="text-base font-black text-white flex items-center gap-2">
                    <span>3D Realistic Avatars</span>
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-[#FF69B4]/20 text-[#FF69B4] border border-[#FF69B4]/40">
                      15 Unique
                    </span>
                  </h3>
                  <p className="text-[11px] text-zinc-400">Warm friendly 3D portraits with soft studio lighting</p>
                </div>
              </div>
              <button
                onClick={onClose}
                disabled={saving}
                className="p-2 rounded-full text-zinc-400 hover:text-white hover:bg-zinc-800 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Selected Avatar Preview Bar */}
            <div className="p-3.5 px-5 bg-[#0B0B0E] border-b border-zinc-800/80 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3.5">
                <div className="relative">
                  <img
                    src={selectedAvatar.url}
                    alt={selectedAvatar.name}
                    className="w-14 h-14 rounded-2xl bg-zinc-900 border-2 border-[#FF69B4] shadow-[0_0_16px_rgba(255,105,180,0.5)] object-cover"
                  />
                  <span className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-[#FF69B4] text-white flex items-center justify-center text-[10px] font-bold shadow">
                    <Check className="w-3 h-3" />
                  </span>
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-white flex items-center gap-1.5">
                      {selectedAvatar.name}
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        selectedAvatar.gender === 'female' 
                          ? 'bg-pink-500/20 text-pink-300 border border-pink-500/40' 
                          : 'bg-blue-500/20 text-blue-300 border border-blue-500/40'
                      }`}>
                        {selectedAvatar.gender === 'female' ? 'Female' : 'Male'}
                      </span>
                    </span>
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-zinc-800 text-zinc-400">
                      #{selectedAvatar.id}
                    </span>
                  </div>
                  <span className="text-[11px] text-zinc-400 font-medium block mt-0.5">
                    {selectedAvatar.style}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleRandomPick}
                  className="p-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white transition cursor-pointer"
                  title="Random avatar"
                >
                  <Shuffle className="w-4 h-4" />
                </button>
                <button
                  onClick={handleConfirmSave}
                  disabled={saving}
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-[#FF69B4] to-pink-600 hover:brightness-110 active:scale-95 text-white text-xs font-bold shadow-[0_0_15px_rgba(255,105,180,0.4)] transition flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                >
                  {saving ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Select Avatar</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Filter Tabs & Search */}
            <div className="p-2.5 px-4 bg-[#141419] border-b border-zinc-800/60 flex items-center justify-between gap-2 shrink-0">
              <div className="flex items-center gap-1.5">
                {(
                  [
                    { id: 'all', label: 'All (15)' },
                    { id: 'female', label: 'Female (10)' },
                    { id: 'male', label: 'Male (5)' },
                  ] as const
                ).map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setSelectedGender(tab.id)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition cursor-pointer ${
                      selectedGender === tab.id
                        ? 'bg-[#FF69B4] text-white shadow-[0_0_12px_rgba(255,105,180,0.35)]'
                        : 'bg-zinc-800/80 text-zinc-400 hover:text-white hover:bg-zinc-800'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              <div className="relative w-36 sm:w-44">
                <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search name/style..."
                  className="w-full bg-[#1C1C24] border border-zinc-800 focus:border-[#FF69B4] rounded-xl pl-8 pr-6 py-1.5 text-[11px] text-white placeholder-zinc-500 outline-none transition"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>

            {/* 15 3D Realistic Avatars Grid */}
            <div className="flex-1 overflow-y-auto p-4 scrollbar-thin scrollbar-thumb-zinc-700 bg-[#0E0E12]">
              <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
                {filteredAvatars.map((avatar) => {
                  const isSelected = selectedAvatar.id === avatar.id;

                  return (
                    <button
                      key={avatar.id}
                      type="button"
                      onClick={() => handleSelectAvatar(avatar)}
                      className={`relative rounded-2xl p-2 transition-all flex flex-col items-center justify-between group cursor-pointer ${
                        isSelected
                          ? 'bg-[#FF69B4]/15 border-2 border-[#FF69B4] ring-2 ring-[#FF69B4]/40 shadow-[0_0_20px_rgba(255,105,180,0.35)] scale-[0.98]'
                          : 'bg-[#181820] border border-zinc-800/90 hover:border-pink-500/50 hover:bg-[#201D28]'
                      }`}
                    >
                      {/* Avatar Image Container */}
                      <div className="relative w-full aspect-square rounded-xl overflow-hidden bg-zinc-900 flex items-center justify-center">
                        <img
                          src={avatar.url}
                          alt={avatar.name}
                          loading="lazy"
                          className="w-full h-full object-cover rounded-xl transition-transform duration-200 group-hover:scale-105"
                        />
                      </div>

                      {/* Name & Style Label */}
                      <div className="w-full text-center mt-2">
                        <span className={`text-xs font-bold truncate block ${
                          isSelected ? 'text-[#FF69B4]' : 'text-zinc-200 group-hover:text-white'
                        }`}>
                          {avatar.name}
                        </span>
                        <span className="text-[10px] text-zinc-400 truncate block mt-0.5">
                          {avatar.style}
                        </span>
                      </div>

                      {/* Selected Checkmark Badge */}
                      {isSelected && (
                        <div className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-[#FF69B4] text-white flex items-center justify-center shadow-md">
                          <Check className="w-3 h-3" />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>

              {filteredAvatars.length === 0 && (
                <div className="py-12 text-center text-zinc-500 text-xs">
                  <span>No avatars matched "{searchQuery}".</span>
                </div>
              )}
            </div>

            {/* Bottom Footer Action */}
            <div className="p-3.5 px-5 bg-[#141419] border-t border-[#23232C] flex items-center justify-between shrink-0">
              <span className="text-xs text-zinc-400">
                Selected: <strong className="text-white">{selectedAvatar.name}</strong> ({selectedAvatar.style})
              </span>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setViewMode('menu')}
                  disabled={saving}
                  className="px-3.5 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-semibold transition cursor-pointer"
                >
                  Back
                </button>
                <button
                  onClick={handleConfirmSave}
                  disabled={saving}
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-[#FF69B4] to-pink-600 hover:brightness-110 active:scale-95 text-white text-xs font-bold shadow-[0_0_15px_rgba(255,105,180,0.4)] transition flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                >
                  {saving ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>Set as Avatar</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
