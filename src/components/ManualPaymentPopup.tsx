import React, { useState, useEffect, useRef } from 'react';
import { X, Copy, Check, QrCode, ShieldCheck, AlertCircle, Loader2, AlertTriangle } from 'lucide-react';
import QRCode from 'qrcode';
import { useAuth } from '../context/AuthContext';
import { CoinStorePlan, getAdminUpiId, submitManualPayment } from '../services/paymentService';

interface ManualPaymentPopupProps {
  plan: CoinStorePlan;
  initialUpiId?: string;
  onClose: () => void;
  onSuccess?: () => void;
}

export const ManualPaymentPopup: React.FC<ManualPaymentPopupProps> = ({ 
  plan, 
  initialUpiId, 
  onClose, 
  onSuccess 
}) => {
  const { currentUser } = useAuth();
  const [upiId, setUpiId] = useState<string | null>(initialUpiId || null);
  const [isLoadingConfig, setIsLoadingConfig] = useState<boolean>(!initialUpiId);
  const [copied, setCopied] = useState<boolean>(false);
  const [utr, setUtr] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const toastTimeoutRef = useRef<any>(null);

  const showToast = (msg: string) => {
    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current);
    }
    setToastMessage(msg);
    toastTimeoutRef.current = setTimeout(() => {
      setToastMessage(null);
    }, 3500);
  };

  useEffect(() => {
    return () => {
      if (toastTimeoutRef.current) {
        clearTimeout(toastTimeoutRef.current);
      }
    };
  }, []);

  // Fetch UPI ID from Firestore settings collection (doc id: payment_config, field: upi_id) if not already provided
  useEffect(() => {
    if (initialUpiId && initialUpiId.trim()) {
      setUpiId(initialUpiId.trim());
      setIsLoadingConfig(false);
      return;
    }

    let isMounted = true;
    setIsLoadingConfig(true);
    setErrorMessage(null);

    getAdminUpiId()
      .then((id) => {
        if (!isMounted) return;
        if (!id || !id.trim()) {
          setUpiId(null);
          setErrorMessage('Payment config not found');
        } else {
          setUpiId(id.trim());
        }
      })
      .catch((err) => {
        if (!isMounted) return;
        console.error('Failed to load payment config:', err);
        setUpiId(null);
        setErrorMessage('Payment config not found');
      })
      .finally(() => {
        if (isMounted) {
          setIsLoadingConfig(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [initialUpiId]);

  // Generate QR as upi://pay?pa={fetched_upi_id}&pn=RajaMarriageApp&am={plan_amount}&cu=INR
  useEffect(() => {
    if (!upiId) return;

    const upiLink = `upi://pay?pa=${encodeURIComponent(upiId)}&pn=RajaMarriageApp&am=${plan.amount}&cu=INR`;

    if (canvasRef.current) {
      QRCode.toCanvas(
        canvasRef.current,
        upiLink,
        {
          width: 200,
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
  }, [upiId, plan.amount]);

  const handleCopyUpi = async () => {
    if (!upiId) return;
    try {
      await navigator.clipboard.writeText(upiId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleConfirmPaid = async () => {
    setErrorMessage(null);
    const cleanUtr = utr.trim();

    // 1. Validate UTR is not empty, if empty show toast "Please enter UTR number"
    if (!cleanUtr) {
      showToast('Please enter UTR number');
      setErrorMessage('Please enter UTR number');
      return;
    }

    // 2. Validate UPI ID config is available
    if (!upiId) {
      setErrorMessage('Payment config not found');
      showToast('Payment config not found');
      return;
    }

    // 3. User login validation
    if (!currentUser) {
      setErrorMessage('Please login to complete your recharge.');
      showToast('Please login to complete your recharge.');
      return;
    }

    // 4. Validate UTR is 12 digits
    if (!/^\d{12}$/.test(cleanUtr)) {
      setErrorMessage('Please enter a valid 12-digit numeric UTR number.');
      showToast('Please enter a valid 12-digit numeric UTR number.');
      return;
    }

    setIsSubmitting(true);
    try {
      // Create transaction doc with upi_id_used = fetched_upi_id (not hardcoded)
      await submitManualPayment({
        userId: currentUser.uid,
        coins: plan.coins,
        amount: plan.amount,
        utr: cleanUtr,
        upiIdUsed: upiId,
      });

      setSuccessMessage('Payment verification la irukku, 30 mins la coin add aagidum');
      if (onSuccess) onSuccess();
    } catch (err: any) {
      console.error('Failed to submit manual payment:', err);
      const msg = err.message || 'Payment submission failed. Please try again.';
      setErrorMessage(msg);
      showToast(msg);
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
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[60] px-4 py-2.5 rounded-2xl bg-rose-600 text-white text-xs font-bold shadow-2xl flex items-center gap-2 border border-rose-400/40 animate-in slide-in-from-top-4">
          <AlertCircle className="w-4 h-4 shrink-0 text-white" />
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
              <h3 className="text-base font-bold">Manual UPI Payment</h3>
              <p className="text-[11px] text-zinc-400">{plan.coins} Coins @ ₹{plan.amount}</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1 rounded-full text-zinc-400 hover:text-white hover:bg-zinc-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Loading Config State */}
        {isLoadingConfig ? (
          <div className="py-12 text-center flex flex-col items-center justify-center space-y-3">
            <Loader2 className="w-8 h-8 animate-spin text-emerald-400" />
            <p className="text-xs text-zinc-400">Loading payment configuration...</p>
          </div>
        ) : errorMessage === 'Payment config not found' || !upiId ? (
          /* Error: Payment Config Not Found */
          <div className="py-8 text-center space-y-4">
            <div className="w-14 h-14 rounded-full bg-rose-500/20 border border-rose-500/30 text-rose-400 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-7 h-7" />
            </div>
            <div className="space-y-1.5 px-3">
              <h4 className="text-base font-bold text-white">Payment Unavailable</h4>
              <p className="text-xs text-rose-400 font-semibold px-3 py-2 bg-rose-500/10 border border-rose-500/25 rounded-xl">
                Payment config not found
              </p>
              <p className="text-[11px] text-zinc-500 pt-1">
                Please contact the platform administrator to configure the active UPI ID in settings.
              </p>
            </div>
            <button
              onClick={onClose}
              className="w-full py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white font-bold text-xs transition cursor-pointer"
            >
              Close
            </button>
          </div>
        ) : successMessage ? (
          /* Success Screen */
          <div className="py-6 text-center space-y-4">
            <div className="w-14 h-14 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 flex items-center justify-center mx-auto">
              <ShieldCheck className="w-8 h-8" />
            </div>
            <div className="space-y-1">
              <h4 className="text-base font-black text-white">Payment Request Submitted!</h4>
              <p className="text-xs text-amber-300 font-semibold px-2 py-1.5 bg-amber-500/10 border border-amber-500/20 rounded-xl mt-2">
                {successMessage}
              </p>
            </div>
            <div className="text-[11px] text-zinc-400">
              UTR: <span className="font-mono text-white font-bold">{utr}</span>
            </div>
            <button
              onClick={onClose}
              className="w-full py-3 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs transition cursor-pointer"
            >
              Done
            </button>
          </div>
        ) : (
          /* Active Payment Form */
          <div className="space-y-4 pt-3">
            {/* Pay to UPI ID Section (Shows fetched UPI ID with Copy button) */}
            <div>
              <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider block mb-1">
                Pay to this UPI ID:
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

            {/* Instruction in Tamil */}
            <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-center">
              <p className="text-xs text-amber-300 font-medium leading-relaxed">
                "GPay la pay pannitu, 12-digit UTR number ah keela enter pannunga"
              </p>
            </div>

            {/* UTR Input Field */}
            <div>
              <label className="text-[11px] font-bold text-zinc-300 block mb-1">
                Enter UTR / Transaction ID (12 digits)
              </label>
              <input
                type="text"
                maxLength={12}
                value={utr}
                onChange={(e) => {
                  const val = e.target.value.replace(/\D/g, ''); // Numbers only
                  setUtr(val);
                  if (errorMessage) setErrorMessage(null);
                }}
                placeholder="Enter 12-digit UTR number"
                className="w-full bg-[#0F0F17] border border-zinc-700 focus:border-emerald-500 rounded-xl px-3 py-2.5 text-sm font-mono text-white placeholder-zinc-500 focus:outline-none tracking-widest text-center"
              />
              <div className="flex justify-between items-center text-[10px] text-zinc-500 mt-1 px-1">
                <span>Must be 12 digits</span>
                <span>{utr.length}/12</span>
              </div>
            </div>

            {/* Error Message */}
            {errorMessage && (
              <div className="p-2 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-1.5 animate-in fade-in">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Submit Button */}
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
                  <span>Submitting Verification...</span>
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
