import React, { useState } from 'react';
import { Crown, Lock, Shield, ArrowRight, AlertTriangle, Eye, EyeOff, CheckCircle2, ArrowLeft } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import appLogo from '../assets/images/app_logo_1790170748297.jpg';

interface OwnerLoginPageProps {
  onOwnerSuccess: () => void;
  onNavigateHome: () => void;
}

export const OwnerLoginPage: React.FC<OwnerLoginPageProps> = ({ onOwnerSuccess, onNavigateHome }) => {
  const { demoLoginAsAdmin, currentUser } = useAuth();

  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    // Strict Master Owner Password Check: Raja@123
    if (password !== 'Raja@123') {
      setErrorMsg('Access Denied: Invalid Owner Master Password. Unauthorized access attempt recorded.');
      return;
    }

    setLoading(true);
    try {
      // Elevate session to Owner / Admin in Firebase
      await demoLoginAsAdmin();
      localStorage.setItem('meetup_owner_authenticated', 'true');
      sessionStorage.setItem('meetup_owner_token', 'active');
      onOwnerSuccess();
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'Authentication error.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#060608] flex items-center justify-center p-4 text-white selection:bg-amber-500/30 selection:text-amber-300">
      {/* Container */}
      <div className="w-full max-w-md bg-[#0C0C12] border-2 border-amber-500/40 rounded-3xl p-6 sm:p-8 shadow-[0_0_40px_rgba(245,158,11,0.2)] relative overflow-hidden">
        {/* Glow ambient lights */}
        <div className="absolute -top-24 -right-20 w-48 h-48 rounded-full bg-amber-500/15 blur-3xl pointer-events-none"></div>
        <div className="absolute -bottom-24 -left-20 w-48 h-48 rounded-full bg-yellow-600/10 blur-3xl pointer-events-none"></div>

        {/* Top Back Link */}
        <div className="flex items-center justify-between mb-6">
          <button
            type="button"
            onClick={onNavigateHome}
            className="text-xs text-zinc-500 hover:text-zinc-300 flex items-center gap-1 transition"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to App</span>
          </button>

          <span className="px-2.5 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-[10px] font-black uppercase tracking-wider">
            Confidential Route
          </span>
        </div>

        {/* Brand Header */}
        <div className="flex flex-col items-center text-center mb-6">
          <div className="relative mb-3">
            <div className="w-16 h-16 rounded-2xl bg-amber-500/20 border-2 border-amber-500 flex items-center justify-center text-amber-400 shadow-[0_0_20px_rgba(245,158,11,0.4)] animate-pulse">
              <Crown className="w-8 h-8" />
            </div>
            <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-emerald-500 border-2 border-[#0C0C12] flex items-center justify-center">
              <span className="w-2 h-2 rounded-full bg-white"></span>
            </div>
          </div>

          <h1 className="text-2xl font-black text-white tracking-tight">Meet Up Owner Portal</h1>
          <p className="text-xs font-semibold text-amber-400 mt-1">Superintendent & Master Authority</p>
          <p className="text-xs text-zinc-400 mt-1 max-w-xs">
            Permissionless room oversight, live meeting controls, user moderation, and Supabase integration.
          </p>
        </div>

        {/* Error Notice */}
        {errorMsg && (
          <div className="p-3 mb-4 rounded-xl bg-red-500/15 border border-red-500/40 text-red-200 text-xs flex items-center gap-2.5 animate-in fade-in">
            <AlertTriangle className="w-4 h-4 shrink-0 text-red-400" />
            <span className="leading-relaxed">{errorMsg}</span>
          </div>
        )}

        {/* Password Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-[11px] font-semibold text-zinc-300 block mb-1">
              Owner Master Key
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-zinc-500 absolute left-3.5 top-3" />
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setErrorMsg(null);
                }}
                placeholder="Enter owner password"
                autoFocus
                className="w-full bg-[#14141E] border border-zinc-700 focus:border-amber-500 rounded-xl pl-10 pr-10 py-2.5 text-xs text-white placeholder:text-zinc-600 focus:outline-none transition font-mono"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-2.5 text-zinc-500 hover:text-zinc-300 transition"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-black font-black text-xs flex items-center justify-center gap-2 shadow-[0_0_18px_rgba(245,158,11,0.4)] disabled:opacity-50 transition active:scale-[0.98]"
          >
            {loading ? (
              <span className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin"></span>
            ) : (
              <>
                <Crown className="w-4 h-4" />
                <span>Verify & Enter Owner Control Center</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        {/* Security Disclaimers */}
        <div className="mt-6 pt-4 border-t border-zinc-800/80 text-center text-[10px] text-zinc-500 space-y-1">
          <div className="flex items-center justify-center gap-1.5 text-amber-500/80 font-semibold">
            <Shield className="w-3.5 h-3.5" />
            <span>End-to-End Super Control</span>
          </div>
          <p>Confidential endpoint. Only designated platform owners possess master credentials.</p>
        </div>
      </div>
    </div>
  );
};
