import React, { useEffect, useState } from 'react';
import { X, Receipt, CheckCircle, Clock, XCircle, ArrowUpRight } from 'lucide-react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../context/AuthContext';
import { Transaction } from '../types';

interface TransactionsModalProps {
  onClose: () => void;
}

export const TransactionsModal: React.FC<TransactionsModalProps> = ({ onClose }) => {
  const { currentUser } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentUser) return;
    const fetchTransactions = async () => {
      setLoading(true);
      try {
        const q = query(collection(db, 'transactions'), where('user_id', '==', currentUser.uid));
        const snap = await getDocs(q);
        const list: Transaction[] = [];
        snap.forEach((d) => list.push({ id: d.id, ...d.data() } as Transaction));
        list.sort((a, b) => {
          const tA = a.created_at?.toMillis ? a.created_at.toMillis() : (a.created_at ? new Date(a.created_at).getTime() : 0);
          const tB = b.created_at?.toMillis ? b.created_at.toMillis() : (b.created_at ? new Date(b.created_at).getTime() : 0);
          return tB - tA;
        });
        setTransactions(list);
      } catch (err) {
        console.error('Error fetching transactions:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchTransactions();
  }, [currentUser]);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/85 backdrop-blur-sm p-0 sm:p-4 animate-in fade-in">
      <div 
        className="w-full max-w-md bg-[#16161C] border-t sm:border border-[#2A2A36] rounded-t-3xl sm:rounded-3xl max-h-[85vh] overflow-y-auto shadow-2xl relative p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between pb-3 border-b border-[#23232C]">
          <div className="flex items-center gap-2">
            <Receipt className="w-5 h-5 text-[#FF69B4]" />
            <h3 className="font-bold text-white text-base">My Transactions</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-zinc-400 hover:text-white hover:bg-[#23232C] transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="py-4 space-y-3">
          {loading ? (
            <div className="py-12 text-center text-xs text-zinc-500">Loading transactions...</div>
          ) : transactions.length === 0 ? (
            <div className="py-12 text-center space-y-2">
              <Receipt className="w-10 h-10 text-zinc-600 mx-auto" />
              <p className="text-white font-bold text-sm">No transaction records yet</p>
              <p className="text-xs text-zinc-500">
                Purchases made through the wallet will appear here.
              </p>
            </div>
          ) : (
            transactions.map((tx) => (
              <div
                key={tx.id}
                className="p-3.5 bg-[#0B0B0E] border border-[#23232C] rounded-2xl flex items-center justify-between gap-3"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                    <ArrowUpRight className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-white">
                      +{tx.coins_credited} Coins Credited
                    </div>
                    <div className="text-[10px] text-zinc-500 font-mono mt-0.5">
                      {tx.gateway_ref}
                    </div>
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-xs font-bold text-emerald-400">₹{tx.amount_inr}</div>
                  <div className="text-[10px] text-emerald-500 font-medium capitalize flex items-center justify-end gap-1">
                    <CheckCircle className="w-3 h-3" />
                    {tx.status}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
