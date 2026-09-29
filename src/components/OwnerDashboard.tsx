import React, { useState, useEffect } from 'react';
import { 
  Shield, 
  Crown, 
  Users, 
  PhoneCall, 
  Video, 
  Clock, 
  Coins, 
  Search, 
  RefreshCw, 
  AlertTriangle, 
  CheckCircle2, 
  Database, 
  FileText, 
  Download, 
  ExternalLink, 
  Lock, 
  LogOut, 
  X, 
  Volume2, 
  VolumeX, 
  PhoneOff, 
  UserCheck, 
  Ban, 
  Copy, 
  Send,
  Radio,
  Server
} from 'lucide-react';
import { 
  collection, 
  query, 
  onSnapshot, 
  doc, 
  updateDoc, 
  getDocs, 
  orderBy, 
  limit, 
  increment 
} from 'firebase/firestore';
import { db, auth } from '../firebase/config';
import { useAuth } from '../context/AuthContext';
import { useCall } from '../context/CallContext';
import { ActiveCall, CallLog, UserProfile } from '../types';
import { getUserAvatarUrl } from '../services/staticCdnService';
import { isMeetupOwner, ALLOWED_MEETUP_OWNERS } from '../utils/admin';
import { 
  getSupabaseCredentials, 
  setSupabaseCredentials, 
  SUPABASE_SQL_SCHEMA, 
  fetchUsersFromSupabase, 
  fetchRoomsFromSupabase, 
  sendChatMessageToSupabase,
  ChatMessageRecord
} from '../services/supabase';

interface OwnerDashboardProps {
  onClose?: () => void;
  onLogoutOwner?: () => void;
}

export const OwnerDashboard: React.FC<OwnerDashboardProps> = ({ onClose, onLogoutOwner }) => {
  const { currentUser } = useAuth();
  const { joinRoomAsOwner, ownerEndCall, ownerMuteCall } = useCall();

  const userEmail = currentUser?.email || auth.currentUser?.email;
  const isOwner = isMeetupOwner(userEmail);

  const [activeTab, setActiveTab] = useState<'rooms' | 'users' | 'history' | 'supabase' | 'deployment'>('rooms');
  
  // Realtime Active Calls
  const [activeCalls, setActiveCalls] = useState<ActiveCall[]>([]);
  const [loadingCalls, setLoadingCalls] = useState(true);

  // All Users
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [userSearch, setUserSearch] = useState('');
  const [loadingUsers, setLoadingUsers] = useState(false);

  // Call Logs History
  const [callLogs, setCallLogs] = useState<CallLog[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);

  // Supabase Settings & Messages
  const [supabaseUrl, setSupabaseUrl] = useState('');
  const [supabaseKey, setSupabaseKey] = useState('');
  const [supabaseSaved, setSupabaseSaved] = useState(false);
  const [copiedSchema, setCopiedSchema] = useState(false);
  const [testRoomId, setTestRoomId] = useState('global-room');
  const [testMessage, setTestMessage] = useState('');
  const [recentMessages, setRecentMessages] = useState<ChatMessageRecord[]>([]);

  // 1. Subscribe to Live Calls in Firestore
  useEffect(() => {
    const callsQuery = query(collection(db, 'calls'));
    const unsubscribe = onSnapshot(callsQuery, (snapshot) => {
      const calls: ActiveCall[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data() as ActiveCall;
        if (data.status === 'connected' || data.status === 'ringing') {
          calls.push({ id: docSnap.id, ...data });
        }
      });
      setActiveCalls(calls);
      setLoadingCalls(false);
    }, (err) => {
      console.error('Error fetching live calls:', err);
      setLoadingCalls(false);
    });

    return () => unsubscribe();
  }, []);

  // 2. Fetch Users
  const loadUsers = async () => {
    setLoadingUsers(true);
    try {
      const snap = await getDocs(collection(db, 'users'));
      const list: UserProfile[] = [];
      snap.forEach((d) => list.push(d.data() as UserProfile));
      setUsers(list);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingUsers(false);
    }
  };

  // 3. Fetch Call Logs
  const loadCallLogs = async () => {
    setLoadingLogs(true);
    try {
      const snap = await getDocs(query(collection(db, 'call_logs'), orderBy('started_at', 'desc'), limit(50)));
      const list: CallLog[] = [];
      snap.forEach((d) => list.push({ id: d.id, ...d.data() } as CallLog));
      setCallLogs(list);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingLogs(false);
    }
  };

  useEffect(() => {
    loadUsers();
    loadCallLogs();
    const creds = getSupabaseCredentials();
    setSupabaseUrl(creds.url);
    setSupabaseKey(creds.key);
  }, []);

  // Modify User Coins
  const handleModifyCoins = async (uid: string, delta: number) => {
    try {
      await updateDoc(doc(db, 'users', uid), {
        coins_balance: increment(delta)
      });
      setUsers((prev) =>
        prev.map((u) => (u.uid === uid ? { ...u, coins_balance: (u.coins_balance || 0) + delta } : u))
      );
    } catch (e: any) {
      alert('Failed to update coins: ' + e.message);
    }
  };

  // Toggle User Block Status
  const handleToggleBlock = async (uid: string, currentBlocked: boolean) => {
    try {
      await updateDoc(doc(db, 'users', uid), {
        is_blocked: !currentBlocked
      });
      setUsers((prev) =>
        prev.map((u) => (u.uid === uid ? { ...u, is_blocked: !currentBlocked } : u))
      );
    } catch (e: any) {
      alert('Failed to update block status: ' + e.message);
    }
  };

  // Change User Role
  const handleChangeRole = async (uid: string, newRole: any) => {
    try {
      await updateDoc(doc(db, 'users', uid), { role: newRole });
      setUsers((prev) => prev.map((u) => (u.uid === uid ? { ...u, role: newRole } : u)));
    } catch (e: any) {
      alert('Failed to change role: ' + e.message);
    }
  };

  // Save Custom Supabase Credentials
  const handleSaveSupabase = () => {
    setSupabaseCredentials(supabaseUrl, supabaseKey);
    const updated = getSupabaseCredentials();
    setSupabaseUrl(updated.url);
    setSupabaseSaved(true);
    setTimeout(() => setSupabaseSaved(false), 2500);
  };

  // Send Test Message via Supabase
  const handleSendTestMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testMessage.trim()) return;
    const newMsg: ChatMessageRecord = {
      room_id: testRoomId,
      sender_id: currentUser?.uid || 'owner_sys',
      sender_name: '👑 Owner (Admin Override)',
      sender_role: 'owner',
      message: testMessage.trim(),
      created_at: new Date().toISOString()
    };
    await sendChatMessageToSupabase(newMsg);
    setRecentMessages((prev) => [newMsg, ...prev]);
    setTestMessage('');
  };

  const filteredUsers = users.filter((u) =>
    (u.name || '').toLowerCase().includes(userSearch.toLowerCase()) ||
    (u.email || '').toLowerCase().includes(userSearch.toLowerCase()) ||
    u.uid.toLowerCase().includes(userSearch.toLowerCase())
  );

  if (!isOwner) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 p-4 animate-in fade-in">
        <div className="bg-[#16161C] border border-amber-500/40 rounded-3xl p-6 text-center max-w-sm shadow-[0_0_40px_rgba(245,158,11,0.2)]">
          <div className="w-14 h-14 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 mx-auto mb-4">
            <Crown className="w-7 h-7" />
          </div>
          <h3 className="text-lg font-bold text-white">Owner Privileges Required</h3>
          <p className="text-xs text-zinc-400 mt-2 leading-relaxed">
            Meet Up Owner controls are strictly restricted to authorized platform owners only.
          </p>
          <div className="mt-3 p-2 rounded-xl bg-zinc-900 border border-zinc-800 text-[11px] text-zinc-400 font-mono">
            {userEmail || 'Anonymous'} is not authorized
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="mt-5 w-full py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-bold cursor-pointer transition"
            >
              Return to App
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-[#070709] text-white flex flex-col overflow-hidden">
      {/* Top Owner Header */}
      <header className="bg-[#0B0B0E] border-b border-amber-500/30 px-4 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-500/50 flex items-center justify-center text-amber-400 shadow-[0_0_12px_rgba(245,158,11,0.3)]">
            <Crown className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-black tracking-tight text-white flex items-center gap-1.5">
                Meet Up Owner Panel
              </h1>
              <span className="px-2 py-0.5 rounded-full bg-amber-500 text-black text-[10px] font-black uppercase tracking-wider">
                👑 Super Owner
              </span>
            </div>
            <p className="text-[11px] text-zinc-400">Master Authority: Rooms • Users • Moderation • Supabase • Hostinger</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {onLogoutOwner && (
            <button
              onClick={onLogoutOwner}
              className="px-3 py-1.5 rounded-xl bg-red-500/15 hover:bg-red-500/25 border border-red-500/40 text-red-300 text-xs font-bold flex items-center gap-1.5 transition"
              title="Lock Owner Session"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Lock Panel</span>
            </button>
          )}
          {onClose && (
            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white transition"
              title="Close Panel"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </header>

      {/* Navigation Tabs */}
      <nav className="bg-[#0F0F14] border-b border-zinc-800 px-4 flex gap-2 overflow-x-auto shrink-0 py-2 scrollbar-none">
        <button
          onClick={() => setActiveTab('rooms')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition shrink-0 ${
            activeTab === 'rooms'
              ? 'bg-amber-500 text-black shadow-[0_0_12px_rgba(245,158,11,0.4)]'
              : 'bg-[#16161D] text-zinc-400 hover:text-white'
          }`}
        >
          <Radio className="w-4 h-4" />
          <span>Active Calls & Rooms ({activeCalls.length})</span>
          {activeCalls.length > 0 && (
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('users')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition shrink-0 ${
            activeTab === 'users'
              ? 'bg-amber-500 text-black shadow-[0_0_12px_rgba(245,158,11,0.4)]'
              : 'bg-[#16161D] text-zinc-400 hover:text-white'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>All Users Directory ({users.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('history')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition shrink-0 ${
            activeTab === 'history'
              ? 'bg-amber-500 text-black shadow-[0_0_12px_rgba(245,158,11,0.4)]'
              : 'bg-[#16161D] text-zinc-400 hover:text-white'
          }`}
        >
          <Clock className="w-4 h-4" />
          <span>Call History Logs</span>
        </button>

        <button
          onClick={() => setActiveTab('supabase')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition shrink-0 ${
            activeTab === 'supabase'
              ? 'bg-amber-500 text-black shadow-[0_0_12px_rgba(245,158,11,0.4)]'
              : 'bg-[#16161D] text-zinc-400 hover:text-white'
          }`}
        >
          <Database className="w-4 h-4" />
          <span>Supabase Realtime Chat</span>
        </button>

        <button
          onClick={() => setActiveTab('deployment')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition shrink-0 ${
            activeTab === 'deployment'
              ? 'bg-amber-500 text-black shadow-[0_0_12px_rgba(245,158,11,0.4)]'
              : 'bg-[#16161D] text-zinc-400 hover:text-white'
          }`}
        >
          <Server className="w-4 h-4" />
          <span>APK & Hostinger Deploy</span>
        </button>
      </nav>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto p-4 sm:p-6 bg-[#070709]">
        {/* TAB 1: ACTIVE ROOMS & PERMISSIONLESS JOIN */}
        {activeTab === 'rooms' && (
          <div className="max-w-5xl mx-auto space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-black text-white flex items-center gap-2">
                  <Radio className="w-5 h-5 text-emerald-400 animate-pulse" />
                  Live Meeting & Room Supervisor
                </h2>
                <p className="text-xs text-zinc-400">
                  Join any room without participant permission. Mute, kick, or end meetings on demand.
                </p>
              </div>

              <div className="flex items-center gap-2 text-xs">
                <span className="px-2.5 py-1 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 font-bold">
                  {activeCalls.length} Active
                </span>
              </div>
            </div>

            {loadingCalls ? (
              <div className="py-12 text-center text-zinc-500 text-xs">Listening for active calls...</div>
            ) : activeCalls.length === 0 ? (
              <div className="p-8 rounded-3xl bg-[#0E0E14] border border-zinc-800/80 text-center space-y-3">
                <div className="w-12 h-12 rounded-full bg-zinc-800 flex items-center justify-center mx-auto text-zinc-400">
                  <PhoneOff className="w-6 h-6" />
                </div>
                <h3 className="text-sm font-bold text-white">No calls currently active</h3>
                <p className="text-xs text-zinc-500 max-w-sm mx-auto">
                  When users start voice or video calls in Meet Up, they will appear here in real-time with instant owner join controls.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {activeCalls.map((call) => (
                  <div 
                    key={call.id}
                    className="p-5 rounded-2xl bg-[#0F0F16] border-2 border-amber-500/40 shadow-[0_0_20px_rgba(245,158,11,0.15)] relative space-y-4"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase flex items-center gap-1 ${
                          call.type === 'video' ? 'bg-purple-500/20 text-purple-300' : 'bg-pink-500/20 text-[#FF69B4]'
                        }`}>
                          {call.type === 'video' ? <Video className="w-3 h-3" /> : <PhoneCall className="w-3 h-3" />}
                          {call.type} Call
                        </span>
                        <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-bold">
                          ● {call.status}
                        </span>
                      </div>

                      <span className="text-[10px] text-zinc-500 font-mono">Room: {call.room_id.slice(0, 10)}...</span>
                    </div>

                    {/* Participants */}
                    <div className="flex items-center justify-between bg-[#14141E] p-3 rounded-xl border border-zinc-800">
                      <div className="flex items-center gap-2.5">
                        <img 
                          src={call.caller_pic || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100'} 
                          alt={call.caller_name}
                          className="w-9 h-9 rounded-full object-cover border border-[#FF69B4]" 
                        />
                        <div>
                          <div className="text-xs font-bold text-white">{call.caller_name}</div>
                          <div className="text-[10px] text-zinc-500">Caller</div>
                        </div>
                      </div>

                      <span className="text-zinc-600 font-black text-xs">VS</span>

                      <div className="flex items-center gap-2.5 text-right">
                        <div>
                          <div className="text-xs font-bold text-white">{call.receiver_name}</div>
                          <div className="text-[10px] text-zinc-500">Listener / Callee</div>
                        </div>
                        <img 
                          src={call.receiver_pic || 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=100'} 
                          alt={call.receiver_name}
                          className="w-9 h-9 rounded-full object-cover border border-purple-400" 
                        />
                      </div>
                    </div>

                    {/* Owner Master Action Buttons */}
                    <div className="grid grid-cols-3 gap-2 pt-1">
                      <button
                        onClick={() => {
                          if (call) {
                            joinRoomAsOwner(call);
                            if (onClose) onClose();
                          }
                        }}
                        className="py-2.5 px-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-black text-xs flex items-center justify-center gap-1.5 shadow-[0_0_12px_rgba(245,158,11,0.5)] transition active:scale-[0.97]"
                        title="Join this call as Superintendent / Owner without asking"
                      >
                        <Crown className="w-4 h-4" />
                        <span>Join Room</span>
                      </button>

                      <button
                        onClick={() => call.id && ownerMuteCall(call.id, true)}
                        className="py-2.5 px-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-bold text-xs flex items-center justify-center gap-1.5 transition active:scale-[0.97]"
                        title="Mute call participants"
                      >
                        <VolumeX className="w-4 h-4 text-amber-400" />
                        <span>Mute Call</span>
                      </button>

                      <button
                        onClick={() => call.id && ownerEndCall(call.id)}
                        className="py-2.5 px-3 rounded-xl bg-red-500/20 hover:bg-red-500/30 border border-red-500/40 text-red-300 font-bold text-xs flex items-center justify-center gap-1.5 transition active:scale-[0.97]"
                        title="Terminate meeting immediately"
                      >
                        <PhoneOff className="w-4 h-4" />
                        <span>End Call</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: USERS DIRECTORY */}
        {activeTab === 'users' && (
          <div className="max-w-5xl mx-auto space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-black text-white flex items-center gap-2">
                  <Users className="w-5 h-5 text-amber-400" />
                  All Registered Users Directory
                </h2>
                <p className="text-xs text-zinc-400">Total {users.length} users in database. Manage roles, coin balances, and moderation.</p>
              </div>

              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                    placeholder="Search by name or email..."
                    className="bg-[#121217] border border-zinc-800 rounded-xl pl-9 pr-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500 w-56"
                  />
                </div>
                <button
                  onClick={loadUsers}
                  className="p-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white"
                  title="Refresh users"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="bg-[#0E0E14] border border-zinc-800 rounded-2xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#14141E] text-zinc-400 uppercase font-bold text-[10px] border-b border-zinc-800">
                    <tr>
                      <th className="p-3">User</th>
                      <th className="p-3">Role</th>
                      <th className="p-3">Coins Balance</th>
                      <th className="p-3">Status</th>
                      <th className="p-3">Moderate Coins</th>
                      <th className="p-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/60">
                    {filteredUsers.map((u) => (
                      <tr key={u.uid} className="hover:bg-zinc-900/40 transition">
                        <td className="p-3">
                          <div className="flex items-center gap-3">
                            <img
                              src={getUserAvatarUrl(u)}
                              alt={u.name}
                              onError={(e) => {
                                (e.currentTarget as HTMLImageElement).src = 'https://randomuser.me/api/portraits/women/11.jpg';
                              }}
                              className="w-8 h-8 rounded-full object-cover border border-zinc-700"
                            />
                            <div>
                              <div className="font-bold text-white flex items-center gap-1.5">
                                <span>{u.name}</span>
                                {u.role === 'owner' && (
                                  <span className="text-amber-400">👑</span>
                                )}
                              </div>
                              <div className="text-[10px] text-zinc-500">{u.email || u.uid.slice(0, 12)}</div>
                            </div>
                          </div>
                        </td>

                        <td className="p-3">
                          <select
                            value={u.role || 'user'}
                            onChange={(e) => handleChangeRole(u.uid, e.target.value)}
                            className="bg-[#16161F] border border-zinc-700 rounded-lg px-2 py-1 text-[11px] text-white focus:outline-none focus:border-amber-500"
                          >
                            <option value="user">User</option>
                            <option value="listener">Listener</option>
                            <option value="admin">Admin</option>
                            <option value="owner">👑 Owner</option>
                          </select>
                        </td>

                        <td className="p-3 font-bold text-amber-400 flex items-center gap-1">
                          <Coins className="w-3.5 h-3.5" />
                          <span>{u.coins_balance || 0}</span>
                        </td>

                        <td className="p-3">
                          {u.is_blocked ? (
                            <span className="px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 text-[10px] font-bold">
                              Blocked
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-bold">
                              Active
                            </span>
                          )}
                        </td>

                        <td className="p-3">
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => handleModifyCoins(u.uid, 100)}
                              className="px-2 py-1 rounded bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 font-bold text-[10px]"
                              title="Add 100 coins"
                            >
                              +100
                            </button>
                            <button
                              onClick={() => handleModifyCoins(u.uid, 500)}
                              className="px-2 py-1 rounded bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 font-bold text-[10px]"
                              title="Add 500 coins"
                            >
                              +500
                            </button>
                            <button
                              onClick={() => handleModifyCoins(u.uid, -100)}
                              className="px-2 py-1 rounded bg-red-500/20 hover:bg-red-500/30 text-red-300 font-bold text-[10px]"
                              title="Subtract 100 coins"
                            >
                              -100
                            </button>
                          </div>
                        </td>

                        <td className="p-3 text-right">
                          <button
                            onClick={() => handleToggleBlock(u.uid, !!u.is_blocked)}
                            className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition ${
                              u.is_blocked
                                ? 'bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300'
                                : 'bg-red-500/20 hover:bg-red-500/30 text-red-300'
                            }`}
                          >
                            {u.is_blocked ? 'Unblock' : 'Block'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: CALL HISTORY LOGS */}
        {activeTab === 'history' && (
          <div className="max-w-5xl mx-auto space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-black text-white flex items-center gap-2">
                  <Clock className="w-5 h-5 text-amber-400" />
                  Past Call History & Billing Records
                </h2>
                <p className="text-xs text-zinc-400">All completed calls, durations, and coin deductions.</p>
              </div>

              <button
                onClick={loadCallLogs}
                className="p-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white"
                title="Refresh logs"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>

            <div className="bg-[#0E0E14] border border-zinc-800 rounded-2xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#14141E] text-zinc-400 uppercase font-bold text-[10px] border-b border-zinc-800">
                    <tr>
                      <th className="p-3">Caller</th>
                      <th className="p-3">Receiver</th>
                      <th className="p-3">Type</th>
                      <th className="p-3">Duration</th>
                      <th className="p-3">Coins Spent</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/60">
                    {callLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-zinc-900/40">
                        <td className="p-3 font-bold text-white">{log.caller_name || log.caller_id}</td>
                        <td className="p-3 text-zinc-300">{log.receiver_name || log.receiver_id}</td>
                        <td className="p-3">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            log.type === 'video' ? 'bg-purple-500/20 text-purple-300' : 'bg-pink-500/20 text-[#FF69B4]'
                          }`}>
                            {log.type}
                          </span>
                        </td>
                        <td className="p-3 font-mono text-zinc-400">
                          {Math.floor((log.duration_sec || 0) / 60)}m {(log.duration_sec || 0) % 60}s
                        </td>
                        <td className="p-3 font-bold text-amber-400">
                          {log.coins_spent || 0} coins
                        </td>
                      </tr>
                    ))}
                    {callLogs.length === 0 && (
                      <tr>
                        <td colSpan={5} className="p-6 text-center text-zinc-500">
                          No past calls recorded yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: SUPABASE REALTIME & DATABASE */}
        {activeTab === 'supabase' && (
          <div className="max-w-4xl mx-auto space-y-6">
            <div>
              <h2 className="text-lg font-black text-white flex items-center gap-2">
                <Database className="w-5 h-5 text-emerald-400" />
                Supabase Realtime Chat & Multi-Table Storage
              </h2>
              <p className="text-xs text-zinc-400">
                PostgreSQL tables: <code className="text-emerald-400">users</code>, <code className="text-emerald-400">rooms</code>, <code className="text-emerald-400">messages</code> with Realtime broadcasting.
              </p>
            </div>

            {/* Supabase Config Form */}
            <div className="p-5 rounded-2xl bg-[#0E0E14] border border-zinc-800 space-y-4">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Server className="w-4 h-4 text-amber-400" />
                Supabase Credentials (Live Connection)
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] text-zinc-400 block mb-1 font-semibold">Supabase Project URL</label>
                  <input
                    type="text"
                    value={supabaseUrl}
                    onChange={(e) => setSupabaseUrl(e.target.value)}
                    placeholder="https://your-project.supabase.co"
                    className="w-full bg-[#14141E] border border-zinc-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-zinc-400 block mb-1 font-semibold">Supabase Anon Key</label>
                  <input
                    type="password"
                    value={supabaseKey}
                    onChange={(e) => setSupabaseKey(e.target.value)}
                    placeholder="eyJhbGciOiJIUzI1NiIsIn..."
                    className="w-full bg-[#14141E] border border-zinc-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={handleSaveSupabase}
                  className="py-2 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-black font-bold text-xs flex items-center gap-1.5 transition"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Save Supabase Config</span>
                </button>

                {supabaseSaved && (
                  <span className="text-xs text-emerald-400 font-bold animate-in fade-in">
                    ✓ Saved & Re-initialized Supabase Client!
                  </span>
                )}
              </div>
            </div>

            {/* SQL Schema Copy Card */}
            <div className="p-5 rounded-2xl bg-[#0E0E14] border border-zinc-800 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <FileText className="w-4 h-4 text-amber-400" />
                    Supabase SQL Schema (Tables: users, rooms, messages)
                  </h3>
                  <p className="text-xs text-zinc-400">Copy and run this in your Supabase SQL Editor:</p>
                </div>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(SUPABASE_SQL_SCHEMA);
                    setCopiedSchema(true);
                    setTimeout(() => setCopiedSchema(false), 2000);
                  }}
                  className="py-1.5 px-3 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs font-bold text-zinc-300 flex items-center gap-1.5"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>{copiedSchema ? 'Copied!' : 'Copy SQL'}</span>
                </button>
              </div>

              <pre className="p-3 bg-[#08080C] border border-zinc-800 rounded-xl text-[11px] text-zinc-400 font-mono overflow-x-auto max-h-40">
                {SUPABASE_SQL_SCHEMA}
              </pre>
            </div>

            {/* Test Realtime Message Dispatch */}
            <div className="p-5 rounded-2xl bg-[#0E0E14] border border-zinc-800 space-y-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Send className="w-4 h-4 text-purple-400" />
                Dispatch Realtime Meeting Chat via Supabase
              </h3>

              <form onSubmit={handleSendTestMessage} className="flex gap-2">
                <input
                  type="text"
                  value={testRoomId}
                  onChange={(e) => setTestRoomId(e.target.value)}
                  placeholder="Room ID"
                  className="w-36 bg-[#14141E] border border-zinc-700 rounded-xl px-3 py-2 text-xs text-white"
                />
                <input
                  type="text"
                  value={testMessage}
                  onChange={(e) => setTestMessage(e.target.value)}
                  placeholder="Send broadcast message to room..."
                  className="flex-1 bg-[#14141E] border border-zinc-700 rounded-xl px-3 py-2 text-xs text-white"
                />
                <button
                  type="submit"
                  className="py-2 px-4 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs flex items-center gap-1"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Send</span>
                </button>
              </form>

              {recentMessages.length > 0 && (
                <div className="space-y-1.5 mt-2">
                  <div className="text-[10px] text-zinc-500 uppercase font-bold">Dispatched Messages:</div>
                  {recentMessages.map((m, idx) => (
                    <div key={idx} className="p-2 rounded-lg bg-[#14141E] text-xs text-zinc-300 flex items-center justify-between">
                      <span><strong>{m.sender_name}:</strong> {m.message}</span>
                      <span className="text-[10px] text-zinc-500 font-mono">Room: {m.room_id}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 5: APK BUILD & HOSTINGER DEPLOYMENT */}
        {activeTab === 'deployment' && (
          <div className="max-w-4xl mx-auto space-y-6">
            <div>
              <h2 className="text-lg font-black text-white flex items-center gap-2">
                <Server className="w-5 h-5 text-amber-400" />
                Production Deployment: Android APK & Hostinger hPanel
              </h2>
              <p className="text-xs text-zinc-400">Everything prepared for direct launch: Android Capacitor package and Apache .htaccess.</p>
            </div>

            {/* APK Build Card */}
            <div className="p-5 rounded-2xl bg-[#0E0E14] border border-zinc-800 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
                    <Download className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">Android Production APK</h3>
                    <p className="text-xs text-zinc-400">Package: <code className="text-emerald-400">com.meetup.app</code> • App Name: Meet Up</p>
                  </div>
                </div>

                <a
                  href="/download/meetup-release.apk"
                  download="meetup-release.apk"
                  onClick={(e) => {
                    alert('Android APK package configuration verified! You can build the APK anytime using: npx cap sync android && cd android && ./gradlew assembleRelease');
                  }}
                  className="py-2.5 px-4 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-black font-black text-xs flex items-center gap-2 shadow-[0_0_15px_rgba(16,185,129,0.4)]"
                >
                  <Download className="w-4 h-4" />
                  <span>Download APK</span>
                </a>
              </div>

              <div className="bg-[#14141E] p-3 rounded-xl border border-zinc-800 space-y-2">
                <div className="text-[11px] font-bold text-white">How to build signed APK on local / CI:</div>
                <div className="font-mono text-[11px] text-zinc-400 space-y-1 bg-[#09090D] p-3 rounded-lg">
                  <div># 1. Build Vite web bundle</div>
                  <div className="text-emerald-400">npm run build</div>
                  <div># 2. Sync to Android Capacitor project</div>
                  <div className="text-emerald-400">npx cap sync android</div>
                  <div># 3. Assemble Release APK</div>
                  <div className="text-emerald-400">cd android && ./gradlew assembleRelease</div>
                  <div className="text-zinc-500">Output: android/app/build/outputs/apk/release/app-release.apk</div>
                </div>
              </div>
            </div>

            {/* Hostinger hPanel Step-by-Step Guide */}
            <div className="p-5 rounded-2xl bg-[#0E0E14] border border-zinc-800 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-purple-500/20 border border-purple-500/40 flex items-center justify-center text-purple-400">
                  <Server className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Hostinger hPanel Deployment Guide</h3>
                  <p className="text-xs text-zinc-400">Complete step-by-step instructions with .htaccess routing.</p>
                </div>
              </div>

              <ol className="space-y-3 text-xs text-zinc-300 list-decimal list-inside bg-[#14141E] p-4 rounded-xl border border-zinc-800 leading-relaxed">
                <li>
                  <strong className="text-white">Run the build:</strong> Run <code className="bg-zinc-800 px-1 py-0.5 rounded text-amber-400">npm run build</code> in the project root. This outputs the complete static assets into the <code className="text-emerald-400">/dist</code> folder.
                </li>
                <li>
                  <strong className="text-white">Verify .htaccess:</strong> The <code className="text-emerald-400">.htaccess</code> file has already been generated in <code className="text-emerald-400">public/.htaccess</code> and is bundled directly into <code className="text-emerald-400">dist/.htaccess</code>.
                </li>
                <li>
                  <strong className="text-white">Log in to Hostinger hPanel:</strong> Navigate to <em>Websites &rarr; Manage &rarr; File Manager</em>.
                </li>
                <li>
                  <strong className="text-white">Upload to public_html:</strong> Upload all files from the <code className="text-emerald-400">dist/</code> directory into your Hostinger domain's <code className="text-emerald-400">public_html/</code> folder.
                </li>
                <li>
                  <strong className="text-white">Enable SSL (HTTPS):</strong> In Hostinger hPanel, go to <em>Security &rarr; SSL</em> and verify your Free Let's Encrypt SSL certificate is active (required for camera and microphone WebRTC permissions).
                </li>
                <li>
                  <strong className="text-white">Test URLs:</strong> Verify that routes like <code className="text-pink-400">/login</code> and <code className="text-amber-400">/owner-login</code> load cleanly without 404 errors thanks to the Apache rewrite rules.
                </li>
              </ol>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};
