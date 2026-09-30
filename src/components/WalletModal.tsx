import React, { useState, useEffect } from 'react';
import { X, Coins, Sparkles, AlertTriangle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { CoinStorePlan, getAdminUpiId } from '../services/paymentService';
import { ManualPaymentPopup } from './ManualPaymentPopup';

export interface CoinPack {
  id: string;
  coins: number;
  price: number;
  originalPrice?: number;
  discountText?: string;
  badge?: 'Hot' | 'Value';
  badgeColor?: 'pink' | 'orange';
}

export const COIN_PACKS: CoinPack[] = [
  {
    id: 'pack_80',
    coins: 80,
    price: 62,
  },
  {
    id: 'pack_300',
    coins: 300,
    price: 149,
  },
  {
    id: 'pack_450',
    coins: 450,
    price: 251,
  },
  {
    id: 'pack_1100',
    coins: 1100,
    price: 550,
  },
  {
    id: 'pack_1800',
    coins: 1800,
    price: 405,
    originalPrice: 1055,
    discountText: 'Flat ₹650 off',
    badge: 'Hot',
    badgeColor: 'pink',
  },
  {
    id: 'pack_3500',
    coins: 3500,
    price: 1049,
    originalPrice: 1549,
    discountText: 'Flat ₹500 off',
  },
  {
    id: 'pack_5000',
    coins: 5000,
    price: 1999,
    badge: 'Hot',
    badgeColor: 'pink',
  },
  {
    id: 'pack_9000',
    coins: 9000,
    price: 2651,
    originalPrice: 3251,
    discountText: 'Flat ₹600 off',
  },
  {
    id: 'pack_20000',
    coins: 20000,
    price: 5000,
    originalPrice: 8000,
    discountText: 'Flat ₹3000 off',
    badge: 'Value',
    badgeColor: 'orange',
  },
];

interface WalletModalProps {
  onClose: () => void;
}

export const WalletModal: React.FC<WalletModalProps> = ({ onClose }) => {
  const { currentUser } = useAuth();
  const [selectedPlanForPayment, setSelectedPlanForPayment] = useState<CoinStorePlan | null>(null);
  const [fetchedUpiId, setFetchedUpiId] = useState<string | null>(null);
  const [isLoadingConfig, setIsLoadingConfig] = useState<boolean>(true);
  const [configError, setConfigError] = useState<string | null>(null);

  // On Coin Store / Wallet load, fetch UPI ID from Firestore: collection 'settings', doc 'payment_config', field 'upi_id'
  useEffect(() => {
    let isMounted = true;
    setIsLoadingConfig(true);
    setConfigError(null);

    getAdminUpiId()
      .then((upi) => {
        if (!isMounted) return;
        if (!upi || !upi.trim()) {
          setFetchedUpiId(null);
          setConfigError('Payment config not found');
        } else {
          setFetchedUpiId(upi.trim());
          setConfigError(null);
        }
      })
      .catch((err) => {
        if (!isMounted) return;
        console.error('WalletModal: Error fetching UPI ID:', err);
        setFetchedUpiId(null);
        setConfigError('Payment config not found');
      })
      .finally(() => {
        if (isMounted) {
          setIsLoadingConfig(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const isBuyDisabled = isLoadingConfig || Boolean(configError) || !fetchedUpiId;

  const handleSelectPack = (pack: CoinPack | { coins: number; price: number; originalPrice?: number; discountText?: string }) => {
    console.log('selected pack:', pack);
    if (isBuyDisabled) return;

    setSelectedPlanForPayment({
      coins: pack.coins,
      amount: pack.price,
    });
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm p-0 sm:p-4 animate-in fade-in"
      onClick={onClose}
    >
      <div 
        className="w-full max-w-lg bg-[#14141C] border-t sm:border border-[#282836] rounded-t-3xl sm:rounded-3xl max-h-[92vh] overflow-y-auto shadow-2xl relative p-4 sm:p-5"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header */}
        <div className="flex items-center justify-between pb-3 border-b border-[#23232C]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Coins className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-white text-base">Coin Store & Wallet</h3>
              <p className="text-[11px] text-zinc-400">Manual UPI recharge for audio & video calls</p>
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

        {/* Current Balance Card */}
        <div className="my-3.5 p-3.5 rounded-2xl bg-gradient-to-br from-[#1F1F2B] to-[#121217] border border-[#2B2B3B] flex items-center justify-between">
          <div>
            <span className="text-[11px] text-zinc-400 font-medium">Your Current Balance</span>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span className="text-2xl sm:text-3xl font-black text-amber-300">
                {(currentUser?.coins_balance ?? currentUser?.coin_balance ?? 0).toLocaleString()}
              </span>
              <span className="text-xs text-amber-400 font-bold">Coins</span>
            </div>
          </div>

          <div className="text-right pl-4 border-l border-zinc-800">
            <span className="text-[11px] text-zinc-400 font-medium">Diamonds Earned</span>
            <div className="flex items-baseline justify-end gap-1 mt-0.5">
              <span className="text-xl sm:text-2xl font-bold text-cyan-400">
                {currentUser?.diamonds_balance?.toLocaleString() ?? 0}
              </span>
              <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
            </div>
          </div>
        </div>

        {/* If Error: Show "Payment config not found" banner */}
        {configError && !isLoadingConfig && (
          <div className="my-3 p-3 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-300 flex items-center gap-2.5 text-xs animate-in fade-in">
            <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
            <div className="flex-1">
              <span className="font-bold block">Payment config not found</span>
              <span className="text-[11px] text-rose-300/80">
                Buy buttons are disabled until the administrator configures the UPI ID in settings.
              </span>
            </div>
          </div>
        )}

        {/* Top Banner Offer */}
        <div
          onClick={() => handleSelectPack({ coins: 2500, price: 620, originalPrice: 1250, discountText: 'Flat ₹630 off' })}
          className={`my-3.5 relative overflow-hidden rounded-2xl p-3.5 sm:p-4 bg-gradient-to-r from-emerald-700 via-emerald-600 to-teal-600 text-white shadow-lg transition-all group ${
            isBuyDisabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer hover:opacity-95'
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-black/30 backdrop-blur-sm text-[11px] font-black tracking-wide text-amber-300">
                <Sparkles className="w-3 h-3 text-amber-300" />
                <span>Flat ₹630 off</span>
              </div>
              <div className="flex items-baseline gap-2 pt-0.5">
                <span className="text-base sm:text-lg font-black tracking-tight text-white">2500 coins</span>
                <span className="text-xs font-semibold text-emerald-100">@</span>
                <span className="line-through text-xs text-emerald-200/80 font-medium">₹1250</span>
                <span className="text-lg sm:text-xl font-black text-white">₹620</span>
              </div>
            </div>
            <div className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center text-xl shrink-0 group-hover:scale-110 transition-transform">
              🪙
            </div>
          </div>
        </div>

        {/* 3 Column Grid of Coin Packs */}
        <div className="space-y-2 mt-4">
          <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
            More Coin Packs
          </h4>

          <div className="grid grid-cols-3 gap-2.5 sm:gap-3 pt-1">
            {COIN_PACKS.map((pack) => (
              <div
                key={pack.id}
                onClick={() => handleSelectPack(pack)}
                className={`relative bg-[#161622] border rounded-2xl p-2.5 sm:p-3 flex flex-col items-center justify-between text-center transition-all duration-200 shadow-md group ${
                  isBuyDisabled
                    ? 'border-[#272738] opacity-60 cursor-not-allowed'
                    : 'hover:bg-[#1C1C2A] border-[#272738] hover:border-zinc-500 cursor-pointer hover:shadow-xl'
                }`}
              >
                {/* Top Badge */}
                {pack.badge && (
                  <span
                    className={`absolute -top-2.5 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider shadow-md ${
                      pack.badgeColor === 'pink'
                        ? 'bg-[#FF69B4] text-white shadow-[0_0_8px_rgba(255,105,180,0.6)]'
                        : 'bg-orange-500 text-white shadow-[0_0_8px_rgba(249,115,22,0.6)]'
                    }`}
                  >
                    {pack.badge}
                  </span>
                )}

                {/* Coin Icon Top */}
                <div className="w-8 h-8 rounded-full bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-base mb-1 mt-0.5 group-hover:scale-110 transition-transform">
                  🪙
                </div>

                {/* Coin Count Middle Bold White */}
                <div className="my-1">
                  <div className="text-base sm:text-lg font-black text-white leading-tight">
                    {pack.coins.toLocaleString()}
                  </div>
                  <div className="text-[10px] text-zinc-400 font-medium">coins</div>
                </div>

                {/* Price Bottom */}
                <div className="w-full pt-1.5 border-t border-[#232332] flex flex-col items-center justify-center min-h-[44px]">
                  {pack.originalPrice && (
                    <span className="line-through text-zinc-500 text-[10px] sm:text-[11px] leading-tight">
                      ₹{pack.originalPrice}
                    </span>
                  )}
                  {pack.discountText && (
                    <span className="text-purple-400 font-bold text-[9px] sm:text-[10px] leading-tight">
                      {pack.discountText}
                    </span>
                  )}
                  <span className={`text-xs sm:text-sm font-black mt-0.5 ${isBuyDisabled ? 'text-zinc-400' : 'text-emerald-400'}`}>
                    ₹{pack.price}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom text */}
        <div className="pt-4 pb-2 text-center space-y-1">
          <div className="text-xs font-semibold text-zinc-300 flex items-center justify-center gap-1.5">
            <span>10 🪙 = 1 💎</span>
          </div>
          <p className="text-[11px] text-zinc-400">
            <button
              type="button"
              onClick={() => console.log('Learn more about Diamonds')}
              className="underline hover:text-white transition text-zinc-400 cursor-pointer"
            >
              Learn more about Diamonds
            </button>
          </p>
        </div>
      </div>

      {/* Manual Payment Popup Modal */}
      {selectedPlanForPayment && fetchedUpiId && (
        <ManualPaymentPopup
          plan={selectedPlanForPayment}
          initialUpiId={fetchedUpiId}
          onClose={() => setSelectedPlanForPayment(null)}
        />
      )}
    </div>
  );
};

export default WalletModal;
