import React, { useEffect, useState } from 'react';
import { 
  X, 
  Receipt, 
  ArrowUpRight, 
  Coins, 
  Clock, 
  Copy, 
  Check, 
  AlertCircle, 
  ShieldCheck, 
  ExternalLink,
  Filter,
  Sparkles,
  ArrowRight
} from 'lucide-react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../context/AuthContext';
import { Transaction } from '../types';
import { PaymentStatusBadge, PaymentStatus } from './PaymentStatusBadge';

interface TransactionsModalProps {
  onClose: () => void;
}

export const TransactionsModal: React.FC<TransactionsModalProps> = ({ onClose }) => {
  const { currentUser } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'verified' | 'rejected'>('all');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Real-time synchronization directly with Firestore 'transactions' collection
  useEffect(() => {
    if (!currentUser?.uid) {
      setTransactions([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    const txMap = new Map<string, Transaction>();

    const updateCombinedTransactions = () => {
      const list = Array.from(txMap.values());
      list.sort((a, b) => {
        const timeA = a.createdAt?.seconds 
          ? a.createdAt.seconds * 1000 
          : a.createdAt?.toMillis 
          ? a.createdAt.toMillis() 
          : a.created_at?.seconds 
          ? a.created_at.seconds * 1000 
          : a.created_at?.toMillis 
          ? a.created_at.toMillis() 
          : (a.created_at ? new Date(a.created_at).getTime() : 0);

        const timeB = b.createdAt?.seconds 
          ? b.createdAt.seconds * 1000 
          : b.createdAt?.toMillis 
          ? b.createdAt.toMillis() 
          : b.created_at?.seconds 
          ? b.created_at.seconds * 1000 
          : b.created_at?.toMillis 
          ? b.created_at.toMillis() 
          : (b.created_at ? new Date(b.created_at).getTime() : 0);

        return timeB - timeA;
      });
      setTransactions(list);
      setLoading(false);
    };

    const currentUid = currentUser.uid;
    if (!currentUid) {
      setLoading(false);
      return;
    }

    // Query 1: standard camelCase userId
    const q1 = query(
      collection(db, 'transactions'),
      where('userId', '==', currentUid)
    );

    const unsub1 = onSnapshot(
      q1,
      (snap) => {
        snap.forEach((doc) => {
          txMap.set(doc.id, { id: doc.id, ...doc.data() } as Transaction);
        });
        updateCombinedTransactions();
      },
      (err) => {
        console.warn('Firestore transactions query (userId) notice:', err);
        setLoading(false);
      }
    );

    // Query 2: legacy snake_case user_id fallback
    const q2 = query(
      collection(db, 'transactions'),
      where('user_id', '==', currentUid)
    );

    const unsub2 = onSnapshot(
      q2,
      (snap) => {
        snap.forEach((doc) => {
          txMap.set(doc.id, { id: doc.id, ...doc.data() } as Transaction);
        });
        updateCombinedTransactions();
      },
      (err) => {
        console.warn('Firestore transactions query (user_id) notice:', err);
        setLoading(false);
      }
    );

    return () => {
      unsub1();
      unsub2();
    };
  }, [currentUser?.uid]);

  const handleCopyUtr = (utr: string, id: string) => {
    if (!utr) return;
    navigator.clipboard.writeText(utr).catch(() => {});
    setCopiedId(id);
    setTimeout(() => {
      setCopiedId(null);
    }, 2000);
  };

  /**
   * Formats raw Firestore timestamps, Date objects, or millis into human-readable 'DD MMM, YYYY HH:mm'
   * e.g., '01 Oct, 2026 13:29'
   */
  const formatDate = (val: any): string => {
    if (!val) return 'Recently';
    try {
      let date: Date;
      if (val instanceof Date) {
        date = val;
      } else if (typeof val?.toDate === 'function') {
        date = val.toDate();
      } else if (typeof val?.toMillis === 'function') {
        date = new Date(val.toMillis());
      } else if (typeof val?.seconds === 'number') {
        date = new Date(val.seconds * 1000);
      } else if (typeof val === 'number') {
        date = new Date(val);
      } else if (typeof val === 'string') {
        date = new Date(val);
      } else {
        return 'Recently';
      }

      if (isNaN(date.getTime())) return 'Recently';

      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const day = String(date.getDate()).padStart(2, '0');
      const month = months[date.getMonth()];
      const year = date.getFullYear();
      const hours = String(date.getHours()).padStart(2, '0');
      const minutes = String(date.getMinutes()).padStart(2, '0');

      return `${day} ${month}, ${year} ${hours}:${minutes}`;
    } catch {
      return 'Recently';
    }
  };

  // Filter transactions according to selected tab
  const filteredTransactions = transactions.filter((tx) => {
    if (statusFilter === 'all') return true;
    const s = (tx.status || '').toLowerCase();
    if (statusFilter === 'verified') return s === 'verified' || s === 'success';
    if (statusFilter === 'rejected') return s === 'rejected' || s === 'failed';
    if (statusFilter === 'pending') return s === 'pending';
    return true;
  });

  const pendingCount = transactions.filter((tx) => (tx.status || '').toLowerCase() === 'pending').length;
  const verifiedCount = transactions.filter((tx) => ['verified', 'success'].includes((tx.status || '').toLowerCase())).length;
  const rejectedCount = transactions.filter((tx) => ['rejected', 'failed'].includes((tx.status || '').toLowerCase())).length;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/85 backdrop-blur-md p-0 sm:p-4 animate-in fade-in"
      onClick={onClose}
    >
      <div 
        className="w-full max-w-lg bg-[#14141C] border-t sm:border border-[#282836] rounded-t-3xl sm:rounded-3xl max-h-[88vh] flex flex-col shadow-2xl relative overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-[#23232C] shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-[#FF69B4]/15 border border-[#FF69B4]/30 flex items-center justify-center text-[#FF69B4]">
              <Receipt className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-white text-base">Payment History</h3>
              <p className="text-[11px] text-zinc-400">Track real-time status of your coin recharges</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-zinc-400 hover:text-white hover:bg-[#23232C] transition cursor-pointer"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Filter Navigation Tabs */}
        <div className="px-5 pt-3 pb-2 flex items-center gap-1.5 border-b border-[#1E1E28] shrink-0 overflow-x-auto no-scrollbar">
          <button
            onClick={() => setStatusFilter('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shrink-0 cursor-pointer ${
              statusFilter === 'all'
                ? 'bg-purple-600 text-white shadow-md shadow-purple-600/20'
                : 'bg-[#1C1C26] text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <span>All</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-white/10 font-mono">
              {transactions.length}
            </span>
          </button>

          <button
            onClick={() => setStatusFilter('pending')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shrink-0 cursor-pointer ${
              statusFilter === 'pending'
                ? 'bg-amber-500 text-black shadow-md shadow-amber-500/20 font-black'
                : 'bg-[#1C1C26] text-amber-300/80 hover:text-amber-200'
            }`}
          >
            <Clock className="w-3 h-3" />
            <span>Pending</span>
            {pendingCount > 0 && (
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-black/20 font-mono font-bold">
                {pendingCount}
              </span>
            )}
          </button>

          <button
            onClick={() => setStatusFilter('verified')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shrink-0 cursor-pointer ${
              statusFilter === 'verified'
                ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/20'
                : 'bg-[#1C1C26] text-emerald-400/80 hover:text-emerald-300'
            }`}
          >
            <ShieldCheck className="w-3 h-3" />
            <span>Verified</span>
            {verifiedCount > 0 && (
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-white/10 font-mono">
                {verifiedCount}
              </span>
            )}
          </button>

          <button
            onClick={() => setStatusFilter('rejected')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shrink-0 cursor-pointer ${
              statusFilter === 'rejected'
                ? 'bg-rose-500 text-white shadow-md shadow-rose-500/20'
                : 'bg-[#1C1C26] text-rose-400/80 hover:text-rose-300'
            }`}
          >
            <AlertCircle className="w-3 h-3" />
            <span>Rejected</span>
            {rejectedCount > 0 && (
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-white/10 font-mono">
                {rejectedCount}
              </span>
            )}
          </button>
        </div>

        {/* Transaction Items List */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3">
          {loading ? (
            <div className="py-16 text-center space-y-3">
              <div className="w-7 h-7 border-2 border-[#FF69B4] border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-xs text-zinc-400">Loading payment records from Firestore...</p>
            </div>
          ) : filteredTransactions.length === 0 ? (
            <div className="py-12 sm:py-16 px-4 text-center space-y-4">
              {transactions.length === 0 ? (
                // Full empty state: user has never made any transaction
                <>
                  <div className="relative mx-auto w-16 h-16 rounded-3xl bg-gradient-to-tr from-amber-500/20 via-[#FF69B4]/15 to-purple-600/20 border border-white/10 flex items-center justify-center shadow-xl shadow-purple-900/10">
                    <Coins className="w-8 h-8 text-amber-400" />
                    <Sparkles className="w-4 h-4 text-[#FF69B4] absolute -top-1 -right-1 animate-pulse" />
                  </div>

                  <div className="space-y-1.5 max-w-sm mx-auto">
                    <h4 className="text-base sm:text-lg font-black text-white tracking-tight">
                      No recent transactions
                    </h4>
                    <p className="text-xs sm:text-[13px] text-zinc-400 leading-relaxed">
                      You haven't made any coin recharge requests yet. Recharging your wallet lets you connect with listeners for live audio & video calls!
                    </p>
                  </div>

                  <div className="bg-[#181824] border border-white/5 rounded-2xl p-3.5 max-w-xs mx-auto text-left flex items-start gap-2.5">
                    <span className="text-base select-none">⚡</span>
                    <p className="text-[11px] text-zinc-300 leading-relaxed">
                      <strong className="text-amber-300 font-semibold">Instant UPI:</strong> After transferring through GPay, PhonePe, or Paytm, submit your 12-digit UTR to track verification live.
                    </p>
                  </div>
                </>
              ) : (
                // Filtered empty state: user has transactions, but none match current filter
                <>
                  <div className="w-14 h-14 rounded-2xl bg-[#1C1C28] border border-white/5 flex items-center justify-center text-zinc-400 mx-auto">
                    <Receipt className="w-7 h-7 text-zinc-500" />
                  </div>

                  <div className="space-y-1.5 max-w-xs mx-auto">
                    <h4 className="text-sm sm:text-base font-bold text-white">
                      No {statusFilter} transactions
                    </h4>
                    <p className="text-xs text-zinc-400">
                      You have no transaction records matching the &ldquo;{statusFilter}&rdquo; status.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => setStatusFilter('all')}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/30 text-purple-300 font-bold text-xs transition cursor-pointer"
                  >
                    <span>View All Transactions</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </>
              )}
            </div>
          ) : (
            filteredTransactions.map((tx) => {
              const coins = tx.coins ?? tx.coins_credited ?? 0;
              const amount = tx.amount ?? tx.amount_inr ?? 0;
              const utrNum = tx.utr || tx.gateway_ref || '';
              const txDate = tx.createdAt || tx.created_at;
              const statusNormalized = (tx.status || 'pending').toLowerCase();

              return (
                <div
                  key={tx.id}
                  className="p-4 bg-[#111118] border border-[#232330] hover:border-[#2F2F40] rounded-2xl transition duration-150 space-y-3 shadow-md"
                >
                  {/* Top Row: Coin Amount, Price & Status Badge */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/25 text-amber-400 flex items-center justify-center text-lg font-bold shrink-0">
                        🪙
                      </div>
                      <div>
                        <div className="text-sm font-black text-white flex items-center gap-1.5">
                          <span>+{coins.toLocaleString()} Coins</span>
                        </div>
                        <div className="text-xs text-emerald-400 font-bold mt-0.5">
                          ₹{amount}
                        </div>
                      </div>
                    </div>

                    {/* NEW STATUS BADGE COMPONENT */}
                    <div className="shrink-0">
                      <PaymentStatusBadge status={statusNormalized} size="md" />
                    </div>
                  </div>

                  {/* Middle Row: UTR Number & UPI ID used */}
                  <div className="pt-2 border-t border-[#1C1C26] grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    {utrNum && (
                      <div className="flex items-center justify-between sm:justify-start gap-2 bg-[#0B0B10] px-2.5 py-1.5 rounded-xl border border-white/5">
                        <span className="text-[11px] text-zinc-400 font-medium">UTR:</span>
                        <span className="font-mono text-white font-bold select-all tracking-wider text-[11px]">
                          {utrNum}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleCopyUtr(utrNum, tx.id || utrNum)}
                          className="text-zinc-400 hover:text-white p-1 rounded transition ml-auto cursor-pointer"
                          title="Copy UTR"
                        >
                          {copiedId === (tx.id || utrNum) ? (
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    )}

                    {tx.upi_id_used && (
                      <div className="flex items-center gap-1.5 bg-[#0B0B10] px-2.5 py-1.5 rounded-xl border border-white/5 truncate">
                        <span className="text-[11px] text-zinc-400 font-medium shrink-0">Paid to:</span>
                        <span className="font-mono text-zinc-300 text-[11px] truncate">
                          {tx.upi_id_used}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Bottom Row: Timestamp & Status Explanation */}
                  <div className="flex items-center justify-between text-[11px] text-zinc-500 pt-1">
                    <span className="text-zinc-400 font-mono text-[11px] flex items-center gap-1.5">
                      <Clock className="w-3 h-3 text-zinc-500 shrink-0" />
                      {formatDate(txDate)}
                    </span>

                    {statusNormalized === 'pending' && (
                      <span className="text-amber-400/90 font-medium flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        Verification in ~30 mins
                      </span>
                    )}

                    {(statusNormalized === 'verified' || statusNormalized === 'success') && (
                      <span className="text-emerald-400 font-medium flex items-center gap-1">
                        <Check className="w-3 h-3" />
                        Coins added to balance
                      </span>
                    )}

                    {(statusNormalized === 'rejected' || statusNormalized === 'failed') && (
                      <span className="text-rose-400 font-medium flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" />
                        Verification rejected
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer info banner */}
        <div className="px-5 py-3 border-t border-[#1C1C26] bg-[#0E0E14] text-center text-[11px] text-zinc-500 shrink-0">
          Status updates reflect in real-time when verified by the administration team.
        </div>
      </div>
    </div>
  );
};

export default TransactionsModal;
