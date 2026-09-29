import React, { useState } from 'react';
import { X, Coins, Sparkles, ShieldCheck, CheckCircle2, ArrowRight, CreditCard, Smartphone, Building } from 'lucide-react';
import confetti from 'canvas-confetti';
import { collection, addDoc, serverTimestamp, doc, updateDoc, increment } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../context/AuthContext';
import { CoinPackage, Transaction } from '../types';

interface WalletModalProps {
  onClose: () => void;
}

const COIN_PACKAGES: CoinPackage[] = [
  { id: 'pkg_80', coins: 80, price_inr: 99, tag: 'Starter' },
  { id: 'pkg_300', coins: 300, price_inr: 399, tag: 'Popular', popular: true },
  { id: 'pkg_1100', coins: 1100, price_inr: 1499, tag: 'Best Value' },
  { id: 'pkg_1800', coins: 1800, price_inr: 2499, tag: 'VIP Pack' },
];

export const WalletModal: React.FC<WalletModalProps> = ({ onClose }) => {
  const { currentUser } = useAuth();
  const [selectedPackage, setSelectedPackage] = useState<CoinPackage>(COIN_PACKAGES[1]);
  const [paymentStep, setPaymentStep] = useState<'select' | 'checkout' | 'processing' | 'success'>('select');
  const [paymentGateway, setPaymentGateway] = useState<'phonepe' | 'cashfree'>('phonepe');
  const [paymentMethod, setPaymentMethod] = useState<'upi' | 'card' | 'netbanking'>('upi');
  const [upiId, setUpiId] = useState('user@okhdfcbank');

  const handleInitiateCheckout = () => {
    setPaymentStep('checkout');
  };

  const handlePayTest = async () => {
    if (!currentUser) return;
    setPaymentStep('processing');

    try {
      // Simulate real-time gateway verification delay
      await new Promise((res) => setTimeout(res, 1800));

      const gatewayRef = `${paymentGateway.toUpperCase()}_TEST_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

      // 1. Credit coins directly to user document in Firestore
      const userRef = doc(db, 'users', currentUser.uid);
      await updateDoc(userRef, {
        coins_balance: increment(selectedPackage.coins),
      });

      // 2. Add transaction record to Firestore transactions collection
      const txnData: Transaction = {
        user_id: currentUser.uid,
        amount_inr: selectedPackage.price_inr,
        coins_credited: selectedPackage.coins,
        gateway_ref: gatewayRef,
        status: 'success',
        created_at: serverTimestamp(),
      };
      await addDoc(collection(db, 'transactions'), txnData);

      // 3. Confetti celebration
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#FF69B4', '#FFD700', '#00FFFF'],
      });

      setPaymentStep('success');
    } catch (error) {
      console.error('Payment processing failed:', error);
      alert('Payment simulation failed. Please try again.');
      setPaymentStep('checkout');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/85 backdrop-blur-md p-0 sm:p-4 animate-in fade-in">
      <div 
        className="w-full max-w-md bg-[#16161C] border-t sm:border border-[#2A2A36] rounded-t-3xl sm:rounded-3xl max-h-[92vh] overflow-y-auto shadow-2xl relative p-5"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header */}
        <div className="flex items-center justify-between pb-3 border-b border-[#23232C]">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-amber-500/20 flex items-center justify-center text-amber-400">
              <Coins className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-white text-base">Coin Wallet</h3>
              <p className="text-[11px] text-zinc-400">Instant recharge for audio & video calls</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-zinc-400 hover:text-white hover:bg-[#23232C] transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Current Balance Card */}
        <div className="my-4 p-4 rounded-2xl bg-gradient-to-br from-[#20202A] to-[#121217] border border-[#2E2E3C] flex items-center justify-between">
          <div>
            <span className="text-xs text-zinc-400 font-medium">Your Current Balance</span>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span className="text-3xl font-extrabold text-amber-300">
                {currentUser?.coins_balance?.toLocaleString() ?? 0}
              </span>
              <span className="text-xs text-amber-400/80 font-bold">Coins</span>
            </div>
          </div>

          <div className="text-right pl-4 border-l border-zinc-800">
            <span className="text-xs text-zinc-400 font-medium">Diamonds Earned</span>
            <div className="flex items-baseline justify-end gap-1 mt-0.5">
              <span className="text-2xl font-bold text-cyan-400">
                {currentUser?.diamonds_balance?.toLocaleString() ?? 0}
              </span>
              <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
            </div>
          </div>
        </div>

        {/* State 1: Package Selection */}
        {paymentStep === 'select' && (
          <div className="space-y-4">
            <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
              Select Coin Package
            </h4>

            <div className="grid grid-cols-2 gap-3">
              {COIN_PACKAGES.map((pkg) => {
                const isSelected = selectedPackage.id === pkg.id;
                return (
                  <div
                    key={pkg.id}
                    onClick={() => setSelectedPackage(pkg)}
                    className={`relative p-4 rounded-2xl border cursor-pointer transition-all duration-200 flex flex-col justify-between ${
                      isSelected
                        ? 'bg-[#FF69B4]/10 border-[#FF69B4] shadow-[0_0_15px_rgba(255,105,180,0.3)]'
                        : 'bg-[#0B0B0E] border-[#23232C] hover:border-zinc-700'
                    }`}
                  >
                    {pkg.tag && (
                      <span
                        className={`absolute -top-2.5 right-3 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                          pkg.popular
                            ? 'bg-[#FF69B4] text-white shadow-[0_0_8px_#FF69B4]'
                            : 'bg-zinc-800 text-zinc-300 border border-zinc-700'
                        }`}
                      >
                        {pkg.tag}
                      </span>
                    )}

                    <div className="flex items-center gap-1.5 mb-2">
                      <div className="w-6 h-6 rounded-full bg-amber-500/20 flex items-center justify-center text-amber-400">
                        <Coins className="w-4 h-4" />
                      </div>
                      <span className="text-lg font-black text-white">{pkg.coins}</span>
                    </div>

                    <div className="pt-2 border-t border-zinc-800/60 flex items-center justify-between">
                      <span className="text-xs text-zinc-400">Price</span>
                      <span className="text-sm font-extrabold text-emerald-400">
                        ₹{pkg.price_inr}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Gateway Selection */}
            <div className="pt-2">
              <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider block mb-2">
                Payment Gateway (Test Mode)
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setPaymentGateway('phonepe')}
                  className={`p-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition ${
                    paymentGateway === 'phonepe'
                      ? 'bg-purple-900/30 border-purple-500 text-purple-300'
                      : 'bg-[#0B0B0E] border-[#23232C] text-zinc-400'
                  }`}
                >
                  <span className="w-2 h-2 rounded-full bg-purple-400"></span>
                  PhonePe Sandbox
                </button>

                <button
                  type="button"
                  onClick={() => setPaymentGateway('cashfree')}
                  className={`p-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition ${
                    paymentGateway === 'cashfree'
                      ? 'bg-cyan-900/30 border-cyan-500 text-cyan-300'
                      : 'bg-[#0B0B0E] border-[#23232C] text-zinc-400'
                  }`}
                >
                  <span className="w-2 h-2 rounded-full bg-cyan-400"></span>
                  Cashfree Sandbox
                </button>
              </div>
            </div>

            <button
              onClick={handleInitiateCheckout}
              className="w-full mt-3 py-3.5 rounded-xl bg-gradient-to-r from-[#FF69B4] to-pink-600 hover:opacity-95 text-white font-bold text-sm transition shadow-[0_0_15px_rgba(255,105,180,0.4)] flex items-center justify-center gap-2"
            >
              <span>Pay ₹{selectedPackage.price_inr} for {selectedPackage.coins} Coins</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* State 2: Simulated Checkout Screen */}
        {paymentStep === 'checkout' && (
          <div className="space-y-4 py-2">
            <div className="p-3 bg-[#0B0B0E] rounded-xl border border-[#23232C] flex items-center justify-between">
              <div>
                <span className="text-xs text-zinc-400">Order Summary</span>
                <div className="text-sm font-bold text-white">{selectedPackage.coins} Coins Package</div>
              </div>
              <div className="text-right">
                <span className="text-xs text-zinc-400">Total Payable</span>
                <div className="text-base font-extrabold text-emerald-400">₹{selectedPackage.price_inr}</div>
              </div>
            </div>

            {/* Payment Methods */}
            <div className="space-y-2">
              <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider block">
                Select Test Payment Mode
              </span>

              <div
                onClick={() => setPaymentMethod('upi')}
                className={`p-3 rounded-xl border cursor-pointer flex items-center justify-between transition ${
                  paymentMethod === 'upi'
                    ? 'bg-[#FF69B4]/15 border-[#FF69B4] text-white'
                    : 'bg-[#0B0B0E] border-[#23232C] text-zinc-400'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Smartphone className="w-5 h-5 text-emerald-400" />
                  <div>
                    <div className="text-xs font-bold">Instant UPI (GPay / PhonePe / Paytm)</div>
                    <div className="text-[11px] text-zinc-400">Auto-approved simulated UPI handle</div>
                  </div>
                </div>
                <input
                  type="radio"
                  checked={paymentMethod === 'upi'}
                  onChange={() => setPaymentMethod('upi')}
                  className="text-[#FF69B4]"
                />
              </div>

              {paymentMethod === 'upi' && (
                <div className="pl-2">
                  <input
                    type="text"
                    value={upiId}
                    onChange={(e) => setUpiId(e.target.value)}
                    placeholder="Enter UPI ID (e.g. yourname@upi)"
                    className="w-full bg-[#0B0B0E] border border-zinc-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#FF69B4]"
                  />
                </div>
              )}

              <div
                onClick={() => setPaymentMethod('card')}
                className={`p-3 rounded-xl border cursor-pointer flex items-center justify-between transition ${
                  paymentMethod === 'card'
                    ? 'bg-[#FF69B4]/15 border-[#FF69B4] text-white'
                    : 'bg-[#0B0B0E] border-[#23232C] text-zinc-400'
                }`}
              >
                <div className="flex items-center gap-3">
                  <CreditCard className="w-5 h-5 text-sky-400" />
                  <div>
                    <div className="text-xs font-bold">Credit / Debit Card (Test Sandbox)</div>
                    <div className="text-[11px] text-zinc-400">Simulated 4111 Visa test card</div>
                  </div>
                </div>
                <input
                  type="radio"
                  checked={paymentMethod === 'card'}
                  onChange={() => setPaymentMethod('card')}
                  className="text-[#FF69B4]"
                />
              </div>

              <div
                onClick={() => setPaymentMethod('netbanking')}
                className={`p-3 rounded-xl border cursor-pointer flex items-center justify-between transition ${
                  paymentMethod === 'netbanking'
                    ? 'bg-[#FF69B4]/15 border-[#FF69B4] text-white'
                    : 'bg-[#0B0B0E] border-[#23232C] text-zinc-400'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Building className="w-5 h-5 text-amber-400" />
                  <div>
                    <div className="text-xs font-bold">Net Banking</div>
                    <div className="text-[11px] text-zinc-400">SBI, HDFC, ICICI, Axis Test Portal</div>
                  </div>
                </div>
                <input
                  type="radio"
                  checked={paymentMethod === 'netbanking'}
                  onChange={() => setPaymentMethod('netbanking')}
                  className="text-[#FF69B4]"
                />
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setPaymentStep('select')}
                className="flex-1 py-3 rounded-xl bg-[#23232C] text-xs font-bold text-zinc-300 hover:text-white"
              >
                Back
              </button>

              <button
                type="button"
                onClick={handlePayTest}
                className="flex-2 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs transition shadow-lg flex items-center justify-center gap-1.5"
              >
                <ShieldCheck className="w-4 h-4" />
                <span>Simulate Pay ₹{selectedPackage.price_inr}</span>
              </button>
            </div>
          </div>
        )}

        {/* State 3: Processing */}
        {paymentStep === 'processing' && (
          <div className="py-12 text-center flex flex-col items-center space-y-4">
            <div className="w-16 h-16 border-4 border-[#FF69B4]/30 border-t-[#FF69B4] rounded-full animate-spin"></div>
            <div>
              <h4 className="text-base font-bold text-white">Communicating with {paymentGateway.toUpperCase()}...</h4>
              <p className="text-xs text-zinc-400 mt-1">Authorizing ₹{selectedPackage.price_inr} test transaction</p>
            </div>
          </div>
        )}

        {/* State 4: Success */}
        {paymentStep === 'success' && (
          <div className="py-8 text-center flex flex-col items-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center animate-bounce">
              <CheckCircle2 className="w-10 h-10" />
            </div>

            <div>
              <h4 className="text-xl font-black text-white">Payment Successful!</h4>
              <p className="text-xs text-zinc-300 mt-1">
                <span className="text-amber-300 font-bold">+{selectedPackage.coins} Coins</span> credited to your account.
              </p>
              <div className="mt-2 inline-block px-3 py-1 rounded-full bg-[#0B0B0E] border border-zinc-800 text-[11px] text-zinc-400 font-mono">
                Ref: {paymentGateway.toUpperCase()}_TEST_{Date.now().toString().slice(-6)}
              </div>
            </div>

            <button
              onClick={onClose}
              className="w-full py-3.5 rounded-xl bg-[#FF69B4] hover:opacity-95 text-white font-bold text-sm transition shadow-[0_0_15px_rgba(255,105,180,0.4)]"
            >
              Done & Start Calling
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
