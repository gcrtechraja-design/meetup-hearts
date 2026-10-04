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
  Crown,
  Copy,
  CreditCard,
  Settings,
  Loader2
} from 'lucide-react';
import { 
  collection, 
  getDocs, 
  getDoc,
  doc, 
  updateDoc, 
  setDoc,
  deleteDoc,
  serverTimestamp,
  query,
  where
} from 'firebase/firestore';
import { db, auth } from '../firebase/config';
import { useAuth } from '../context/AuthContext';
import { isUserAdmin, isMeetupOwner, ALLOWED_MEETUP_OWNERS } from '../utils/admin';
import { UserProfile, Report, CallLog, ListenerApplication, Transaction } from '../types';
import { getUserAvatarUrl } from '../services/staticCdnService';
import { isListenerOffline } from '../utils/presence';
import { findCity } from '../utils/cities';
import { getRandomListenerAvatar } from '../data/listenerAvatars';
import { REAL_LISTENERS, SEED_LISTENERS } from '../firebase/seed';
import { 
  getAdminUpiId, 
  updateAdminUpiId, 
  getPendingTransactions, 
  approveTransaction, 
  rejectTransaction 
} from '../services/paymentService';

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

  const [activeTab, setActiveTab] = useState<'all' | 'users' | 'listeners' | 'reports' | 'applications' | 'calls' | 'verify_payments' | 'settings'>('all');
  const [usersList, setUsersList] = useState<UserProfile[]>([]);
  const [reportsList, setReportsList] = useState<Report[]>([]);
  const [applicationsList, setApplicationsList] = useState<ListenerApplication[]>([]);
  const [callLogsList, setCallLogsList] = useState<CallLog[]>([]);
  const [totalRevenue, setTotalRevenue] = useState<number>(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  // Manual UPI Payments state
  const [pendingTxList, setPendingTxList] = useState<Transaction[]>([]);
  const [adminUpiInput, setAdminUpiInput] = useState<string>('');
  const [adminUpiSaved, setAdminUpiSaved] = useState<boolean>(false);
  const [isSavingUpi, setIsSavingUpi] = useState<boolean>(false);
  const [verifyingTxId, setVerifyingTxId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

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
      // 1. Fetch Users from Firestore
      const users: UserProfile[] = [];
      const seenUids = new Set<string>();

      // 1. Fetch Users from Firestore - explicitly fetch all users where role == 'listener'
      // Requirement: "Remove incorrect where filter on isDummy, fetch all users where role == 'listener'"
      try {
        const listenerQ = query(collection(db, 'users'), where('role', '==', 'listener'));
        const listenerSnap = await getDocs(listenerQ);
        listenerSnap.forEach((d) => {
          const data = d.data() as UserProfile;
          const uid = d.id || data.uid;
          if (uid && !seenUids.has(uid)) {
            seenUids.add(uid);
            users.push({
              ...data,
              uid,
              id: uid,
              role: 'listener',
              is_listener: true,
              isListener: true,
              status: data.status || 'online',
              isActive: data.isActive !== false && data.is_active !== false,
              is_active: data.isActive !== false && data.is_active !== false,
            } as UserProfile);
          }
        });
      } catch (listenerFetchErr) {
        console.warn('Listener role query fetch notice:', listenerFetchErr);
      }

      // Also fetch all users from collection(db, 'users') without any incorrect where filter on isDummy
      try {
        const usersSnap = await getDocs(collection(db, 'users'));
        usersSnap.forEach((d) => {
          const data = d.data() as UserProfile;
          const uid = d.id || data.uid;
          if (uid) {
            if (!seenUids.has(uid)) {
              seenUids.add(uid);
              users.push({ ...data, uid, id: uid } as UserProfile);
            } else {
              const existingIdx = users.findIndex(u => u.uid === uid);
              if (existingIdx !== -1) {
                users[existingIdx] = {
                  ...users[existingIdx],
                  ...data,
                  // Preserve listener role if recognized as listener
                  role: (data.role === 'listener' || users[existingIdx].role === 'listener') ? 'listener' : data.role,
                  is_listener: (data.is_listener || users[existingIdx].is_listener || data.role === 'listener'),
                  isListener: (data.is_listener || users[existingIdx].is_listener || data.role === 'listener'),
                };
              }
            }
          }
        });
      } catch (userFetchErr) {
        console.warn('Users collection fetch notice:', userFetchErr);
      }

      // Guarantee all 15 Dummy Seed Listeners are present in admin listener list
      for (let i = 0; i < SEED_LISTENERS.length; i++) {
        const seedUid = `listener_seed_${i + 1}`;
        const existingIdx = users.findIndex(u => u.uid === seedUid);
        if (existingIdx === -1) {
          seenUids.add(seedUid);
          const cityData = findCity(SEED_LISTENERS[i].location);
          users.push({
            ...SEED_LISTENERS[i],
            uid: seedUid,
            id: seedUid,
            role: 'listener',
            is_listener: true,
            isListener: true,
            status: SEED_LISTENERS[i].status || 'online',
            isActive: true,
            is_active: true,
            is_available: true,
            isDummy: false,
            city: SEED_LISTENERS[i].city || cityData.name,
            latitude: SEED_LISTENERS[i].latitude ?? cityData.lat,
            longitude: SEED_LISTENERS[i].longitude ?? cityData.lng,
            created_at: new Date('2026-01-01T00:00:00.000Z').toISOString(),
            createdAt: new Date('2026-01-01T00:00:00.000Z').toISOString(),
          } as UserProfile);
        } else {
          users[existingIdx] = {
            ...users[existingIdx],
            role: 'listener',
            is_listener: true,
            isListener: true,
            status: users[existingIdx].status || 'online',
            isActive: true,
            is_active: true,
            is_available: true,
            isDummy: false,
          };
        }
      }

      // Guarantee verified Real Listeners (real_listener_1 and real_listener_2) are both present and active
      for (const rl of REAL_LISTENERS) {
        const existingIdx = users.findIndex(u => u.uid === rl.uid);
        if (existingIdx === -1) {
          seenUids.add(rl.uid);
          users.push({
            ...rl,
            role: 'listener',
            is_listener: true,
            isListener: true,
            status: 'online',
            isActive: true,
            is_active: true,
            is_available: true,
            isDummy: false,
          });
        } else {
          users[existingIdx] = {
            ...users[existingIdx],
            ...rl,
            role: 'listener',
            is_listener: true,
            isListener: true,
            status: users[existingIdx].status || 'online',
            isActive: true,
            is_active: true,
            is_available: true,
            isDummy: false,
          };
        }
      }

      // 2. Fetch Listener Applications
      try {
        const appsSnap = await getDocs(collection(db, 'listener_applications'));
        const apps: ListenerApplication[] = [];
        appsSnap.forEach((d) => {
          const appData = { id: d.id, ...d.data() } as ListenerApplication;
          apps.push(appData);

          // Include any approved real listener if not already in users list
          if (appData.user_id && !seenUids.has(appData.user_id)) {
            seenUids.add(appData.user_id);
            const fallbackListener: any = {
              uid: appData.user_id,
              id: appData.user_id,
              name: appData.name || 'Verified Listener',
              email: `${appData.user_id}@meetup.user`,
              role: 'listener',
              is_listener: true,
              status: 'online',
              age: 25,
              gender: 'female',
              coins_balance: 100,
              diamonds_balance: 50,
              voice_rate: Number(appData.voice_rate) || 10,
              video_rate: Number(appData.video_rate) || 50,
              profile_pic: (appData as any).profile_pic || (appData as any).avatar_url || '/avatars/avatar_1.jpg',
              languages: appData.languages || ['Tamil', 'English'],
              location: appData.location || 'Tamil Nadu',
              bio: appData.experience || 'Verified Listener',
              interests: ['Conversations', 'Friendly Chat'],
              is_blocked: false,
            };
            users.push(fallbackListener as UserProfile);
          }
        });
        setApplicationsList(apps);
      } catch (appErr) {
        console.warn('Listener applications fetch notice:', appErr);
      }

      // Set users list immediately
      setUsersList(users);

      // 3. Fetch Reports (isolated try/catch so permission errors don't block user views)
      try {
        const reportsSnap = await getDocs(collection(db, 'reports'));
        const reps: Report[] = [];
        reportsSnap.forEach((d) => reps.push({ id: d.id, ...d.data() } as Report));
        setReportsList(reps);
      } catch (repErr) {
        console.warn('Reports fetch notice:', repErr);
      }

      // 4. Fetch Call Logs
      try {
        const callsSnap = await getDocs(collection(db, 'call_logs'));
        const calls: CallLog[] = [];
        callsSnap.forEach((d) => calls.push({ id: d.id, ...d.data() } as CallLog));
        setCallLogsList(calls);
      } catch (callErr) {
        console.warn('Call logs fetch notice:', callErr);
      }

      // 5. Fetch Total Revenue from Transactions
      try {
        const txSnap = await getDocs(collection(db, 'transactions'));
        let rev = 0;
        txSnap.forEach((d) => {
          const tx = d.data() as Transaction;
          if (tx.status === 'success' || tx.status === 'verified') {
            rev += (tx.amount || tx.amount_inr || 0);
          }
        });
        setTotalRevenue(rev);
      } catch (txErr) {
        console.warn('Transactions fetch notice:', txErr);
      }

      // 6. Fetch Pending Transactions for Verification
      try {
        const pendingTxs = await getPendingTransactions();
        setPendingTxList(pendingTxs);
      } catch (pendErr) {
        console.warn('Pending transactions fetch notice:', pendErr);
      }

      // 7. Fetch current UPI ID for Settings (doc id: payment_config, field: upi_id)
      try {
        const currentUpi = await getAdminUpiId();
        setAdminUpiInput(currentUpi);
      } catch {
        setAdminUpiInput('');
      }
    } catch (err) {
      console.error('Error in admin data aggregation:', err);
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

  const copyToClipboard = (text: string, id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    navigator.clipboard.writeText(text).catch(() => {});
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Payment Verification Handlers
  const handleApprovePayment = async (tx: Transaction) => {
    if (!tx.id) return;
    const targetUserId = tx.userId || tx.user_id;
    const coinsToAdd = tx.coins || tx.coins_credited || 0;
    if (!targetUserId) {
      alert('User ID is missing on this transaction.');
      return;
    }

    setVerifyingTxId(tx.id);
    try {
      await approveTransaction(tx.id, targetUserId, coinsToAdd);
      setPendingTxList((prev) => prev.filter((t) => t.id !== tx.id));
      setUsersList((prev) =>
        prev.map((u) => {
          if (u.uid === targetUserId) {
            const newCoins = (u.coins_balance || 0) + coinsToAdd;
            return { ...u, coins_balance: newCoins, coin_balance: newCoins };
          }
          return u;
        })
      );
      setTotalRevenue((prev) => prev + (tx.amount || tx.amount_inr || 0));
      alert(`Payment Approved! Added ${coinsToAdd} coins to User: ${targetUserId}`);
    } catch (err: any) {
      console.error('Error approving payment:', err);
      alert(`Failed to approve payment: ${err.message || 'Unknown error'}`);
    } finally {
      setVerifyingTxId(null);
    }
  };

  const handleRejectPayment = async (tx: Transaction) => {
    if (!tx.id) return;
    if (!window.confirm(`Are you sure you want to reject payment for UTR: ${tx.utr || tx.id}?`)) return;

    setVerifyingTxId(tx.id);
    try {
      await rejectTransaction(tx.id);
      setPendingTxList((prev) => prev.filter((t) => t.id !== tx.id));
      alert('Payment rejected.');
    } catch (err: any) {
      console.error('Error rejecting payment:', err);
      alert(`Failed to reject payment: ${err.message || 'Unknown error'}`);
    } finally {
      setVerifyingTxId(null);
    }
  };

  const handleSaveAdminUpi = async () => {
    setIsSavingUpi(true);
    try {
      await updateAdminUpiId(adminUpiInput);
      setAdminUpiSaved(true);
      setTimeout(() => setAdminUpiSaved(false), 3000);
    } catch (err: any) {
      alert(err.message || 'Failed to update UPI ID');
    } finally {
      setIsSavingUpi(false);
    }
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

  // Helper to determine if a profile is a listener
  const isProfileListener = (u: UserProfile) => {
    return (
      u.role === 'listener' ||
      u.is_listener === true ||
      (u as any).isListener === true ||
      (typeof u.uid === 'string' && (u.uid.startsWith('real_listener_') || u.uid.startsWith('listener_seed_')))
    );
  };

  // Tab 0: All Members
  const allUsers = usersList.filter(searchFilter);

  // Tab 1: Users (role !== 'listener')
  const regularUsers = usersList.filter((u) => !isProfileListener(u)).filter(searchFilter);

  // Tab 2: Listeners (role === 'listener' or is_listener)
  const listenersList = usersList.filter(isProfileListener).filter(searchFilter);

  const activeTableList =
    activeTab === 'all'
      ? allUsers
      : activeTab === 'users'
      ? regularUsers
      : listenersList;

  const onlineListenersCount = usersList.filter((u) => isProfileListener(u) && !isListenerOffline(u)).length;

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
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
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

          <div 
            onClick={() => setActiveTab('verify_payments')}
            className="p-3.5 bg-[#16161C] border border-[#23232C] hover:border-emerald-500/50 rounded-2xl cursor-pointer transition col-span-2 sm:col-span-1"
          >
            <div className="flex items-center justify-between text-zinc-400 mb-1">
              <span className="text-[11px] font-medium">Pending Verify</span>
              <CreditCard className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-xl font-black text-emerald-400">{pendingTxList.length}</span>
              <span className="text-[10px] text-zinc-500 font-semibold">to verify</span>
            </div>
          </div>
        </div>

        {/* Tab Navigation: All Members, Users, Listeners, Reports, Applications, Calls */}
        <div className="flex items-center gap-1.5 p-1 bg-[#16161C] border border-[#23232C] rounded-2xl overflow-x-auto no-scrollbar">
          <button
            onClick={() => setActiveTab('all')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition shrink-0 cursor-pointer ${
              activeTab === 'all'
                ? 'bg-[#FF69B4] text-white shadow-[0_0_10px_rgba(255,105,180,0.5)]'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            All Members ({allUsers.length})
          </button>

          <button
            onClick={() => setActiveTab('users')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition shrink-0 cursor-pointer ${
              activeTab === 'users'
                ? 'bg-[#FF69B4] text-white shadow-[0_0_10px_rgba(255,105,180,0.5)]'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            Callers / Users ({regularUsers.length})
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

          <button
            onClick={() => setActiveTab('verify_payments')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition shrink-0 cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'verify_payments'
                ? 'bg-emerald-500 text-white shadow-[0_0_10px_rgba(16,185,129,0.5)]'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <span>Verify Payments</span>
            {pendingTxList.length > 0 && (
              <span className="px-1.5 py-0.5 rounded-full bg-amber-400 text-black text-[10px] font-black animate-pulse">
                {pendingTxList.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('settings')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition shrink-0 cursor-pointer flex items-center gap-1 ${
              activeTab === 'settings'
                ? 'bg-purple-600 text-white shadow-[0_0_10px_rgba(147,51,234,0.5)]'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <Settings className="w-3.5 h-3.5" />
            <span>UPI Settings</span>
          </button>
        </div>

        {/* Tab 0 (All Members), Tab 1 (Users) & Tab 2 (Listeners): Table View with 6 columns & search bar */}
        {(activeTab === 'all' || activeTab === 'users' || activeTab === 'listeners') && (
          <div className="space-y-3">
            {/* Search Bar */}
            <div className="relative">
              <Search className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={`Search ${activeTab === 'all' ? 'all members' : (activeTab === 'users' ? 'users' : 'listeners')} by name or email ID...`}
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
                    {activeTableList.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-12 text-center text-zinc-500 text-xs">
                          {loading ? 'Loading records from Firestore...' : `No ${activeTab === 'all' ? 'members' : activeTab} found matching search.`}
                        </td>
                      </tr>
                    ) : (
                      activeTableList.map((user) => {
                        const isPhoneRevealed = !!revealedPhones[user.uid];
                        const isUserOnline = user.status === 'online' && !isListenerOffline(user);
                        const isAvailable = isProfileListener(user) ? isUserOnline : user.status === 'online';

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
                              <div className="font-bold text-white group-hover:text-[#FF69B4] transition flex items-center gap-1.5 flex-wrap">
                                <span>{user.name}</span>
                                {user.uid.startsWith('real_listener_') && (
                                  <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                                    Real Listener
                                  </span>
                                )}
                                {user.uid.startsWith('listener_seed_') && (
                                  <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30">
                                    Seed Listener
                                  </span>
                                )}
                                {(user.role === 'admin' || user.is_admin) && (
                                  <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                                    Admin
                                  </span>
                                )}
                                {!user.uid.startsWith('real_listener_') && !user.uid.startsWith('listener_seed_') && !(user.role === 'admin' || user.is_admin) && isProfileListener(user) && (
                                  <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-pink-500/20 text-pink-300 border border-pink-500/30">
                                    Listener
                                  </span>
                                )}
                                {!isProfileListener(user) && !(user.role === 'admin' || user.is_admin) && (
                                  <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30">
                                    Customer
                                  </span>
                                )}
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

        {/* Tab 6: Verify Payments (Requirement 4) */}
        {activeTab === 'verify_payments' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-bold text-white flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-emerald-400" />
                  <span>Pending Payment Verifications</span>
                </h4>
                <p className="text-[11px] text-zinc-400">
                  Manual UPI payments submitted by users awaiting coin approval
                </p>
              </div>
              <span className="px-2.5 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs font-bold">
                {pendingTxList.length} Pending
              </span>
            </div>

            {pendingTxList.length === 0 ? (
              <div className="py-12 text-center bg-[#16161C] border border-[#23232C] rounded-2xl p-6 text-zinc-400 text-xs space-y-2">
                <CheckCircle className="w-8 h-8 text-emerald-400 mx-auto opacity-70" />
                <p className="font-semibold text-zinc-300">All caught up!</p>
                <p className="text-zinc-500">No pending manual UPI transactions to verify.</p>
              </div>
            ) : (
              <div className="bg-[#16161C] border border-[#23232C] rounded-2xl overflow-hidden shadow-xl">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-[#1D1D26] text-zinc-400 font-bold uppercase tracking-wider text-[10px] border-b border-[#2A2A36]">
                        <th className="py-3 px-3.5">Date</th>
                        <th className="py-3 px-3.5">User ID</th>
                        <th className="py-3 px-3.5">Coins</th>
                        <th className="py-3 px-3.5">Amount</th>
                        <th className="py-3 px-3.5">UTR / Txn ID</th>
                        <th className="py-3 px-3.5 text-center">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#23232E]">
                      {pendingTxList.map((tx) => {
                        const targetUid = tx.userId || tx.user_id || 'Unknown';
                        const coins = tx.coins || tx.coins_credited || 0;
                        const amount = tx.amount || tx.amount_inr || 0;
                        const utr = tx.utr || 'N/A';
                        const isActionBusy = verifyingTxId === tx.id;

                        return (
                          <tr key={tx.id} className="hover:bg-[#1C1C24] transition">
                            {/* Date */}
                            <td className="py-3 px-3.5 text-zinc-300 font-mono text-[11px] whitespace-nowrap">
                              {formatJoinedDate(tx.createdAt || tx.created_at)}
                            </td>

                            {/* User ID with copy button */}
                            <td className="py-3 px-3.5 whitespace-nowrap">
                              <div className="flex items-center gap-1.5">
                                <span className="font-mono text-xs text-zinc-300">
                                  {targetUid.slice(0, 10)}...
                                </span>
                                <button
                                  type="button"
                                  onClick={(e) => copyToClipboard(targetUid, `uid-${tx.id}`, e)}
                                  className="p-1 rounded text-zinc-500 hover:text-white hover:bg-zinc-800 transition"
                                  title="Copy User ID"
                                >
                                  {copiedId === `uid-${tx.id}` ? (
                                    <Check className="w-3 h-3 text-emerald-400" />
                                  ) : (
                                    <Copy className="w-3 h-3" />
                                  )}
                                </button>
                              </div>
                            </td>

                            {/* Coins */}
                            <td className="py-3 px-3.5 whitespace-nowrap">
                              <span className="font-bold text-amber-300 inline-flex items-center gap-1">
                                🪙 {coins} Coins
                              </span>
                            </td>

                            {/* Amount */}
                            <td className="py-3 px-3.5 whitespace-nowrap">
                              <span className="font-black text-emerald-400">
                                ₹{amount}
                              </span>
                            </td>

                            {/* UTR with Copy Button */}
                            <td className="py-3 px-3.5 whitespace-nowrap">
                              <div className="flex items-center gap-1.5">
                                <span className="font-mono font-bold text-white bg-black/40 px-2 py-0.5 rounded border border-zinc-700/60 select-all">
                                  {utr}
                                </span>
                                <button
                                  type="button"
                                  onClick={(e) => copyToClipboard(utr, `utr-${tx.id}`, e)}
                                  className="p-1 rounded text-zinc-400 hover:text-white hover:bg-zinc-800 transition"
                                  title="Copy UTR"
                                >
                                  {copiedId === `utr-${tx.id}` ? (
                                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                                  ) : (
                                    <Copy className="w-3.5 h-3.5" />
                                  )}
                                </button>
                              </div>
                            </td>

                            {/* Approve (green) & Reject (red) Buttons */}
                            <td className="py-3 px-3.5 whitespace-nowrap text-center">
                              <div className="flex items-center justify-center gap-2">
                                <button
                                  type="button"
                                  disabled={isActionBusy}
                                  onClick={() => handleApprovePayment(tx)}
                                  className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition shadow-md shadow-emerald-900/30 flex items-center gap-1 cursor-pointer disabled:opacity-50"
                                >
                                  {isActionBusy ? (
                                    <Loader2 className="w-3 h-3 animate-spin" />
                                  ) : (
                                    <Check className="w-3 h-3" />
                                  )}
                                  <span>Approve</span>
                                </button>

                                <button
                                  type="button"
                                  disabled={isActionBusy}
                                  onClick={() => handleRejectPayment(tx)}
                                  className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs transition shadow-md shadow-rose-900/30 flex items-center gap-1 cursor-pointer disabled:opacity-50"
                                >
                                  <X className="w-3 h-3" />
                                  <span>Reject</span>
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tab 7: Admin UPI Settings (Requirement 1) */}
        {activeTab === 'settings' && (
          <div className="space-y-4 max-w-xl mx-auto py-2">
            <div className="bg-[#16161C] border border-[#23232C] rounded-2xl p-5 space-y-4 shadow-xl">
              <div>
                <h4 className="text-base font-bold text-white flex items-center gap-2">
                  <Settings className="w-4 h-4 text-purple-400" />
                  <span>Manual UPI Payment Configuration</span>
                </h4>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Set the GPay / UPI ID where app users send payment. Displayed in QR code and payment popup.
                </p>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-zinc-300 block">
                  Admin UPI ID (Stored in settings/payment_config)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={adminUpiInput}
                    onChange={(e) => setAdminUpiInput(e.target.value)}
                    placeholder="Enter UPI ID (e.g. yourname@bank)"
                    className="flex-1 bg-[#0F0F14] border border-[#2A2A38] focus:border-purple-500 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm font-mono text-white placeholder-zinc-500 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={(e) => copyToClipboard(adminUpiInput, 'settings-upi', e)}
                    className="p-2.5 rounded-xl bg-[#23232E] hover:bg-[#2A2A38] text-zinc-300 transition"
                    title="Copy UPI ID"
                  >
                    {copiedId === 'settings-upi' ? (
                      <Check className="w-4 h-4 text-emerald-400" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </button>
                </div>
                <p className="text-[11px] text-zinc-500">
                  Collection: <span className="font-mono text-zinc-400">settings</span> • Doc: <span className="font-mono text-zinc-400">payment_config</span> • Field: <span className="font-mono text-zinc-400">upi_id</span>
                </p>
              </div>

              {adminUpiSaved && (
                <div className="p-2.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2 animate-in fade-in">
                  <CheckCircle className="w-4 h-4 shrink-0 text-emerald-400" />
                  <span>UPI ID saved successfully in Firestore settings!</span>
                </div>
              )}

              <button
                type="button"
                disabled={isSavingUpi || !adminUpiInput.trim()}
                onClick={handleSaveAdminUpi}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:opacity-95 text-white font-bold text-xs sm:text-sm transition shadow-lg shadow-purple-600/25 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isSavingUpi ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Saving Settings...</span>
                  </>
                ) : (
                  <span>Save UPI ID Settings</span>
                )}
              </button>
            </div>
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
