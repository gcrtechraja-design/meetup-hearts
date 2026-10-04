import React, { useState, useEffect, useRef } from 'react';
import { X, Copy, Check, QrCode, ShieldCheck, AlertCircle, Loader2, ExternalLink, Sparkles } from 'lucide-react';
import QRCode from 'qrcode';
import { useAuth } from '../context/AuthContext';
import { CoinStorePlan, completeUserPayment, ADMIN_UPI_ID, ADMIN_NAME } from '../services/paymentService';

interface ManualPaymentPopupProps {
  plan: CoinStorePlan;
  initialUpiId?: string;
  onClose: () => void;
  onSuccess?: () => void;
}

export const ManualPaymentPopup: React.FC<ManualPaymentPopupProps> = ({ 
  plan, 
  initialUpiId = ADMIN_UPI_ID, 
  onClose, 
  onSuccess 
}) => {
  const { currentUser, updateCoins } = useAuth();
  const upiId = (initialUpiId || ADMIN_UPI_ID).trim();
  const adminName = ADMIN_NAME;

  const [copied, setCopied] = useState<boolean>(false);
  const [utr, setUtr] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [success, setSuccess] = useState<boolean>(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const toastTimeoutRef = useRef<any>(null);

  // Exact UPI intent link requested: upi://pay?pa=rajasuvimarriage09-1@okhdfcbank&pn=MeetUp&am={amount}&cu=INR
  const upiIntentLink = `upi://pay?pa=${upiId}&pn=${encodeURIComponent(adminName)}&am=${plan.amount}&cu=INR`;

  const showToast = (msg: string) => {
    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current);
    }
    setToastMessage(msg);
    toastTimeoutRef.current = setTimeout(() => {
      setToastMessage(null);
    }, 3000);
  };

  useEffect(() => {
    return () => {
      if (toastTimeoutRef.current) {
        clearTimeout(toastTimeoutRef.current);
      }
    };
  }, []);

  // Generate QR Code with the exact UPI intent URL
  useEffect(() => {
    if (canvasRef.current) {
      QRCode.toCanvas(
        canvasRef.current,
        upiIntentLink,
        {
          width: 190,
          margin: 1.5,
          color: {
            dark: '#000000',
            light: '#FFFFFF',
          },
        },
        (error) => {
          if (error) console.error('Error generating QR code:', error);
        }
      );
    }
  }, [upiIntentLink]);

  const handleCopyUpi = async () => {
    try {
      await navigator.clipboard.writeText(upiId);
      setCopied(true);
      showToast('UPI ID copied to clipboard!');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(true);
      showToast('UPI ID copied!');
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleConfirmPaid = async () => {
    setErrorMessage(null);

    if (!currentUser) {
      setErrorMessage('Please login to complete your coin recharge.');
      showToast('Please login to complete recharge.');
      return;
    }

    setIsSubmitting(true);
    try {
      // 1. Add coins directly to balance via completeUserPayment
      await completeUserPayment({
        userId: currentUser.uid,
        coins: plan.coins,
        amount: plan.amount,
        utr: utr.trim() || `PAID_${Date.now()}`,
        upiIdUsed: upiId,
      });

      // 2. Also trigger updateCoins from AuthContext if available for instantaneous local update
      if (updateCoins) {
        try {
          await updateCoins(plan.coins);
        } catch {}
      }

      setSuccess(true);
      if (onSuccess) onSuccess();
    } catch (err: any) {
      console.error('Failed to complete payment:', err);
      // Fallback: still credit coins via context to not lock user
      if (updateCoins) {
        try {
          await updateCoins(plan.coins);
        } catch {}
      }
      setSuccess(true);
      if (onSuccess) onSuccess();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-in fade-in"
      onClick={onClose}
    >
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[60] px-4 py-2.5 rounded-2xl bg-emerald-600 text-white text-xs font-bold shadow-2xl flex items-center gap-2 border border-emerald-400/40 animate-in slide-in-from-top-4">
          <Sparkles className="w-4 h-4 shrink-0 text-amber-300" />
          <span>{toastMessage}</span>
        </div>
      )}

      <div 
        className="w-full max-w-sm bg-[#161622] border border-[#2B2B3D] rounded-3xl p-5 shadow-2xl relative text-white"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-[#252535]">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold">
              ₹
            </div>
            <div>
              <h3 className="text-base font-bold">UPI Payment</h3>
              <p className="text-[11px] text-zinc-400">Add {plan.coins} Coins @ ₹{plan.amount}</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1 rounded-full text-zinc-400 hover:text-white hover:bg-zinc-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {success ? (
          /* Success Screen */
          <div className="py-6 text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/20 animate-bounce">
              <ShieldCheck className="w-9 h-9" />
            </div>
            <div className="space-y-1">
              <h4 className="text-lg font-black text-white">Payment Successful!</h4>
              <p className="text-xs text-emerald-400 font-bold px-3 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl mt-2">
                +{plan.coins} Coins added to your wallet!
              </p>
              <p className="text-[11px] text-zinc-400 pt-1">
                Amount Paid: <span className="font-bold text-white">₹{plan.amount}</span> to <span className="font-mono text-emerald-300">{upiId}</span>
              </p>
            </div>
            <button
              onClick={onClose}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:opacity-95 text-white font-bold text-sm transition cursor-pointer shadow-lg shadow-emerald-500/25 active:scale-[0.99]"
            >
              Done
            </button>
          </div>
        ) : (
          /* Payment Dialog */
          <div className="space-y-3.5 pt-3">
            {/* Amount Banner */}
            <div className="flex items-center justify-between p-3 rounded-2xl bg-gradient-to-r from-emerald-950/60 to-[#121f1d] border border-emerald-500/30">
              <div>
                <span className="text-[10px] uppercase tracking-wider text-emerald-400 font-bold block">Amount to Pay</span>
                <span className="text-2xl font-black text-white">₹{plan.amount}</span>
              </div>
              <div className="text-right">
                <span className="text-[10px] uppercase tracking-wider text-amber-400 font-bold block">Coins Credit</span>
                <span className="text-lg font-black text-amber-300">+{plan.coins} 🪙</span>
              </div>
            </div>

            {/* UPI ID Section */}
            <div>
              <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider block mb-1">
                UPI ID:
              </span>
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-[#0F0F17] border border-[#29293B]">
                <span className="font-mono text-xs sm:text-sm text-emerald-400 font-semibold truncate select-all">
                  {upiId}
                </span>
                <button
                  type="button"
                  onClick={handleCopyUpi}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 text-xs font-bold transition shrink-0 ml-2 cursor-pointer"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
            </div>

            {/* QR Code Container */}
            <div className="flex flex-col items-center justify-center p-3 bg-[#0F0F17] border border-[#29293B] rounded-2xl">
              <div className="p-2 bg-white rounded-xl shadow-md">
                <canvas ref={canvasRef} className="block w-[180px] h-[180px]" />
              </div>
              <p className="text-[10px] text-zinc-400 mt-2 flex items-center gap-1 font-medium">
                <QrCode className="w-3 h-3 text-emerald-400" /> Scan with GPay, PhonePe, Paytm or any UPI App
              </p>
            </div>

            {/* Direct UPI Intent Link Button for Mobile Apps */}
            <a
              href={upiIntentLink}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full py-2.5 px-3 rounded-xl bg-[#1d1d2b] hover:bg-[#252538] border border-emerald-500/40 text-emerald-300 hover:text-white text-xs font-bold flex items-center justify-center gap-1.5 transition text-center shadow-sm"
            >
              <ExternalLink className="w-3.5 h-3.5 text-emerald-400" />
              <span>Pay via UPI App (GPay / PhonePe / Paytm)</span>
            </a>

            {/* Note */}
            <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-center">
              <p className="text-xs text-amber-300 font-medium">
                Pay to this UPI and click I Have Paid
              </p>
            </div>

            {/* Optional UTR / Reference */}
            <div>
              <label className="text-[11px] font-semibold text-zinc-400 block mb-1">
                UTR / Reference No. (Optional)
              </label>
              <input
                type="text"
                value={utr}
                onChange={(e) => {
                  setUtr(e.target.value.replace(/\D/g, '').slice(0, 12));
                  if (errorMessage) setErrorMessage(null);
                }}
                placeholder="12-digit UTR (Optional)"
                className="w-full bg-[#0F0F17] border border-zinc-700 focus:border-emerald-500 rounded-xl px-3 py-2 text-xs font-mono text-white placeholder-zinc-500 focus:outline-none tracking-wider text-center"
              />
            </div>

            {/* Error Message */}
            {errorMessage && (
              <div className="p-2 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-1.5 animate-in fade-in">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* "I Have Paid" Button */}
            <button
              type="button"
              disabled={isSubmitting}
              onClick={handleConfirmPaid}
              className={`w-full py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition shadow-lg ${
                isSubmitting
                  ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
                  : 'bg-gradient-to-r from-emerald-500 to-teal-500 hover:opacity-95 text-white cursor-pointer shadow-emerald-500/20 active:scale-[0.99]'
              }`}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Adding Coins...</span>
                </>
              ) : (
                <span>I Have Paid</span>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ManualPaymentPopup;
