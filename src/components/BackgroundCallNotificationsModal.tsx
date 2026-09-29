import React, { useState, useEffect } from 'react';
import { 
  X, 
  Bell, 
  Check, 
  AlertCircle, 
  Smartphone, 
  Volume2, 
  ShieldCheck, 
  Sparkles,
  PhoneIncoming,
  CheckCircle2,
  AlertTriangle,
  Play,
  Square
} from 'lucide-react';
import { UserProfile } from '../types';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { updateSupabaseProfilePreference } from '../services/supabase';
import { requestNotificationPermissionAndSaveToken } from '../services/fcmService';
import { ringtoneService } from '../services/ringtoneService';
import appLogo from '../assets/images/app_logo_1790170748297.jpg';

interface BackgroundCallNotificationsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: UserProfile | null;
  onPreferenceChange?: (enabled: boolean) => void;
  showToast: (msg: string, type?: 'success' | 'info' | 'error') => void;
}

export const BackgroundCallNotificationsModal: React.FC<BackgroundCallNotificationsModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onPreferenceChange,
  showToast,
}) => {
  // Check localStorage and user profile for initial state
  const getInitialEnabled = (): boolean => {
    const localVal = typeof window !== 'undefined' ? localStorage.getItem('background_call_notify') : null;
    if (localVal !== null) {
      return localVal === 'true';
    }
    if (currentUser?.background_call_notify !== undefined) {
      return currentUser.background_call_notify;
    }
    return true; // default enabled
  };

  const [isEnabled, setIsEnabled] = useState<boolean>(getInitialEnabled);
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>('default');
  const [isUpdating, setIsUpdating] = useState<boolean>(false);
  const [isTesting, setIsTesting] = useState<boolean>(false);

  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setNotificationPermission(Notification.permission);
    }
    setIsEnabled(getInitialEnabled());
  }, [isOpen, currentUser]);

  if (!isOpen) return null;

  // Handle Toggle Switch
  const handleToggle = async () => {
    if (isUpdating) return;
    setIsUpdating(true);

    const nextState = !isEnabled;

    try {
      if (nextState) {
        // Turning ON: Check and request notification permission
        if (typeof window !== 'undefined' && 'Notification' in window) {
          if (Notification.permission !== 'granted') {
            const requested = await Notification.requestPermission();
            setNotificationPermission(requested);
            if (requested !== 'granted') {
              showToast('Notification permission blocked in browser. Please enable in site settings.', 'error');
              setIsUpdating(false);
              return;
            }
          }
        }

        // Register / refresh FCM push token
        if (currentUser?.uid) {
          try {
            await requestNotificationPermissionAndSaveToken(currentUser.uid);
          } catch (e) {
            console.warn('[FCM] Token register notice:', e);
          }
        }

        // Persist to localStorage
        localStorage.setItem('background_call_notify', 'true');
        localStorage.setItem('meetup_background_call_notify', 'true');

        // Persist to Firestore
        if (currentUser?.uid) {
          try {
            await updateDoc(doc(db, 'users', currentUser.uid), {
              background_call_notify: true,
              background_call_notifications: true,
            });
          } catch (err) {
            console.warn('Firestore preference update error:', err);
          }
        }

        // Persist to Supabase profiles & users table
        if (currentUser?.uid) {
          await updateSupabaseProfilePreference(currentUser.uid, {
            background_call_notify: true,
          });
        }

        setIsEnabled(true);
        if (onPreferenceChange) onPreferenceChange(true);
        showToast('Background call notifications enabled', 'success');
      } else {
        // Turning OFF
        localStorage.setItem('background_call_notify', 'false');
        localStorage.setItem('meetup_background_call_notify', 'false');

        // Persist to Firestore
        if (currentUser?.uid) {
          try {
            await updateDoc(doc(db, 'users', currentUser.uid), {
              background_call_notify: false,
              background_call_notifications: false,
            });
          } catch (err) {
            console.warn('Firestore preference update error:', err);
          }
        }

        // Persist to Supabase profiles & users table
        if (currentUser?.uid) {
          await updateSupabaseProfilePreference(currentUser.uid, {
            background_call_notify: false,
          });
        }

        setIsEnabled(false);
        if (onPreferenceChange) onPreferenceChange(false);
        showToast('Background call notifications disabled', 'info');
      }
    } catch (err) {
      console.error('Failed to update background call notification preference:', err);
      showToast('Failed to update preference. Please try again.', 'error');
    } finally {
      setIsUpdating(false);
    }
  };

  // Test Background Notification Sound & Alert
  const handleTestAlert = () => {
    if (isTesting) {
      ringtoneService.stopAll();
      setIsTesting(false);
      return;
    }

    setIsTesting(true);
    showToast('Playing incoming call ringtone & alert test...', 'info');

    try {
      ringtoneService.startIncomingRingtone();
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        navigator.vibrate([200, 100, 200, 100, 400]);
      }

      if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
        try {
          new Notification('📞 Incoming Call Test - Meet Up', {
            body: 'Incoming audio call from Priya (Listener)... Tap to test background alerts.',
            icon: appLogo,
            tag: 'test-incoming-call',
          });
        } catch (e) {
          console.log('Test notification error:', e);
        }
      }
    } catch (e) {
      console.warn('Ringtone test error:', e);
    }

    setTimeout(() => {
      ringtoneService.stopAll();
      setIsTesting(false);
    }, 4000);
  };

  // Request browser permission directly
  const handleRequestPermissionDirect = async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      showToast('Notifications are not supported in this browser.', 'error');
      return;
    }

    try {
      const result = await Notification.requestPermission();
      setNotificationPermission(result);
      if (result === 'granted') {
        showToast('Notification permission granted!', 'success');
        if (currentUser?.uid) {
          await requestNotificationPermissionAndSaveToken(currentUser.uid);
        }
      } else {
        showToast('Notification permission was not granted.', 'error');
      }
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center p-0 sm:p-4">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/80 backdrop-blur-sm transition-opacity"
        onClick={() => {
          if (isTesting) ringtoneService.stopAll();
          onClose();
        }}
      />

      {/* Bottom Sheet Modal Container */}
      <div className="relative w-full max-w-lg bg-[#141419] border border-[#23232C] rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col max-h-[90vh] z-10 overflow-hidden animate-in slide-in-from-bottom-6 duration-200">
        {/* Mobile Pull Indicator */}
        <div className="w-12 h-1.5 bg-zinc-700/60 rounded-full mx-auto mt-3 mb-1 shrink-0 sm:hidden" />

        {/* Header */}
        <div className="p-5 pb-4 border-b border-[#23232C] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-[#FF69B4]/15 border border-[#FF69B4]/30 text-[#FF69B4]">
              <PhoneIncoming className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-black text-white flex items-center gap-2">
                <span>Background Call Notifications</span>
              </h3>
              <p className="text-xs text-zinc-400">Incoming call alerts & lock-screen ringtone</p>
            </div>
          </div>

          <button
            onClick={() => {
              if (isTesting) ringtoneService.stopAll();
              onClose();
            }}
            className="p-2 rounded-full text-zinc-400 hover:text-white hover:bg-zinc-800 transition"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 space-y-4 overflow-y-auto">
          {/* Main Toggle Row (Requirement 2 & 4) */}
          <div className="p-4 bg-[#1A1A23] rounded-2xl border border-zinc-800 flex items-center justify-between gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-white">
                  Enable background incoming call alerts
                </span>
                {isEnabled ? (
                  <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-bold">
                    ON
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-400 text-[10px] font-bold">
                    OFF
                  </span>
                )}
              </div>
              <p className="text-[12px] text-zinc-400 mt-1 leading-relaxed">
                Receive WhatsApp-style ringing and full-screen incoming call banners even when the app is in the background or device is locked.
              </p>
            </div>

            {/* Toggle Switch */}
            <button
              type="button"
              role="switch"
              aria-checked={isEnabled}
              disabled={isUpdating}
              onClick={handleToggle}
              className={`relative inline-flex h-7 w-13 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                isEnabled ? 'bg-[#FF69B4]' : 'bg-zinc-700'
              } ${isUpdating ? 'opacity-60 cursor-not-allowed' : ''}`}
            >
              <span
                className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                  isEnabled ? 'translate-x-6' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Permission Status Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {/* Browser / PWA Permission */}
            <div className="p-3.5 bg-[#0B0B0E] rounded-2xl border border-zinc-800 flex items-start gap-3">
              <div className="p-2 rounded-xl bg-purple-500/10 text-purple-400 shrink-0">
                <Bell className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-1">
                  <span className="text-xs font-bold text-white">Browser Permission</span>
                  {notificationPermission === 'granted' ? (
                    <span className="text-[10px] text-emerald-400 font-bold flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> Granted
                    </span>
                  ) : notificationPermission === 'denied' ? (
                    <span className="text-[10px] text-rose-400 font-bold flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" /> Blocked
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={handleRequestPermissionDirect}
                      className="text-[10px] text-[#FF69B4] font-bold underline hover:text-pink-400"
                    >
                      Allow Now
                    </button>
                  )}
                </div>
                <p className="text-[11px] text-zinc-400 mt-0.5">
                  {notificationPermission === 'granted'
                    ? 'Push notifications are authorized'
                    : notificationPermission === 'denied'
                    ? 'Blocked in site permissions'
                    : 'Tap to request notification permission'}
                </p>
              </div>
            </div>

            {/* Sound & Ringtone Synthesis */}
            <div className="p-3.5 bg-[#0B0B0E] rounded-2xl border border-zinc-800 flex items-start gap-3">
              <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400 shrink-0">
                <Volume2 className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-1">
                  <span className="text-xs font-bold text-white">Ringtone & Vibration</span>
                  <span className="text-[10px] text-emerald-400 font-bold flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> Ready
                  </span>
                </div>
                <p className="text-[11px] text-zinc-400 mt-0.5">
                  Melodic incoming synthesizer + haptic vibration
                </p>
              </div>
            </div>

            {/* FCM Background Push */}
            <div className="p-3.5 bg-[#0B0B0E] rounded-2xl border border-zinc-800 flex items-start gap-3">
              <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 shrink-0">
                <Smartphone className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-1">
                  <span className="text-xs font-bold text-white">Full-Screen Overlay</span>
                  <span className="text-[10px] text-emerald-400 font-bold">Active</span>
                </div>
                <p className="text-[11px] text-zinc-400 mt-0.5">
                  Incoming call popup over other apps & lock screen
                </p>
              </div>
            </div>

            {/* Exact Alarm & Wake Lock */}
            <div className="p-3.5 bg-[#0B0B0E] rounded-2xl border border-zinc-800 flex items-start gap-3">
              <div className="p-2 rounded-xl bg-pink-500/10 text-[#FF69B4] shrink-0">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-1">
                  <span className="text-xs font-bold text-white">High Priority Alert</span>
                  <span className="text-[10px] text-emerald-400 font-bold">Enabled</span>
                </div>
                <p className="text-[11px] text-zinc-400 mt-0.5">
                  Bypasses network standby for immediate ringing
                </p>
              </div>
            </div>
          </div>

          {/* Test Sound & Alert Button */}
          <div className="pt-1">
            <button
              type="button"
              onClick={handleTestAlert}
              className={`w-full py-3 px-4 rounded-2xl text-xs font-bold flex items-center justify-center gap-2 transition active:scale-[0.98] border ${
                isTesting 
                  ? 'bg-rose-500/20 text-rose-300 border-rose-500/40 hover:bg-rose-500/30'
                  : 'bg-zinc-800/80 hover:bg-zinc-800 text-zinc-200 border-zinc-700/80 hover:text-white'
              }`}
            >
              {isTesting ? (
                <>
                  <Square className="w-4 h-4 fill-rose-300" />
                  <span>Stop Ringtone Test</span>
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 fill-zinc-200" />
                  <span>Test Incoming Call Sound & Notification</span>
                </>
              )}
            </button>
          </div>

          {/* Android & Device Tips */}
          <div className="p-3.5 bg-blue-500/10 border border-blue-500/20 rounded-2xl">
            <div className="flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
              <div className="text-[11px] text-blue-300 leading-relaxed">
                <strong className="text-white block mb-0.5">Android / PWA Best Experience:</strong>
                If notifications don't ring while your phone is asleep, open phone{' '}
                <span className="font-semibold text-white">Settings &gt; Apps &gt; Meet Up</span> and enable{' '}
                <span className="font-semibold text-white">"Display over other apps"</span> and set Battery to{' '}
                <span className="font-semibold text-white">"Unrestricted"</span>.
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[#23232C] bg-[#111116] flex items-center justify-end">
          <button
            type="button"
            onClick={() => {
              if (isTesting) ringtoneService.stopAll();
              onClose();
            }}
            className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#FF69B4] to-pink-600 hover:from-pink-500 hover:to-[#FF69B4] text-white text-xs font-bold transition shadow-lg shadow-[#FF69B4]/20 active:scale-95"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
