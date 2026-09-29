import React, { useEffect, useState } from 'react';
import { 
  Shield, 
  Users, 
  PhoneCall, 
  DollarSign, 
  Flag, 
  Search, 
  X, 
  CheckCircle, 
  Ban, 
  Edit3, 
  Radio, 
  Headphones,
  Check,
  AlertCircle,
  Eye,
  EyeOff,
  Calendar,
  Mail,
  Phone,
  MapPin,
  Coins,
  Video,
  ExternalLink,
  Crown
} from 'lucide-react';
import { 
  collection, 
  getDocs, 
  getDoc,
  doc, 
  updateDoc, 
  setDoc,
  deleteDoc,
  serverTimestamp 
} from 'firebase/firestore';
import { db, auth } from '../firebase/config';
import { useAuth } from '../context/AuthContext';
import { isUserAdmin, isMeetupOwner, ALLOWED_MEETUP_OWNERS } from '../utils/admin';
import { UserProfile, Report, CallLog, ListenerApplication, Transaction } from '../types';
import { getUserAvatarUrl } from '../services/staticCdnService';
import { isListenerOffline } from '../utils/presence';
import { findCity } from '../utils/cities';
import { getRandomListenerAvatar } from '../data/listenerAvatars';

interface AdminDashboardProps {
  onClose: () => void;
  onOpenOwner?: () => void;
}

/**
 * Masks phone number into format: 98XXXXXX10 (first 2 and last 2 visible)
 */
export function maskPhoneNumber(phone?: string): string {
  if (!phone) return 'Not Provided';
  const clean = phone.replace(/\s+/g, '');
  if (clean.length <= 4) return '••••••••';
  const prefix = clean.slice(0, 2);
  const suffix = clean.slice(-2);
  const maskLength = Math.max(clean.length - 4, 4);
  return `${prefix}${'X'.repeat(maskLength)}${suffix}`;
}

/**
 * Formats joined date from Firestore timestamp or string
 */
export function formatJoinedDate(createdAt: any): string {
  if (!createdAt) return 'Recently';
  try {
    if (typeof createdAt?.toDate === 'function') {
      return createdAt.toDate().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
    }
    if (typeof createdAt?.seconds === 'number') {
      return new Date(createdAt.seconds * 1000).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
    }
    const d = new Date(createdAt);
    if (!isNaN(d.getTime())) {
      return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
    }
  } catch {
    // fallback
  }
  return 'Recently';
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ onClose, onOpenOwner }) => {
  const { currentUser } = useAuth();
  const userEmail = currentUser?.email || auth.currentUser?.email;
  const isOwner = isMeetupOwner(userEmail);

  const [activeTab, setActiveTab] = useState<'users' | 'listeners' | 'reports' | 'applications' | 'calls'>('users');
  const [usersList, setUsersList] = useState<UserProfile[]>([]);
  const [reportsList, setReportsList] = useState<Report[]>([]);
  const [applicationsList, setApplicationsList] = useState<ListenerApplication[]>([]);
  const [callLogsList, setCallLogsList] = useState<CallLog[]>([]);
  const [totalRevenue, setTotalRevenue] = useState<number>(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  // Mask toggle state: maps user uid -> boolean (true if revealed)
  const [revealedPhones, setRevealedPhones] = useState<Record<string, boolean>>({});

  // Details popup state
  const [selectedUserDetail, setSelectedUserDetail] = useState<UserProfile | null>(null);

  // Edit coins modal state
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [coinInput, setCoinInput] = useState<number>(0);

  const fetchAdminData = async () => {
    setLoading(true);
    try {
      // 1. Fetch Users
      const usersSnap = await getDocs(collection(db, 'users'));
      const users: UserProfile[] = [];
      usersSnap.forEach((d) => users.push({ uid: d.id, ...d.data() } as UserProfile));
      setUsersList(users);

      // 2. Fetch Reports
      const reportsSnap = await getDocs(collection(db, 'reports'));
      const reps: Report[] = [];
      reportsSnap.forEach((d) => reps.push({ id: d.id, ...d.data() } as Report));
      setReportsList(reps);

      // 3. Fetch Listener Applications
      const appsSnap = await getDocs(collection(db, 'listener_applications'));
      const apps: ListenerApplication[] = [];
      appsSnap.forEach((d) => apps.push({ id: d.id, ...d.data() } as ListenerApplication));
      setApplicationsList(apps);

      // 4. Fetch Call Logs
      const callsSnap = await getDocs(collection(db, 'call_logs'));
      const calls: CallLog[] = [];
      callsSnap.forEach((d) => calls.push({ id: d.id, ...d.data() } as CallLog));
      setCallLogsList(calls);

      // 5. Fetch Total Revenue from Transactions
      const txSnap = await getDocs(collection(db, 'transactions'));
      let rev = 0;
      txSnap.forEach((d) => {
        const tx = d.data() as Transaction;
        if (tx.status === 'success') {
          rev += tx.amount_inr || 0;
        }
      });
      setTotalRevenue(rev);
    } catch (err) {
      console.error('Error fetching admin data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAdminData();
  }, []);

  const togglePhoneReveal = (uid: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setRevealedPhones((prev) => ({
      ...prev,
      [uid]: !prev[uid],
    }));
  };

  const handleToggleBlock = async (user: UserProfile) => {
    const isCurrentlyBlocked = Boolean(user.is_blocked || user.isBlocked);
    const newStatus = !isCurrentlyBlocked;
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        is_blocked: newStatus,
        isBlocked: newStatus,
      });
      setUsersList((prev) =>
        prev.map((u) => (u.uid === user.uid ? { ...u, is_blocked: newStatus, isBlocked: newStatus } : u))
      );
      if (selectedUserDetail?.uid === user.uid) {
        setSelectedUserDetail((prev) => prev ? { ...prev, is_blocked: newStatus, isBlocked: newStatus } : null);
      }
    } catch (err) {
      console.error('Failed to toggle block status:', err);
    }
  };

  const handleTogglePresence = async (user: UserProfile) => {
    const isCurrentlyOffline = isListenerOffline(user);
    const newStatus = isCurrentlyOffline ? 'online' : 'offline';
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        status: newStatus,
        presence_status: newStatus,
        presence: newStatus,
        is_available: newStatus === 'online',
        isOffline: newStatus !== 'online',
      });
      setUsersList((prev) =>
        prev.map((u) =>
          u.uid === user.uid
            ? {
                ...u,
                status: newStatus as any,
                presence_status: newStatus,
                presence: newStatus,
                is_available: newStatus === 'online',
                isOffline: newStatus !== 'online',
              }
            : u
        )
      );
      if (selectedUserDetail?.uid === user.uid) {
        setSelectedUserDetail((prev) =>
          prev
            ? {
                ...prev,
                status: newStatus as any,
                presence_status: newStatus,
                presence: newStatus,
                is_available: newStatus === 'online',
                isOffline: newStatus !== 'online',
              }
            : null
        );
      }
    } catch (err) {
      console.error('Failed to toggle presence:', err);
    }
  };

  const handleSaveCoins = async () => {
    if (!editingUser) return;
    try {
      await updateDoc(doc(db, 'users', editingUser.uid), {
        coins_balance: coinInput,
      });
      setUsersList((prev) =>
        prev.map((u) => (u.uid === editingUser.uid ? { ...u, coins_balance: coinInput } : u))
      );
      if (selectedUserDetail?.uid === editingUser.uid) {
        setSelectedUserDetail((prev) => prev ? { ...prev, coins_balance: coinInput } : null);
      }
      setEditingUser(null);
    } catch (err) {
      console.error('Failed to update coins:', err);
    }
  };

  const handleApproveApplication = async (app: ListenerApplication) => {
    try {
      if (app.id) {
        await updateDoc(doc(db, 'listener_applications', app.id), {
          status: 'approved',
          approved_at: serverTimestamp(),
        });
      }

      const cityData = findCity(app.location || 'Chennai');
      const voiceRate = Number(app.voice_rate) || 10;
      const videoRate = Number(app.video_rate) || 50;

      let assignedPic: string | undefined = undefined;
      try {
        const uSnap = await getDoc(doc(db, 'users', app.user_id));
        if (uSnap.exists()) {
          const uData = uSnap.data();
          const existing = uData.profile_pic || uData.avatar_url || (uData as any).photoURL || (app as any).profile_pic || (app as any).photoURL;
          if (existing && existing.trim() && !existing.includes('randomuser.me')) {
            assignedPic = existing;
          }
        }
      } catch (err) {
        console.warn('Could not read existing user pic:', err);
      }

      if (!assignedPic) {
        assignedPic = getRandomListenerAvatar();
      }

      await setDoc(doc(db, 'users', app.user_id), {
        uid: app.user_id,
        name: app.name || 'Listener',
        role: 'listener',
        is_listener: true,
        status: 'online',
        presence_status: 'available',
        is_available: true,
        isBlocked: false,
        is_blocked: false,
        profile_pic: assignedPic,
        avatar_url: assignedPic,
        photoURL: assignedPic,
        voice_rate: voiceRate,
        audio_rate_coins: voiceRate,
        video_rate: videoRate,
        video_rate_coins: videoRate,
        allowVideoCalls: app.allowVideoCalls !== false,
        languages: app.languages && app.languages.length > 0 ? app.languages : ['Tamil', 'English'],
        language: (app.languages?.[0] || 'Tamil').toLowerCase().slice(0, 2),
        bio: app.experience || 'Friendly listener ready to chat.',
        city: cityData.name,
        location: app.location || `${cityData.name}, Tamil Nadu`,
        latitude: cityData.lat,
        longitude: cityData.lng,
        interests: ['Friendly Chat', 'Deep Talks', 'Music'],
        updated_at: serverTimestamp(),
      }, { merge: true });

      setApplicationsList((prev) =>
        prev.map((a) => (a.id === app.id ? { ...a, status: 'approved' } : a))
      );
      fetchAdminData();
    } catch (e) {
      console.error('Failed to approve application:', e);
    }
  };

  const handleRejectApplication = async (appId?: string) => {
    if (!appId) return;
    try {
      await updateDoc(doc(db, 'listener_applications', appId), {
        status: 'rejected',
      });
      setApplicationsList((prev) =>
        prev.map((a) => (a.id === appId ? { ...a, status: 'rejected' } : a))
      );
    } catch (e) {
      console.error('Failed to reject application:', e);
    }
  };

  const handleDismissReport = async (reportId?: string) => {
    if (!reportId) return;
    try {
      await deleteDoc(doc(db, 'reports', reportId));
      setReportsList((prev) => prev.filter((r) => r.id !== reportId));
    } catch (e) {
      console.error('Failed to dismiss report:', e);
    }
  };

  // Search filter for name or email
  const searchFilter = (u: UserProfile) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const nameMatch = u.name?.toLowerCase().includes(q);
    const emailMatch = u.email?.toLowerCase().includes(q);
    const phoneMatch = u.phone?.toLowerCase().includes(q);
    const locMatch = u.location?.toLowerCase().includes(q);
    return Boolean(nameMatch || emailMatch || phoneMatch || locMatch);
  };

  // Tab 1: Users (role === 'user' or non-listener)
  const regularUsers = usersList.filter((u) => u.role !== 'listener').filter(searchFilter);

  // Tab 2: Listeners (role === 'listener')
  const listenersList = usersList.filter((u) => u.role === 'listener').filter(searchFilter);

  const onlineListenersCount = usersList.filter((u) => u.role === 'listener' && !isListenerOffline(u)).length;

  if (!isUserAdmin(currentUser)) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4">
        <div className="bg-[#16161C] border border-red-500/40 rounded-3xl p-6 text-center max-w-sm">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-3" />
          <h3 className="text-lg font-bold text-white">Access Denied</h3>
          <p className="text-xs text-zinc-400 mt-1">This panel is protected for platform administrators only.</p>
          <button
            onClick={onClose}
            className="mt-4 px-6 py-2 rounded-xl bg-zinc-800 text-white text-xs font-bold cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#0B0B0E] text-white overflow-y-auto">
      {/* Top Navbar */}
      <div className="sticky top-0 z-20 bg-[#16161C]/90 backdrop-blur-md border-b border-[#23232C] px-4 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-[#FF69B4]/20 text-[#FF69B4]">
            <Shield className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-bold text-sm tracking-wide">Meet Up Admin Dashboard</h2>
            <p className="text-[10px] text-zinc-400">Direct Firestore & Firebase Auth Management</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Meetup Owner Controls: strictly restricted to ALLOWED_MEETUP_OWNERS */}
          {isOwner && onOpenOwner && (
            <button
              onClick={onOpenOwner}
              className="px-2.5 py-1 rounded-xl bg-amber-500/20 border border-amber-500/60 text-amber-300 text-xs font-bold flex items-center gap-1.5 hover:bg-amber-500/30 transition cursor-pointer shadow-[0_0_10px_rgba(245,158,11,0.25)]"
              title="Open Meetup Super Owner Controls"
            >
              <Crown className="w-3.5 h-3.5 text-amber-400" />
              <span className="hidden sm:inline">Meetup Owner Controls</span>
              <span className="sm:hidden">Owner</span>
            </button>
          )}

          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-zinc-400 hover:text-white hover:bg-[#23232C] transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="max-w-6xl w-full mx-auto p-4 space-y-4 pb-24">
        {/* Meetup Owner Management Section - ONLY shown if current user's email is in ALLOWED_MEETUP_OWNERS */}
        {isOwner && (
          <div className="p-3.5 sm:p-4 bg-gradient-to-r from-amber-950/40 via-[#16161C] to-amber-950/20 border border-amber-500/50 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-[0_0_20px_rgba(245,158,11,0.15)] animate-in fade-in">
            <div className="flex items-center gap-3">
              <div className="p-2 sm:p-2.5 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/40 shrink-0">
                <Crown className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xs sm:text-sm font-bold text-amber-300 flex items-center gap-2">
                  <span>Meetup Owner Management & Live Controls</span>
                  <span className="px-2 py-0.5 rounded-full bg-amber-500 text-black text-[9px] font-black uppercase tracking-wider">
                    Authorized Owner
                  </span>
                </div>
                <p className="text-[11px] text-zinc-400 mt-0.5">
                  Exclusive access for {ALLOWED_MEETUP_OWNERS.join(' & ')}. Live call monitoring, mute/kick, and Supabase sync.
                </p>
              </div>
            </div>
            {onOpenOwner && (
              <button
                onClick={onOpenOwner}
                className="w-full sm:w-auto px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer shadow-md shrink-0"
              >
                <span>Launch Owner Panel</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}
        {/* Metrics Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-3.5 bg-[#16161C] border border-[#23232C] rounded-2xl">
            <div className="flex items-center justify-between text-zinc-400 mb-1">
              <span className="text-[11px] font-medium">Total Users</span>
              <Users className="w-4 h-4 text-blue-400" />
            </div>
            <span className="text-xl font-black text-white">{usersList.length}</span>
          </div>

          <div className="p-3.5 bg-[#16161C] border border-[#23232C] rounded-2xl">
            <div className="flex items-center justify-between text-zinc-400 mb-1">
              <span className="text-[11px] font-medium">Online Listeners</span>
              <Radio className="w-4 h-4 text-emerald-400 animate-pulse" />
            </div>
            <span className="text-xl font-black text-emerald-400">{onlineListenersCount}</span>
          </div>

          <div className="p-3.5 bg-[#16161C] border border-[#23232C] rounded-2xl">
            <div className="flex items-center justify-between text-zinc-400 mb-1">
              <span className="text-[11px] font-medium">Total Revenue</span>
              <DollarSign className="w-4 h-4 text-amber-400" />
            </div>
            <span className="text-xl font-black text-amber-300">₹{totalRevenue.toLocaleString()}</span>
          </div>

          <div className="p-3.5 bg-[#16161C] border border-[#23232C] rounded-2xl">
            <div className="flex items-center justify-between text-zinc-400 mb-1">
              <span className="text-[11px] font-medium">Calls Logged</span>
              <PhoneCall className="w-4 h-4 text-[#FF69B4]" />
            </div>
            <span className="text-xl font-black text-[#FF69B4]">{callLogsList.length}</span>
          </div>
        </div>

        {/* Tab Navigation: Users, Listeners, Reports, Applications, Calls */}
        <div className="flex items-center gap-1.5 p-1 bg-[#16161C] border border-[#23232C] rounded-2xl overflow-x-auto no-scrollbar">
          <button
            onClick={() => setActiveTab('users')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition shrink-0 cursor-pointer ${
              activeTab === 'users'
                ? 'bg-[#FF69B4] text-white shadow-[0_0_10px_rgba(255,105,180,0.5)]'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            Users ({regularUsers.length})
          </button>

          <button
            onClick={() => setActiveTab('listeners')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition shrink-0 cursor-pointer ${
              activeTab === 'listeners'
                ? 'bg-[#FF69B4] text-white shadow-[0_0_10px_rgba(255,105,180,0.5)]'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            Listeners ({listenersList.length})
          </button>

          <button
            onClick={() => setActiveTab('reports')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition shrink-0 cursor-pointer ${
              activeTab === 'reports'
                ? 'bg-[#FF69B4] text-white shadow-[0_0_10px_rgba(255,105,180,0.5)]'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            Reports ({reportsList.length})
          </button>

          <button
            onClick={() => setActiveTab('applications')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition shrink-0 cursor-pointer ${
              activeTab === 'applications'
                ? 'bg-[#FF69B4] text-white shadow-[0_0_10px_rgba(255,105,180,0.5)]'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            Applications ({applicationsList.length})
          </button>

          <button
            onClick={() => setActiveTab('calls')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition shrink-0 cursor-pointer ${
              activeTab === 'calls'
                ? 'bg-[#FF69B4] text-white shadow-[0_0_10px_rgba(255,105,180,0.5)]'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            Call Logs ({callLogsList.length})
          </button>
        </div>

        {/* Tab 1 (Users) & Tab 2 (Listeners): Table View with 6 columns & search bar */}
        {(activeTab === 'users' || activeTab === 'listeners') && (
          <div className="space-y-3">
            {/* Search Bar */}
            <div className="relative">
              <Search className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={`Search ${activeTab === 'users' ? 'users' : 'listeners'} by name or email ID...`}
                className="w-full bg-[#16161C] border border-[#23232C] rounded-xl pl-10 pr-10 py-2.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-[#FF69B4]"
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

            {/* Table Container */}
            <div className="bg-[#16161C] border border-[#23232C] rounded-2xl overflow-hidden shadow-xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-[#1D1D26] text-zinc-400 font-bold uppercase tracking-wider text-[10px] border-b border-[#2A2A36]">
                      <th className="py-3 px-3.5 w-16 text-center">Profile Pic</th>
                      <th className="py-3 px-3.5">Name</th>
                      <th className="py-3 px-3.5">Email ID</th>
                      <th className="py-3 px-3.5">Mobile Number</th>
                      <th className="py-3 px-3.5">Status</th>
                      <th className="py-3 px-3.5">Joined Date</th>
                      <th className="py-3 px-3.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#23232C]">
                    {(activeTab === 'users' ? regularUsers : listenersList).length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-12 text-center text-zinc-500 text-xs">
                          {loading ? 'Loading records from Firestore...' : `No ${activeTab} found matching search.`}
                        </td>
                      </tr>
                    ) : (
                      (activeTab === 'users' ? regularUsers : listenersList).map((user) => {
                        const isPhoneRevealed = !!revealedPhones[user.uid];
                        const isUserOnline = user.status === 'online' && !isListenerOffline(user);
                        const isAvailable = activeTab === 'listeners' ? isUserOnline : user.status === 'online';

                        return (
                          <tr
                            key={user.uid}
                            onClick={() => setSelectedUserDetail(user)}
                            className="hover:bg-[#1D1D28] transition cursor-pointer group"
                            title="Click to view full user details"
                          >
                            {/* 1. Profile Pic */}
                            <td className="py-3 px-3.5 text-center">
                              <img
                                src={getUserAvatarUrl(user)}
                                alt={user.name}
                                onError={(e) => {
                                  (e.currentTarget as HTMLImageElement).src =
                                    'https://randomuser.me/api/portraits/women/11.jpg';
                                }}
                                className="w-9 h-9 rounded-full object-cover border border-zinc-700 mx-auto"
                              />
                            </td>

                            {/* 2. Name */}
                            <td className="py-3 px-3.5">
                              <div className="font-bold text-white group-hover:text-[#FF69B4] transition flex items-center gap-1.5">
                                <span>{user.name}</span>
                                {user.is_blocked && (
                                  <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-red-500/20 text-red-400">
                                    BANNED
                                  </span>
                                )}
                              </div>
                              <div className="text-[10px] text-zinc-500">{user.location || 'India'}</div>
                            </td>

                            {/* 3. Email ID */}
                            <td className="py-3 px-3.5 font-mono text-zinc-300">
                              {user.email || 'N/A'}
                            </td>

                            {/* 4. Mobile Number (show masked like 98XXXXXX10, click to reveal full) */}
                            <td className="py-3 px-3.5" onClick={(e) => e.stopPropagation()}>
                              <button
                                type="button"
                                onClick={(e) => togglePhoneReveal(user.uid, e)}
                                className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-[#20202C] hover:bg-[#282838] border border-zinc-700/60 font-mono text-[11px] text-zinc-200 transition cursor-pointer"
                                title={isPhoneRevealed ? 'Click to mask phone' : 'Click to reveal full phone'}
                              >
                                <span>
                                  {isPhoneRevealed
                                    ? (user.phone || 'N/A')
                                    : maskPhoneNumber(user.phone)}
                                </span>
                                {isPhoneRevealed ? (
                                  <EyeOff className="w-3.5 h-3.5 text-zinc-400" />
                                ) : (
                                  <Eye className="w-3.5 h-3.5 text-[#FF69B4]" />
                                )}
                              </button>
                            </td>

                            {/* 5. Status (Available / Not Available) */}
                            <td className="py-3 px-3.5">
                              {isAvailable ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 border border-emerald-500/40 text-emerald-400">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                                  Available
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-zinc-800 text-zinc-400 border border-zinc-700">
                                  <span className="w-1.5 h-1.5 rounded-full bg-zinc-500"></span>
                                  Not Available
                                </span>
                              )}
                            </td>

                            {/* 6. Joined Date */}
                            <td className="py-3 px-3.5 text-zinc-400 font-medium">
                              {formatJoinedDate(user.created_at)}
                            </td>

                            {/* Actions */}
                            <td className="py-3 px-3.5 text-right" onClick={(e) => e.stopPropagation()}>
                              <div className="flex items-center justify-end gap-1.5">
                                {user.role === 'listener' && (
                                  <button
                                    onClick={() => handleTogglePresence(user)}
                                    className={`p-1.5 rounded-lg text-xs transition ${
                                      isListenerOffline(user)
                                        ? 'bg-zinc-800 hover:bg-zinc-700 text-zinc-400'
                                        : 'bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30'
                                    }`}
                                    title={isListenerOffline(user) ? 'Set Available' : 'Set Not Available'}
                                  >
                                    <Radio className="w-3.5 h-3.5" />
                                  </button>
                                )}

                                <button
                                  onClick={() => {
                                    setEditingUser(user);
                                    setCoinInput(user.coins_balance || 0);
                                  }}
                                  className="p-1.5 rounded-lg bg-[#242432] hover:bg-[#303042] text-zinc-300 transition"
                                  title="Edit Coins"
                                >
                                  <Edit3 className="w-3.5 h-3.5" />
                                </button>

                                <button
                                  onClick={() => handleToggleBlock(user)}
                                  className={`p-1.5 rounded-lg transition ${
                                    user.is_blocked
                                      ? 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30'
                                      : 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
                                  }`}
                                  title={user.is_blocked ? 'Unban User' : 'Ban User'}
                                >
                                  <Ban className="w-3.5 h-3.5" />
                                </button>

                                <button
                                  onClick={() => setSelectedUserDetail(user)}
                                  className="px-2 py-1 rounded-lg bg-[#FF69B4]/15 hover:bg-[#FF69B4]/25 text-[#FF69B4] text-[11px] font-semibold transition"
                                >
                                  Details
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Tab 3: Reports */}
        {activeTab === 'reports' && (
          <div className="space-y-3">
            {reportsList.length === 0 ? (
              <div className="py-12 text-center bg-[#16161C] rounded-2xl p-6 text-zinc-400 text-xs">
                No user reports recorded. Platform is safe!
              </div>
            ) : (
              reportsList.map((report) => (
                <div
                  key={report.id}
                  className="p-4 bg-[#16161C] border border-[#23232C] rounded-2xl space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Flag className="w-4 h-4 text-red-400" />
                      <span className="text-xs font-bold text-red-400">{report.reason}</span>
                    </div>
                    <span className="text-[10px] text-zinc-500">
                      Reporter: {report.reporter_name || report.reporter_id}
                    </span>
                  </div>

                  <p className="text-xs text-white">
                    Reported User: <span className="font-bold text-[#FF69B4]">{report.reported_name || report.reported_id}</span>
                  </p>
                  {report.description && (
                    <p className="text-xs text-zinc-400 bg-[#0B0B0E] p-2.5 rounded-xl border border-zinc-800">
                      "{report.description}"
                    </p>
                  )}

                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      onClick={() => handleDismissReport(report.id)}
                      className="px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-xs text-zinc-300 transition cursor-pointer"
                    >
                      Dismiss
                    </button>
                    <button
                      onClick={async () => {
                        await updateDoc(doc(db, 'users', report.reported_id), { is_blocked: true, isBlocked: true });
                        alert(`User ${report.reported_name || report.reported_id} blocked.`);
                      }}
                      className="px-3 py-1.5 rounded-xl bg-red-500 hover:bg-red-600 text-xs font-bold text-white transition cursor-pointer"
                    >
                      Ban User
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Tab 4: Listener Applications */}
        {activeTab === 'applications' && (
          <div className="space-y-3">
            {applicationsList.length === 0 ? (
              <div className="py-12 text-center bg-[#16161C] rounded-2xl p-6 text-zinc-400 text-xs">
                No listener applications pending.
              </div>
            ) : (
              applicationsList.map((app) => (
                <div
                  key={app.id}
                  className="p-4 bg-[#16161C] border border-[#23232C] rounded-2xl space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Headphones className="w-4 h-4 text-[#FF69B4]" />
                      <span className="text-xs font-bold text-white">{app.name || 'Applicant'}</span>
                    </div>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                      app.status === 'approved'
                        ? 'bg-emerald-500/20 text-emerald-400'
                        : app.status === 'rejected'
                        ? 'bg-red-500/20 text-red-400'
                        : 'bg-amber-500/20 text-amber-400'
                    }`}>
                      {app.status}
                    </span>
                  </div>

                  <div className="text-xs text-zinc-400 space-y-1">
                    <div><span className="text-zinc-500">Languages:</span> {app.languages?.join(', ')}</div>
                    <div>
                      <span className="text-zinc-500">Proposed Rates:</span> {app.voice_rate} Voice / {app.video_rate} Video coins/min
                    </div>
                    <div>
                      <span className="text-zinc-500">Allow Video Calls:</span> {app.allowVideoCalls !== false ? 'YES (Audio + Video)' : 'NO (Audio Only)'}
                    </div>
                    {app.experience && (
                      <p className="bg-[#0B0B0E] p-2.5 rounded-xl border border-zinc-800 text-zinc-300">
                        {app.experience}
                      </p>
                    )}
                  </div>

                  {app.status === 'pending' && (
                    <div className="flex justify-end gap-2 pt-1">
                      <button
                        onClick={() => handleRejectApplication(app.id)}
                        className="px-3 py-1.5 rounded-xl bg-zinc-800 text-xs font-semibold text-zinc-300 hover:text-white cursor-pointer"
                      >
                        Reject
                      </button>
                      <button
                        onClick={() => handleApproveApplication(app)}
                        className="px-4 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-xs font-bold text-white transition flex items-center gap-1 shadow-sm cursor-pointer"
                      >
                        <Check className="w-3.5 h-3.5" />
                        Approve as Listener
                      </button>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {/* Tab 5: Call Logs */}
        {activeTab === 'calls' && (
          <div className="space-y-2">
            {callLogsList.length === 0 ? (
              <div className="py-12 text-center bg-[#16161C] rounded-2xl p-6 text-zinc-400 text-xs">
                No calls recorded yet.
              </div>
            ) : (
              callLogsList.map((c) => (
                <div
                  key={c.id}
                  className="p-3 bg-[#16161C] border border-[#23232C] rounded-2xl flex items-center justify-between text-xs"
                >
                  <div>
                    <span className="font-bold text-white">{c.caller_name || 'Caller'}</span>
                    <span className="text-zinc-400"> called </span>
                    <span className="font-bold text-[#FF69B4]">{c.receiver_name || 'Listener'}</span>
                    <div className="text-[10px] text-zinc-500 mt-0.5">
                      Type: {c.type?.toUpperCase()} • Duration: {c.duration_sec || 0}s
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-bold text-amber-300 block">{c.coins_spent || 0} coins</span>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* User Details Popup (Requirement 1: Click on user opens details popup) */}
      {selectedUserDetail && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-in fade-in"
          onClick={() => setSelectedUserDetail(null)}
        >
          <div
            className="w-full max-w-md bg-[#16161E] border border-[#2A2A3A] rounded-3xl p-5 shadow-2xl relative space-y-4 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div className="flex items-center gap-3">
                <img
                  src={getUserAvatarUrl(selectedUserDetail)}
                  alt={selectedUserDetail.name}
                  className="w-12 h-12 rounded-full object-cover border-2 border-[#FF69B4]"
                />
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-white text-base">{selectedUserDetail.name}</h3>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                      selectedUserDetail.role === 'listener'
                        ? 'bg-emerald-500/20 text-emerald-400'
                        : selectedUserDetail.role === 'admin'
                        ? 'bg-purple-500/20 text-purple-400'
                        : 'bg-zinc-800 text-zinc-300'
                    }`}>
                      {selectedUserDetail.role}
                    </span>
                  </div>
                  <p className="text-xs text-zinc-400">UID: {selectedUserDetail.uid.slice(0, 12)}...</p>
                </div>
              </div>

              <button
                onClick={() => setSelectedUserDetail(null)}
                className="p-1.5 rounded-full text-zinc-400 hover:text-white hover:bg-zinc-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* User Details Grid */}
            <div className="grid grid-cols-2 gap-2.5 text-xs">
              <div className="p-3 rounded-xl bg-[#0F0F14] border border-zinc-800 space-y-0.5">
                <span className="text-[10px] text-zinc-500 font-semibold uppercase flex items-center gap-1">
                  <Mail className="w-3 h-3 text-blue-400" /> Email ID
                </span>
                <p className="font-mono text-zinc-200 truncate" title={selectedUserDetail.email}>
                  {selectedUserDetail.email || 'N/A'}
                </p>
              </div>

              <div className="p-3 rounded-xl bg-[#0F0F14] border border-zinc-800 space-y-0.5">
                <span className="text-[10px] text-zinc-500 font-semibold uppercase flex items-center gap-1">
                  <Phone className="w-3 h-3 text-emerald-400" /> Mobile Number
                </span>
                <p className="font-mono font-bold text-white">
                  {selectedUserDetail.phone || 'N/A'}
                </p>
              </div>

              <div className="p-3 rounded-xl bg-[#0F0F14] border border-zinc-800 space-y-0.5">
                <span className="text-[10px] text-zinc-500 font-semibold uppercase flex items-center gap-1">
                  <Radio className="w-3 h-3 text-emerald-400" /> Status
                </span>
                <p className="font-semibold">
                  {selectedUserDetail.status === 'online' && !isListenerOffline(selectedUserDetail) ? (
                    <span className="text-emerald-400">Available (Online)</span>
                  ) : (
                    <span className="text-zinc-400">Not Available (Offline)</span>
                  )}
                </p>
              </div>

              <div className="p-3 rounded-xl bg-[#0F0F14] border border-zinc-800 space-y-0.5">
                <span className="text-[10px] text-zinc-500 font-semibold uppercase flex items-center gap-1">
                  <Calendar className="w-3 h-3 text-amber-400" /> Joined Date
                </span>
                <p className="text-zinc-200">
                  {formatJoinedDate(selectedUserDetail.created_at)}
                </p>
              </div>

              <div className="p-3 rounded-xl bg-[#0F0F14] border border-zinc-800 space-y-0.5">
                <span className="text-[10px] text-zinc-500 font-semibold uppercase flex items-center gap-1">
                  <MapPin className="w-3 h-3 text-[#FF69B4]" /> City & State
                </span>
                <p className="text-zinc-200 truncate">
                  {selectedUserDetail.city || selectedUserDetail.location || 'Chennai, Tamil Nadu'}
                </p>
              </div>

              <div className="p-3 rounded-xl bg-[#0F0F14] border border-zinc-800 space-y-0.5">
                <span className="text-[10px] text-zinc-500 font-semibold uppercase flex items-center gap-1">
                  <Coins className="w-3 h-3 text-amber-400" /> Balances
                </span>
                <p className="text-amber-300 font-bold">
                  {selectedUserDetail.coins_balance || 0} Coins • {selectedUserDetail.diamonds_balance || 0} Dia
                </p>
              </div>
            </div>

            {/* Listener Specific Preferences */}
            {selectedUserDetail.role === 'listener' && (
              <div className="p-3 bg-[#0F0F14] border border-zinc-800 rounded-2xl space-y-1.5 text-xs">
                <span className="text-[10px] text-zinc-500 font-bold uppercase">Listener Settings</span>
                <div className="flex items-center justify-between text-zinc-300">
                  <span>Allow Video Calls:</span>
                  <span className={`font-bold ${selectedUserDetail.allowVideoCalls !== false ? 'text-emerald-400' : 'text-amber-400'}`}>
                    {selectedUserDetail.allowVideoCalls !== false ? 'YES (Audio + Video)' : 'NO (Audio Only)'}
                  </span>
                </div>
                <div className="flex items-center justify-between text-zinc-300">
                  <span>Call Rates:</span>
                  <span className="text-amber-300 font-bold">
                    {selectedUserDetail.audio_rate_coins || selectedUserDetail.voice_rate || 10} Voice / {selectedUserDetail.video_rate_coins || selectedUserDetail.video_rate || 50} Video coins/m
                  </span>
                </div>
              </div>
            )}

            {/* Bio if any */}
            {selectedUserDetail.bio && (
              <div className="p-3 bg-[#0F0F14] border border-zinc-800 rounded-2xl text-xs text-zinc-300">
                <span className="text-[10px] text-zinc-500 font-bold uppercase block mb-1">Bio</span>
                <p>{selectedUserDetail.bio}</p>
              </div>
            )}

            {/* Admin Action Buttons */}
            <div className="flex flex-wrap gap-2 pt-2 border-t border-zinc-800">
              {selectedUserDetail.role === 'listener' && (
                <button
                  type="button"
                  onClick={() => handleTogglePresence(selectedUserDetail)}
                  className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                    isListenerOffline(selectedUserDetail)
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 hover:bg-emerald-500/30'
                      : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                  }`}
                >
                  <Radio className="w-3.5 h-3.5" />
                  <span>{isListenerOffline(selectedUserDetail) ? 'Make Available' : 'Make Unavailable'}</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  setEditingUser(selectedUserDetail);
                  setCoinInput(selectedUserDetail.coins_balance || 0);
                }}
                className="flex-1 py-2.5 px-3 rounded-xl bg-[#23232C] hover:bg-[#2F2F3D] text-white text-xs font-bold flex items-center justify-center gap-1.5 transition"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>Edit Coins</span>
              </button>

              <button
                type="button"
                onClick={() => handleToggleBlock(selectedUserDetail)}
                className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                  selectedUserDetail.is_blocked
                    ? 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30'
                    : 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
                }`}
              >
                <Ban className="w-3.5 h-3.5" />
                <span>{selectedUserDetail.is_blocked ? 'Unban User' : 'Ban User'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Coins Modal */}
      {editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <div className="bg-[#16161C] border border-[#23232C] rounded-2xl p-5 w-full max-w-xs space-y-4">
            <h4 className="text-sm font-bold text-white">Edit Coin Balance for {editingUser.name}</h4>
            <input
              type="number"
              value={coinInput}
              onChange={(e) => setCoinInput(Number(e.target.value))}
              className="w-full bg-[#0B0B0E] border border-zinc-700 rounded-xl px-3 py-2 text-sm text-white font-bold"
            />
            <div className="flex gap-2">
              <button
                onClick={() => setEditingUser(null)}
                className="flex-1 py-2 rounded-xl bg-[#23232C] text-xs font-semibold text-zinc-300 cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveCoins}
                className="flex-1 py-2 rounded-xl bg-[#FF69B4] text-xs font-bold text-white cursor-pointer"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
