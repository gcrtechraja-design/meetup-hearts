import React, { useState, useEffect } from 'react';
import { Coins, Sparkles, ShieldCheck, ArrowRight, AlertTriangle, Loader2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { COIN_STORE_PLANS, CoinStorePlan, getAdminUpiId } from '../services/paymentService';
import { ManualPaymentPopup } from './ManualPaymentPopup';

interface CoinStorePageProps {
  onClose?: () => void;
}

export const CoinStorePage: React.FC<CoinStorePageProps> = ({ onClose }) => {
  const { currentUser } = useAuth();
  const [selectedPlanForPayment, setSelectedPlanForPayment] = useState<CoinStorePlan | null>(null);
  const [fetchedUpiId, setFetchedUpiId] = useState<string | null>(null);
  const [isLoadingConfig, setIsLoadingConfig] = useState<boolean>(true);
  const [configError, setConfigError] = useState<string | null>(null);

  // On Coin Store page load, fetch UPI ID from Firestore: collection 'settings', doc 'payment_config', field 'upi_id'
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
        console.error('CoinStorePage: Error fetching UPI ID:', err);
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

  return (
    <div className="w-full space-y-4">
      {/* Coin Store Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-black text-white flex items-center gap-2">
            <Coins className="w-5 h-5 text-amber-400" />
            <span>Coin Store</span>
          </h3>
          <p className="text-xs text-zinc-400">Buy coins directly via Google Pay / UPI</p>
        </div>
      </div>

      {/* If error: Show error "Payment config not found" */}
      {configError && !isLoadingConfig && (
        <div className="p-3 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-300 flex items-center gap-2.5 text-xs animate-in fade-in">
          <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
          <div className="flex-1">
            <span className="font-bold block">Payment config not found</span>
            <span className="text-[11px] text-rose-300/80">
              Purchases are temporarily unavailable. Please contact the administrator.
            </span>
          </div>
        </div>
      )}

      {/* 2 Plans in Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
        {COIN_STORE_PLANS.map((plan) => (
          <div
            key={plan.coins}
            className={`relative rounded-2xl p-4 border transition-all duration-200 flex flex-col justify-between ${
              plan.popular && !isBuyDisabled
                ? 'bg-gradient-to-b from-[#1E192B] to-[#14121E] border-[#FF69B4]/50 shadow-[0_0_20px_rgba(255,105,180,0.15)]'
                : 'bg-[#151520] border-[#29293C]'
            }`}
          >
            {plan.popular && (
              <span className={`absolute -top-2.5 right-4 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                isBuyDisabled
                  ? 'bg-zinc-700 text-zinc-300'
                  : 'bg-[#FF69B4] text-white shadow-[0_0_10px_#FF69B4]'
              }`}>
                Popular
              </span>
            )}

            <div>
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-full bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-lg">
                  🪙
                </div>
                <div>
                  <div className="text-xl font-black text-white">
                    {plan.coins} Coins
                  </div>
                  <div className="text-[11px] text-zinc-400">Instant direct UPI recharge</div>
                </div>
              </div>

              <div className="mt-2 py-2 px-3 rounded-xl bg-black/30 border border-white/5 flex items-baseline justify-between">
                <span className="text-xs text-zinc-400 font-medium">Price</span>
                <span className={`text-2xl font-black ${isBuyDisabled ? 'text-zinc-400' : 'text-emerald-400'}`}>
                  ₹{plan.amount}
                </span>
              </div>
            </div>

            {/* Buy Now Button - Disabled if payment config not found */}
            <button
              type="button"
              disabled={isBuyDisabled}
              onClick={() => {
                if (!isBuyDisabled) {
                  setSelectedPlanForPayment(plan);
                }
              }}
              title={configError || (isBuyDisabled ? 'Payment config not found' : 'Buy Now')}
              className={`w-full mt-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition flex items-center justify-center gap-1.5 shadow-lg ${
                isBuyDisabled
                  ? 'bg-zinc-800 text-zinc-500 border border-zinc-700/50 cursor-not-allowed opacity-60'
                  : plan.popular
                  ? 'bg-gradient-to-r from-[#FF69B4] to-pink-600 hover:opacity-95 text-white shadow-pink-500/25 cursor-pointer active:scale-95'
                  : 'bg-emerald-500 hover:bg-emerald-600 text-white shadow-emerald-500/20 cursor-pointer active:scale-95'
              }`}
            >
              {isLoadingConfig ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Checking Availability...</span>
                </>
              ) : isBuyDisabled ? (
                <span>Payment config not found</span>
              ) : (
                <>
                  <span>Buy Now</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        ))}
      </div>

      {/* Payment Popup Modal */}
      {selectedPlanForPayment && fetchedUpiId && (
        <ManualPaymentPopup
          plan={selectedPlanForPayment}
          initialUpiId={fetchedUpiId}
          onClose={() => setSelectedPlanForPayment(null)}
          onSuccess={() => {
            // Optional success callback
          }}
        />
      )}
    </div>
  );
};

export default CoinStorePage;
