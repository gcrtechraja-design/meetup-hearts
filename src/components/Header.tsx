import React from 'react';
import { Coins, Sparkles, Shield, UserCheck, Crown } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTranslation, SupportedLanguage } from '../utils/i18n';
import { isUserAdmin, isMeetupOwner } from '../utils/admin';
import appLogo from '../assets/images/app_logo_1790170748297.jpg';

interface HeaderProps {
  onOpenWallet: () => void;
  onOpenAdmin?: () => void;
  onOpenOwner?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onOpenWallet, onOpenAdmin, onOpenOwner }) => {
  const { currentUser } = useAuth();
  const lang = (currentUser?.language?.toUpperCase() || 'EN') as SupportedLanguage;
  const { t } = useTranslation(lang);

  const isOwner = isMeetupOwner(currentUser?.email);
  const isAdmin = isUserAdmin(currentUser);

  return (
    <header className="sticky top-0 z-30 w-full bg-[#0f0f1a]/95 backdrop-blur-md border-b border-[#232334] px-4 py-3">
      <div className="max-w-md mx-auto flex items-center justify-between">
        {/* Logo and App Title */}
        <div className="flex items-center gap-2.5">
          <div className="relative w-9 h-9 rounded-full p-[1.5px] bg-gradient-to-tr from-[#ff4d8d] via-purple-500 to-pink-400 shadow-[0_0_14px_rgba(255,77,141,0.5)] shrink-0">
            <img
              src={appLogo}
              alt="Meet Up Logo"
              className="w-full h-full rounded-full object-cover bg-black"
            />
          </div>

          <div className="flex items-center">
            <span className="text-2xl font-extrabold tracking-tight text-white flex items-center">
              Meet Up
              <span className="inline-block w-2.5 h-2.5 ml-1.5 rounded-full bg-[#ff4d8d] shadow-[0_0_10px_#ff4d8d] animate-pulse"></span>
            </span>
          </div>

          {isOwner && (
            <button
              onClick={onOpenOwner}
              className="ml-2 px-2 py-0.5 rounded-full bg-amber-500/20 border border-amber-500 text-amber-300 text-[11px] font-bold flex items-center gap-1 hover:bg-amber-500/30 transition shadow-[0_0_8px_rgba(245,158,11,0.4)]"
              title="Super Owner Panel"
            >
              <Crown className="w-3 h-3 text-amber-400" />
              Owner
            </button>
          )}

          {!isOwner && isAdmin && (
            <button
              onClick={onOpenAdmin}
              className="ml-2 px-2.5 py-0.5 rounded-full bg-[#ff4d8d]/20 border border-[#ff4d8d] text-[#ff4d8d] text-[11px] font-bold flex items-center gap-1 hover:bg-[#ff4d8d]/30 transition shadow-[0_0_10px_rgba(255,77,141,0.3)]"
              title="Admin Panel"
            >
              <Shield className="w-3 h-3" />
              Admin
            </button>
          )}

          {currentUser?.role === 'listener' && (
            <span className="ml-1.5 px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/50 text-emerald-400 text-[10px] font-semibold flex items-center gap-1">
              <UserCheck className="w-3 h-3" />
              Listener
            </span>
          )}
        </div>

        {/* Live Coin & Diamonds Balance */}
        <div className="flex items-center gap-2">
          {currentUser ? (
            <button
              onClick={onOpenWallet}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#161622] border border-[#232334] hover:border-[#ff4d8d] transition shadow-sm group active:scale-95 cursor-pointer"
            >
              <div className="w-5 h-5 rounded-full bg-amber-500/20 flex items-center justify-center text-amber-400">
                <Coins className="w-3.5 h-3.5" />
              </div>
              <span className="text-sm font-bold text-amber-300">
                {currentUser.coins_balance?.toLocaleString() ?? 0}
              </span>
              <span className="text-xs text-zinc-400 group-hover:text-white transition">+</span>
            </button>
          ) : (
            <button
              onClick={onOpenWallet}
              className="px-3.5 py-1.5 text-xs font-bold rounded-full bg-gradient-to-r from-[#ff4d8d] to-pink-500 text-white hover:opacity-95 transition shadow-[0_0_12px_rgba(255,77,141,0.4)] active:scale-95"
            >
              Sign In
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
