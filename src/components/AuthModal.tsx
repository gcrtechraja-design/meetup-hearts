import React, { useState } from 'react';
import { 
  Shield, 
  User, 
  Mail, 
  Lock, 
  X,
  Eye,
  EyeOff,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  KeyRound
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  updateProfile 
} from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../firebase/config';
import { getDefaultFemaleAvatar } from '../services/staticCdnService';
import appLogo from '../assets/images/app_logo_1790170748297.jpg';
import { LegalModals } from './LegalModals';

interface AuthModalProps {
  isOpen: boolean;
  onClose?: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose }) => {
  const { 
    signInWithSupabaseAuth, 
    signUpWithSupabaseAuth, 
    resetPasswordForEmail,
    resendConfirmationForEmail,
    loginWithGoogle,
    loginAsSuperAdmin 
  } = useAuth();

  // Tab: 'signup' vs 'login'
  const [activeTab, setActiveTab] = useState<'signup' | 'login'>('login');

  // Fields
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Password toggles
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Forgot password
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');

  // UI state
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [infoMsg, setInfoMsg] = useState<string | null>(null);
  const [showResendConfirmation, setShowResendConfirmation] = useState(false);
  const [resendingEmail, setResendingEmail] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);

  // Super admin secret modal
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [adminPassword, setAdminPassword] = useState('');
  const [selectedAdminEmail, setSelectedAdminEmail] = useState<'gcrtech.raja@gmail.com' | 'mrraavana07@gmail.com'>('gcrtech.raja@gmail.com');
  const [adminError, setAdminError] = useState<string | null>(null);
  const [adminVerifying, setAdminVerifying] = useState(false);

  if (!isOpen) return null;

  const isValidEmail = (val: string): boolean => {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(val.trim());
  };

  const handleTabChange = (tab: 'signup' | 'login') => {
    setActiveTab(tab);
    setErrorMsg(null);
    setInfoMsg(null);
    setShowResendConfirmation(false);
    setIsForgotPassword(false);
  };

  const handleResendConfirmation = async () => {
    const targetEmail = (email || forgotEmail).trim();
    if (!targetEmail || !isValidEmail(targetEmail)) {
      setErrorMsg('Please enter a valid email address to resend confirmation.');
      return;
    }
    setResendingEmail(true);
    setErrorMsg(null);
    try {
      console.log('[AuthModal] Requesting resend confirmation email for:', targetEmail);
      await resendConfirmationForEmail(targetEmail);
      setInfoMsg(`A verification link has been resent to ${targetEmail}. Please check your inbox.`);
      setShowResendConfirmation(false);
    } catch (err: any) {
      console.error('[AuthModal] Resend confirmation error:', err);
      setErrorMsg(err.message || 'Failed to resend confirmation email. Please try again.');
    } finally {
      setResendingEmail(false);
    }
  };

  const handleSignUpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setInfoMsg(null);
    setShowResendConfirmation(false);

    if (!name.trim()) {
      setErrorMsg('Please enter your full name.');
      return;
    }
    if (!isValidEmail(email)) {
      setErrorMsg('Please enter a valid email address.');
      return;
    }
    if (password.length < 6) {
      setErrorMsg('Password must be at least 6 characters long.');
      return;
    }
    if (password !== confirmPassword) {
      setErrorMsg('Passwords do not match.');
      return;
    }

    setSubmitting(true);
    console.log('[AuthModal] Creating user in Firebase Authentication for:', email.trim());
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email.trim(), password);
      const createdUser = userCredential.user;
      console.log('[AuthModal] Firebase user created successfully:', createdUser.uid);

      if (name.trim()) {
        try {
          await updateProfile(createdUser, { displayName: name.trim() });
        } catch (pErr) {
          console.warn('[AuthModal] updateProfile notice:', pErr);
        }
      }

      try {
        const userDocRef = doc(db, 'users', createdUser.uid);
        await setDoc(userDocRef, {
          uid: createdUser.uid,
          name: name.trim(),
          email: email.trim().toLowerCase(),
          role: 'user',
          age: 24,
          gender: 'other',
          location: 'Chennai, Tamil Nadu',
          bio: 'Hey there! Exploring Meet Up.',
          profile_pic: getDefaultFemaleAvatar(createdUser.uid),
          interests: ['Music', 'Dating', 'Conversations'],
          language: 'en',
          coins_balance: 50,
          diamonds_balance: 0,
          voice_rate: 10,
          video_rate: 50,
          status: 'online',
          is_blocked: false,
          isBlocked: false,
          created_at: serverTimestamp(),
          createdAt: serverTimestamp(),
        }, { merge: true });
      } catch (fsErr) {
        console.warn('[AuthModal] Firestore setDoc notice:', fsErr);
      }

      setInfoMsg('Account created successfully in Firebase! You can now sign in.');
      setActiveTab('login');
      setPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      console.error('[AuthModal] Signup error:', err);
      let realError = err.message || 'Failed to create account.';
      if (err.code === 'auth/operation-not-allowed') {
        realError = 'Firebase Error (auth/operation-not-allowed): Email/Password sign-in provider is disabled in Firebase Console. Please go to Firebase Console > Authentication > Sign-in method and enable "Email/Password".';
      } else if (err.code === 'auth/email-already-in-use') {
        realError = 'Firebase Error (auth/email-already-in-use): An account with this email already exists in Firebase Authentication. Please sign in instead.';
      } else if (err.code === 'auth/weak-password') {
        realError = 'Firebase Error (auth/weak-password): Password must be at least 6 characters.';
      } else if (err.code === 'auth/invalid-email') {
        realError = 'Firebase Error (auth/invalid-email): The email address is badly formatted.';
      }
      setErrorMsg(realError);
      try {
        if (typeof window !== 'undefined' && typeof window.alert === 'function') {
          window.alert(realError);
        }
      } catch {}
    } finally {
      setSubmitting(false);
    }
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setInfoMsg(null);
    setShowResendConfirmation(false);

    if (!isValidEmail(email)) {
      const err = 'Please enter a valid email address.';
      setErrorMsg(err);
      try { if (typeof window !== 'undefined' && typeof window.alert === 'function') window.alert(err); } catch {}
      return;
    }
    if (!password) {
      const err = 'Please enter your password.';
      setErrorMsg(err);
      try { if (typeof window !== 'undefined' && typeof window.alert === 'function') window.alert(err); } catch {}
      return;
    }

    setSubmitting(true);
    console.log('[AuthModal] Submitting login for:', email.trim());
    try {
      try {
        await signInWithEmailAndPassword(auth, email.trim(), password);
        console.log('[AuthModal] Firebase login successful!');
        setInfoMsg('Login successful!');
        if (onClose) onClose();
        return;
      } catch (fbErr: any) {
        console.warn('[AuthModal] Firebase login notice:', fbErr.code, fbErr.message);
        if (
          fbErr.code !== 'auth/operation-not-allowed' &&
          fbErr.code !== 'auth/invalid-credential' &&
          fbErr.code !== 'auth/user-not-found' &&
          fbErr.code !== 'auth/wrong-password'
        ) {
          throw fbErr;
        }
      }

      await signInWithSupabaseAuth(email.trim(), password);
      console.log('[AuthModal] Fallback login successful!');
      setInfoMsg('Login successful!');
      if (onClose) onClose();
    } catch (err: any) {
      console.error('[AuthModal] Login error:', err);
      let realError = err.message || 'Login failed.';
      const msg = (err.message || '').toLowerCase();
      if (
        err.code === 'auth/wrong-password' ||
        err.code === 'auth/invalid-credential' ||
        msg.includes('invalid email or password') ||
        msg.includes('invalid credentials')
      ) {
        realError = 'Invalid email or password. Please verify your credentials and try again.';
      } else if (err.code === 'auth/user-not-found' || msg.includes('no account found')) {
        realError = 'No user found with this email in Firebase Authentication.';
      }
      setErrorMsg(realError);
      try {
        if (typeof window !== 'undefined' && typeof window.alert === 'function') {
          window.alert(realError);
        }
      } catch {}
    } finally {
      setSubmitting(false);
    }
  };

  const handleForgotPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setInfoMsg(null);
    setShowResendConfirmation(false);

    if (!isValidEmail(forgotEmail)) {
      setErrorMsg('Please enter a valid email address.');
      return;
    }

    setSubmitting(true);
    try {
      await resetPasswordForEmail(forgotEmail.trim());
      setInfoMsg('Password reset email sent! Check your inbox.');
    } catch (err: any) {
      console.error('[AuthModal] Forgot password error:', err);
      setErrorMsg(err.message || 'Failed to send password reset email.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setErrorMsg(null);
    setInfoMsg(null);
    setSubmitting(true);
    try {
      await loginWithGoogle();
      if (onClose) onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Google sign-in was cancelled or failed.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSuperAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdminError(null);
    setAdminVerifying(true);
    try {
      await loginAsSuperAdmin(adminPassword, selectedAdminEmail);
      setShowAdminModal(false);
      if (onClose) onClose();
    } catch (err: any) {
      setAdminError(err.message || 'Incorrect password');
    } finally {
      setAdminVerifying(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in select-none">
      <div className="relative w-full max-w-sm rounded-3xl bg-[#0f0f1a] border border-[#2d2d3f] p-6 shadow-2xl flex flex-col items-center text-center">
        
        {/* Close Button */}
        {onClose && (
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 text-zinc-400 hover:text-white rounded-full bg-zinc-800/50 hover:bg-zinc-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        )}

        {/* Logo */}
        <div 
          className="w-16 h-16 rounded-full p-[2px] bg-gradient-to-tr from-[#FF6BA9] to-[#FF85BA] shadow-[0_0_20px_rgba(255,107,169,0.5)] mb-3 cursor-pointer"
          onDoubleClick={() => setShowAdminModal(true)}
          title="Double tap for admin"
        >
          <img src={appLogo} alt="Meet Up" className="w-full h-full rounded-full object-cover bg-black" />
        </div>

        <h2 className="text-2xl font-serif font-bold text-white mb-1">Meet Up</h2>
        <p className="text-xs text-zinc-400 mb-4">
          {isForgotPassword 
            ? 'Reset your password' 
            : activeTab === 'signup' 
              ? 'Create your account' 
              : 'Sign in to connect'}
        </p>

        {/* Errors & Info */}
        {errorMsg && (
          <div className="w-full p-3 mb-3 rounded-2xl bg-red-500/15 border border-red-500/30 text-red-200 text-xs flex flex-col gap-2 text-left shadow-lg">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <span className="flex-1 font-medium">{errorMsg}</span>
            </div>
            {showResendConfirmation && (
              <div className="pt-1 flex items-center justify-between border-t border-red-500/20">
                <span className="text-[10px] text-zinc-400">Didn't get the email?</span>
                <button
                  type="button"
                  onClick={handleResendConfirmation}
                  disabled={resendingEmail}
                  className="px-2.5 py-1 rounded-lg bg-[#FF6BA9] hover:bg-[#FF7FB7] text-white text-[10px] font-bold transition cursor-pointer disabled:opacity-50"
                >
                  {resendingEmail ? 'Sending...' : 'Resend Verification'}
                </button>
              </div>
            )}
          </div>
        )}
        {infoMsg && (
          <div className="w-full p-2.5 mb-3 rounded-xl bg-[#FF6BA9]/15 border border-[#FF6BA9]/30 text-pink-200 text-xs flex items-center gap-2 text-left">
            <CheckCircle2 className="w-4 h-4 text-[#FF6BA9] shrink-0" />
            <span className="flex-1">{infoMsg}</span>
          </div>
        )}

        {/* Tabs: Create Account & Login */}
        {!isForgotPassword && (
          <div className="w-full grid grid-cols-2 gap-1.5 p-1 mb-4 rounded-xl bg-[#161622] border border-zinc-800">
            <button
              type="button"
              onClick={() => handleTabChange('signup')}
              className={`py-2 px-2 rounded-lg text-xs font-semibold font-serif transition cursor-pointer ${
                activeTab === 'signup'
                  ? 'bg-[#FF6BA9] text-white shadow-[0_2px_12px_rgba(255,107,169,0.4)]'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              Create Account
            </button>
            <button
              type="button"
              onClick={() => handleTabChange('login')}
              className={`py-2 px-2 rounded-lg text-xs font-semibold font-serif transition cursor-pointer ${
                activeTab === 'login'
                  ? 'bg-[#FF6BA9] text-white shadow-[0_2px_12px_rgba(255,107,169,0.4)]'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              Login
            </button>
          </div>
        )}

        {/* Form: Create Account */}
        {!isForgotPassword && activeTab === 'signup' && (
          <form onSubmit={handleSignUpSubmit} className="w-full space-y-3 text-left">
            <div>
              <label className="text-xs text-zinc-300 font-medium block mb-1">Full Name</label>
              <div className="flex items-center rounded-xl bg-[#161622] border border-zinc-800 focus-within:border-[#FF6BA9] px-3 py-2 gap-2">
                <User className="w-4 h-4 text-[#FF6BA9] shrink-0" />
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Full name"
                  className="w-full bg-transparent text-xs text-white placeholder:text-zinc-500 focus:outline-none"
                  required
                />
              </div>
            </div>

            <div>
              <label className="text-xs text-zinc-300 font-medium block mb-1">Email</label>
              <div className="flex items-center rounded-xl bg-[#161622] border border-zinc-800 focus-within:border-[#FF6BA9] px-3 py-2 gap-2">
                <Mail className="w-4 h-4 text-[#FF6BA9] shrink-0" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="w-full bg-transparent text-xs text-white placeholder:text-zinc-500 focus:outline-none"
                  required
                />
              </div>
            </div>

            <div>
              <label className="text-xs text-zinc-300 font-medium block mb-1">Password (min 6 chars)</label>
              <div className="flex items-center rounded-xl bg-[#161622] border border-zinc-800 focus-within:border-[#FF6BA9] px-3 py-2 gap-2">
                <Lock className="w-4 h-4 text-[#FF6BA9] shrink-0" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Password"
                  className="w-full bg-transparent text-xs text-white placeholder:text-zinc-500 focus:outline-none"
                  required
                  minLength={6}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="text-zinc-500 hover:text-zinc-300 cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="text-xs text-zinc-300 font-medium block mb-1">Confirm Password</label>
              <div className="flex items-center rounded-xl bg-[#161622] border border-zinc-800 focus-within:border-[#FF6BA9] px-3 py-2 gap-2">
                <Lock className="w-4 h-4 text-[#FF6BA9] shrink-0" />
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm password"
                  className="w-full bg-transparent text-xs text-white placeholder:text-zinc-500 focus:outline-none"
                  required
                  minLength={6}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="text-zinc-500 hover:text-zinc-300 cursor-pointer"
                >
                  {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3 px-4 rounded-xl bg-[#FF6BA9] hover:bg-[#FF7FB7] text-white font-serif text-sm font-bold shadow-[0_4px_18px_rgba(255,107,169,0.4)] transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60 mt-1"
            >
              <span>{submitting ? 'Creating...' : 'Create Account'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        )}

        {/* Form: Login */}
        {!isForgotPassword && activeTab === 'login' && (
          <form onSubmit={handleLoginSubmit} className="w-full space-y-3 text-left">
            <div>
              <label className="text-xs text-zinc-300 font-medium block mb-1">Email</label>
              <div className="flex items-center rounded-xl bg-[#161622] border border-zinc-800 focus-within:border-[#FF6BA9] px-3 py-2 gap-2">
                <Mail className="w-4 h-4 text-[#FF6BA9] shrink-0" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="w-full bg-transparent text-xs text-white placeholder:text-zinc-500 focus:outline-none"
                  required
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs text-zinc-300 font-medium">Password</label>
                <button
                  type="button"
                  onClick={() => {
                    setForgotEmail(email);
                    setIsForgotPassword(true);
                    setErrorMsg(null);
                  }}
                  className="text-[11px] text-[#FF6BA9] hover:underline cursor-pointer"
                >
                  Forgot Password?
                </button>
              </div>
              <div className="flex items-center rounded-xl bg-[#161622] border border-zinc-800 focus-within:border-[#FF6BA9] px-3 py-2 gap-2">
                <Lock className="w-4 h-4 text-[#FF6BA9] shrink-0" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter password"
                  className="w-full bg-transparent text-xs text-white placeholder:text-zinc-500 focus:outline-none"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="text-zinc-500 hover:text-zinc-300 cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3 px-4 rounded-xl bg-[#FF6BA9] hover:bg-[#FF7FB7] text-white font-serif text-sm font-bold shadow-[0_4px_18px_rgba(255,107,169,0.4)] transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60 mt-1"
            >
              <span>{submitting ? 'Signing in...' : 'Sign In'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        )}

        {/* Form: Forgot Password */}
        {isForgotPassword && (
          <form onSubmit={handleForgotPasswordSubmit} className="w-full space-y-3 text-left">
            <div>
              <label className="text-xs text-zinc-300 font-medium block mb-1">Registered Email</label>
              <div className="flex items-center rounded-xl bg-[#161622] border border-zinc-800 focus-within:border-[#FF6BA9] px-3 py-2 gap-2">
                <Mail className="w-4 h-4 text-[#FF6BA9] shrink-0" />
                <input
                  type="email"
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="w-full bg-transparent text-xs text-white placeholder:text-zinc-500 focus:outline-none"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3 px-4 rounded-xl bg-[#FF6BA9] hover:bg-[#FF7FB7] text-white font-serif text-sm font-bold shadow-[0_4px_18px_rgba(255,107,169,0.4)] transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
            >
              <span>{submitting ? 'Sending...' : 'Send Reset Link'}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setIsForgotPassword(false);
                setErrorMsg(null);
                setInfoMsg(null);
              }}
              className="w-full py-1 text-xs text-zinc-400 hover:text-white transition flex items-center justify-center gap-1 cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Login</span>
            </button>
          </form>
        )}

        {/* Google Sign In option */}
        {!isForgotPassword && (
          <div className="w-full mt-3 pt-3 border-t border-zinc-800">
            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={submitting}
              className="w-full py-2.5 px-3 rounded-xl bg-[#161622] border border-zinc-800 hover:border-zinc-700 transition flex items-center justify-center gap-2 text-xs font-medium text-white cursor-pointer"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z"/>
                <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.24v3.15C3.26 21.4 7.33 24 12 24z"/>
                <path fill="#FBBC05" d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.14-1.55.38-2.27V6.58H1.24C.45 8.14 0 9.97 0 12s.45 3.86 1.24 5.42l4.04-3.15z"/>
                <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.6 1.24 6.58l4.04 3.15c.95-2.83 3.6-4.98 6.72-4.98z"/>
              </svg>
              <span>Continue with Google</span>
            </button>
          </div>
        )}
      </div>

      {/* Hidden Super Admin Access Modal */}
      {showAdminModal && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/90 p-4">
          <div className="w-full max-w-xs rounded-2xl bg-[#121217] border border-pink-500/30 p-5 text-left">
            <h3 className="text-sm font-bold text-white mb-2">Admin Security</h3>
            {adminError && <p className="text-xs text-red-400 mb-2">{adminError}</p>}
            <form onSubmit={handleSuperAdminLogin} className="space-y-3">
              <div>
                <label className="text-[11px] text-zinc-400 block mb-1">Account</label>
                <div className="grid grid-cols-2 gap-1.5 mb-2">
                  <button
                    type="button"
                    onClick={() => setSelectedAdminEmail('gcrtech.raja@gmail.com')}
                    className={`px-2 py-1.5 rounded-lg text-left border text-[10px] transition cursor-pointer ${
                      selectedAdminEmail === 'gcrtech.raja@gmail.com'
                        ? 'bg-[#FF6BA9]/20 border-[#FF6BA9] text-white font-bold'
                        : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:border-zinc-700'
                    }`}
                  >
                    <div className="truncate font-semibold">gcrtech.raja</div>
                    <div className="text-[8px] text-zinc-500">Raja Admin</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedAdminEmail('mrraavana07@gmail.com')}
                    className={`px-2 py-1.5 rounded-lg text-left border text-[10px] transition cursor-pointer ${
                      selectedAdminEmail === 'mrraavana07@gmail.com'
                        ? 'bg-[#FF6BA9]/20 border-[#FF6BA9] text-white font-bold'
                        : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:border-zinc-700'
                    }`}
                  >
                    <div className="truncate font-semibold">mrraavana07</div>
                    <div className="text-[8px] text-zinc-500">Raavana Admin</div>
                  </button>
                </div>
              </div>
              <input
                type="password"
                value={adminPassword}
                onChange={(e) => setAdminPassword(e.target.value)}
                placeholder="Enter password"
                className="w-full bg-black border border-zinc-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none"
                autoFocus
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowAdminModal(false)}
                  className="flex-1 py-2 rounded-lg bg-zinc-800 text-xs text-zinc-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={adminVerifying}
                  className="flex-1 py-2 rounded-lg bg-[#FF6BA9] text-xs text-white font-semibold"
                >
                  {adminVerifying ? '...' : 'Verify'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showPrivacyModal && (
        <LegalModals
          type="privacy"
          onClose={() => setShowPrivacyModal(false)}
        />
      )}
    </div>
  );
};
