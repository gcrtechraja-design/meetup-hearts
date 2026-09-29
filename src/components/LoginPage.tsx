import React, { useState } from 'react';
import { 
  Shield, 
  User, 
  Mail, 
  Lock, 
  CheckCircle2, 
  ArrowRight, 
  Eye, 
  EyeOff, 
  ArrowLeft,
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
import meetupLogo from '../assets/images/meetup_app_logo_1790184081929.jpg';
import { LegalModals } from './LegalModals';

interface LoginPageProps {
  onLoginSuccess?: () => void;
}

// Floating Hearts decorative background data
const FLOATING_HEARTS = [
  { id: 1, left: '8%', size: 18, delay: '0s', duration: '14s', opacity: 0.45 },
  { id: 2, left: '18%', size: 26, delay: '3s', duration: '18s', opacity: 0.55 },
  { id: 3, left: '28%', size: 14, delay: '7s', duration: '12s', opacity: 0.35 },
  { id: 4, left: '42%', size: 22, delay: '1s', duration: '16s', opacity: 0.5 },
  { id: 5, left: '55%', size: 16, delay: '5s', duration: '15s', opacity: 0.4 },
  { id: 6, left: '68%', size: 28, delay: '2s', duration: '19s', opacity: 0.6 },
  { id: 7, left: '82%', size: 20, delay: '8s', duration: '13s', opacity: 0.45 },
  { id: 8, left: '92%', size: 15, delay: '4s', duration: '17s', opacity: 0.35 },
  { id: 9, left: '12%', size: 24, delay: '9s', duration: '20s', opacity: 0.5 },
  { id: 10, left: '35%', size: 18, delay: '11s', duration: '14s', opacity: 0.4 },
  { id: 11, left: '62%', size: 20, delay: '6s', duration: '16s', opacity: 0.5 },
  { id: 12, left: '76%', size: 15, delay: '12s', duration: '15s', opacity: 0.35 },
];

export const LoginPage: React.FC<LoginPageProps> = ({ onLoginSuccess }) => {
  const { 
    signInWithSupabaseAuth, 
    signUpWithSupabaseAuth, 
    resetPasswordForEmail,
    resendConfirmationForEmail,
    demoLoginAsUser,
    demoLoginAsAdmin,
    loginWithGoogle,
    loginAsSuperAdmin 
  } = useAuth();

  // Active Tab: 'signup' (Create Account) vs 'login' (Login)
  const [activeTab, setActiveTab] = useState<'signup' | 'login'>('login');

  // Form Fields
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Password Visibility Toggles
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Forgot Password Mode
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotSubmitted, setForgotSubmitted] = useState(false);

  // Status & Feedback States
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [infoMsg, setInfoMsg] = useState<string | null>(null);
  const [showResendConfirmation, setShowResendConfirmation] = useState(false);
  const [showCreateAccountPrompt, setShowCreateAccountPrompt] = useState(false);
  const [resendingEmail, setResendingEmail] = useState(false);
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);

  // Hidden Super Admin access modal
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [adminPassword, setAdminPassword] = useState('');
  const [selectedAdminEmail, setSelectedAdminEmail] = useState<'rajasuvimarriage09@gmail.com' | 'gcrtech.raja@gmail.com' | 'mrraavana07@gmail.com'>('rajasuvimarriage09@gmail.com');
  const [adminError, setAdminError] = useState<string | null>(null);
  const [adminVerifying, setAdminVerifying] = useState(false);

  // Email format validation helper
  const isValidEmail = (val: string): boolean => {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(val.trim());
  };

  // Reset errors when switching tabs
  const handleTabChange = (tab: 'signup' | 'login') => {
    setActiveTab(tab);
    setErrorMsg(null);
    setInfoMsg(null);
    setShowResendConfirmation(false);
    setShowCreateAccountPrompt(false);
    setIsForgotPassword(false);
  };

  const handleSwitchToCreateAccount = () => {
    setActiveTab('signup');
    setErrorMsg(null);
    setInfoMsg(null);
    setShowCreateAccountPrompt(false);
    if (!confirmPassword && password) {
      setConfirmPassword(password);
    }
  };

  // Resend Email Confirmation Link
  const handleResendConfirmation = async () => {
    const targetEmail = (email || forgotEmail).trim();
    if (!targetEmail || !isValidEmail(targetEmail)) {
      setErrorMsg('Please enter a valid email address to resend confirmation.');
      return;
    }
    setResendingEmail(true);
    setErrorMsg(null);
    try {
      console.log('[LoginPage] Requesting resend confirmation email for:', targetEmail);
      await resendConfirmationForEmail(targetEmail);
      setInfoMsg(`A verification link has been resent to ${targetEmail}. Please check your inbox and spam folder.`);
      setShowResendConfirmation(false);
    } catch (err: any) {
      console.error('[LoginPage] Resend confirmation error:', err);
      setErrorMsg(err.message || 'Failed to resend confirmation email. Please try again.');
    } finally {
      setResendingEmail(false);
    }
  };

  // 1. Submit Create Account Form (Firebase Auth)
  const handleSignUpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setInfoMsg(null);
    setShowResendConfirmation(false);

    // Validation 1: Name required
    if (!name.trim()) {
      const err = 'Please enter your full name.';
      setErrorMsg(err);
      try { if (typeof window !== 'undefined' && typeof window.alert === 'function') window.alert(err); } catch {}
      return;
    }

    // Validation 2: Email format
    if (!isValidEmail(email)) {
      const err = 'Please enter a valid email address (e.g. name@example.com).';
      setErrorMsg(err);
      try { if (typeof window !== 'undefined' && typeof window.alert === 'function') window.alert(err); } catch {}
      return;
    }

    // Validation 3: Password minimum 6 characters
    if (password.length < 6) {
      const err = 'Password must be at least 6 characters long.';
      setErrorMsg(err);
      try { if (typeof window !== 'undefined' && typeof window.alert === 'function') window.alert(err); } catch {}
      return;
    }

    // Validation 4: Passwords match
    if (password !== confirmPassword) {
      const err = 'Passwords do not match. Please verify your password.';
      setErrorMsg(err);
      try { if (typeof window !== 'undefined' && typeof window.alert === 'function') window.alert(err); } catch {}
      return;
    }

    setSubmitting(true);
    console.log('[LoginPage] Creating user in Firebase Authentication with createUserWithEmailAndPassword for:', email.trim());

    try {
      // Step 2: Use createUserWithEmailAndPassword(auth, email, password) correctly with await
      const userCredential = await createUserWithEmailAndPassword(auth, email.trim(), password);
      const createdUser = userCredential.user;
      console.log('[LoginPage] Firebase user created successfully in Authentication:', createdUser.uid);

      // Set user's displayName in Firebase Auth
      if (name.trim()) {
        try {
          await updateProfile(createdUser, { displayName: name.trim() });
        } catch (pErr) {
          console.warn('[LoginPage] updateProfile notice:', pErr);
        }
      }

      // Persist profile in Firestore database
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
        console.warn('[LoginPage] Firestore setDoc notice:', fsErr);
      }

      // Step 3: ONLY redirect to login page AFTER Firebase confirms user creation succeeds
      setInfoMsg('Account created successfully in Firebase! You can now sign in.');
      setActiveTab('login');
      setPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      console.error('[LoginPage] Firebase Sign Up error:', err);
      let realError = err.message || 'Firebase user creation failed.';

      if (err.code === 'auth/operation-not-allowed') {
        realError = 'Firebase Error (auth/operation-not-allowed): Email/Password sign-in provider is disabled in Firebase Console. Please go to Firebase Console > Authentication > Sign-in method and enable "Email/Password".';
      } else if (err.code === 'auth/email-already-in-use') {
        realError = 'Firebase Error (auth/email-already-in-use): This email is already registered in Firebase Authentication. Please sign in instead.';
      } else if (err.code === 'auth/weak-password') {
        realError = 'Firebase Error (auth/weak-password): Password must be at least 6 characters.';
      } else if (err.code === 'auth/invalid-email') {
        realError = 'Firebase Error (auth/invalid-email): The email address is badly formatted.';
      } else if (err.code === 'auth/network-request-failed') {
        realError = 'Firebase Error (auth/network-request-failed): Network error. Please check your connection.';
      }

      // Step 4: Show real error message on screen with alert
      setErrorMsg(realError);
      try {
        if (typeof window !== 'undefined' && typeof window.alert === 'function') {
          window.alert(realError);
        }
      } catch {}
      // User stays on the sign up tab, does NOT redirect to login!
    } finally {
      setSubmitting(false);
    }
  };

  // 2. Submit Login Form
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setInfoMsg(null);
    setShowResendConfirmation(false);

    // Validation: Email format
    if (!isValidEmail(email)) {
      const err = 'Please enter a valid email address.';
      setErrorMsg(err);
      try { if (typeof window !== 'undefined' && typeof window.alert === 'function') window.alert(err); } catch {}
      return;
    }

    // Validation: Password required
    if (!password) {
      const err = 'Please enter your password.';
      setErrorMsg(err);
      try { if (typeof window !== 'undefined' && typeof window.alert === 'function') window.alert(err); } catch {}
      return;
    }

    setSubmitting(true);
    console.log('[LoginPage] Submitting Login for:', email.trim());
    try {
      // Attempt Firebase Authentication first
      try {
        await signInWithEmailAndPassword(auth, email.trim(), password);
        console.log('[LoginPage] Firebase signInWithEmailAndPassword successful!');
        setInfoMsg('Login successful! Redirecting...');
        if (onLoginSuccess) {
          onLoginSuccess();
        }
        return;
      } catch (fbErr: any) {
        console.warn('[LoginPage] Firebase login notice:', fbErr.code, fbErr.message);
        if (
          fbErr.code !== 'auth/operation-not-allowed' &&
          fbErr.code !== 'auth/invalid-credential' &&
          fbErr.code !== 'auth/user-not-found' &&
          fbErr.code !== 'auth/wrong-password'
        ) {
          throw fbErr;
        }
      }

      // Fallback auth
      await signInWithSupabaseAuth(email.trim(), password);
      console.log('[LoginPage] Login successful!');
      setInfoMsg('Login successful! Redirecting...');
      if (onLoginSuccess) {
        onLoginSuccess();
      }
    } catch (err: any) {
      console.error('[LoginPage] Login error:', err);
      let realError = err.message || 'Login failed.';
      const msg = (err.message || '').toLowerCase();
      if (
        err.code === 'auth/wrong-password' ||
        err.code === 'auth/invalid-credential' ||
        msg.includes('invalid email or password') ||
        msg.includes('invalid credentials')
      ) {
        realError = 'Invalid email or password. Please verify your credentials and try again.';
        setShowCreateAccountPrompt(true);
      } else if (err.code === 'auth/user-not-found' || msg.includes('no account found')) {
        realError = 'No user found with this email in Firebase Authentication. Please click "Create Account with this Email" below.';
        setShowCreateAccountPrompt(true);
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

  // 3. Submit Forgot Password Form (Supabase Auth)
  const handleForgotPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setInfoMsg(null);
    setShowResendConfirmation(false);

    if (!isValidEmail(forgotEmail)) {
      setErrorMsg('Please enter a valid email address to receive reset instructions.');
      return;
    }

    setSubmitting(true);
    console.log('[LoginPage] Submitting password reset for:', forgotEmail.trim());
    try {
      await resetPasswordForEmail(forgotEmail.trim());
      setForgotSubmitted(true);
      setInfoMsg('Password reset instructions have been sent to your email.');
    } catch (err: any) {
      console.error('[LoginPage] Forgot password error:', err);
      setErrorMsg(err.message || 'Failed to send password reset email. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // Google Sign In fallback
  const handleGoogleSignIn = async () => {
    setErrorMsg(null);
    setInfoMsg(null);
    setSubmitting(true);
    try {
      await loginWithGoogle();
      if (onLoginSuccess) {
        onLoginSuccess();
      }
    } catch (err: any) {
      console.error('Google sign in error:', err);
      setErrorMsg(err.message || 'Google sign-in was cancelled or failed.');
    } finally {
      setSubmitting(false);
    }
  };

  // Super Admin secret login
  const handleSuperAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdminError(null);
    setAdminVerifying(true);
    try {
      await loginAsSuperAdmin(adminPassword, selectedAdminEmail);
      setShowAdminModal(false);
      if (onLoginSuccess) {
        onLoginSuccess();
      }
    } catch (err: any) {
      setAdminError(err.message || 'Incorrect Super Admin password');
    } finally {
      setAdminVerifying(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0A0A0A] flex flex-col items-center justify-between p-4 sm:p-6 relative overflow-hidden text-center select-none font-sans">
      
      {/* Floating Hearts Animated Background */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
        <style>{`
          @keyframes floatHeart {
            0% {
              transform: translateY(105vh) scale(0.8) rotate(0deg);
              opacity: 0;
            }
            15% {
              opacity: 0.65;
            }
            50% {
              transform: translateY(50vh) scale(1.1) rotate(15deg);
              opacity: 0.8;
            }
            85% {
              opacity: 0.4;
            }
            100% {
              transform: translateY(-10vh) scale(0.9) rotate(-15deg);
              opacity: 0;
            }
          }
          .floating-heart {
            position: absolute;
            animation: floatHeart linear infinite;
            will-change: transform, opacity;
          }
        `}</style>
        {FLOATING_HEARTS.map((h) => (
          <div
            key={h.id}
            className="floating-heart"
            style={{
              left: h.left,
              bottom: '-30px',
              animationDelay: h.delay,
              animationDuration: h.duration,
              opacity: h.opacity,
            }}
          >
            <svg 
              width={h.size} 
              height={h.size} 
              viewBox="0 0 24 24" 
              fill="#FF6BA9"
              style={{ filter: 'drop-shadow(0 0 8px rgba(255,107,169,0.7))' }}
            >
              <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
            </svg>
          </div>
        ))}
      </div>

      {/* Main Content Column */}
      <div className="w-full max-w-[420px] z-10 flex flex-col items-center my-auto pt-2 pb-6">

        {/* Center Logo with Neon Pink Border and Online Dot */}
        <div 
          className="relative mb-3 cursor-pointer group"
          onDoubleClick={() => setShowAdminModal(true)}
          title="Double tap to open Admin access"
        >
          <div className="w-[84px] h-[84px] rounded-full p-[2px] bg-gradient-to-tr from-[#FF6BA9] to-[#FF85BA] shadow-[0_0_24px_rgba(255,107,169,0.65)] flex items-center justify-center">
            <img
              src={meetupLogo}
              alt="Meet Up Logo"
              className="w-full h-full rounded-full object-cover bg-black"
            />
          </div>
          {/* Green online dot */}
          <div className="absolute bottom-1 right-1 w-[18px] h-[18px] rounded-full bg-[#10B981] border-[2.5px] border-[#0A0A0A] shadow-[0_0_8px_#10B981] flex items-center justify-center">
            <span className="w-1.5 h-1.5 rounded-full bg-white/90"></span>
          </div>
        </div>

        {/* Brand Title */}
        <div className="flex items-center justify-center gap-3 mb-1">
          <span className="text-[#FF6BA9] inline-flex items-center drop-shadow-[0_0_8px_rgba(255,107,169,0.85)]">
            <svg width="28" height="22" viewBox="0 0 32 24" fill="none" stroke="#FF6BA9" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 18.5l-1.1-1C5 13 2 10.5 2 7.2 2 4.5 4 2.5 6.7 2.5c1.5 0 3 .7 4 1.8 1-1.1 2.5-1.8 4-1.8 2.7 0 4.7 2 4.7 4.7 0 3.3-3 5.8-8.9 10.3L12 18.5z" />
              <path d="M21 16.5l-.8-.7C16 12 14 10 14 7.5c0-1.8 1.3-3.2 3.1-3.2 1.1 0 2.1.5 2.8 1.3.7-.8 1.7-1.3 2.8-1.3 1.8 0 3.2 1.4 3.2 3.2 0 2.5-2 4.5-6.1 8.3L21 16.5z" opacity="0.85" />
            </svg>
          </span>

          <h1 className="text-3xl sm:text-4xl font-serif font-bold tracking-wide text-white drop-shadow-sm select-none">
            Meet Up
          </h1>

          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#FF6BA9] shadow-[0_0_8px_#FF6BA9]"></span>
            <span className="text-[#FF6BA9] inline-flex items-center drop-shadow-[0_0_8px_rgba(255,107,169,0.85)]">
              <svg width="28" height="22" viewBox="0 0 32 24" fill="none" stroke="#FF6BA9" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 18.5l-1.1-1C5 13 2 10.5 2 7.2 2 4.5 4 2.5 6.7 2.5c1.5 0 3 .7 4 1.8 1-1.1 2.5-1.8 4-1.8 2.7 0 4.7 2 4.7 4.7 0 3.3-3 5.8-8.9 10.3L12 18.5z" />
                <path d="M21 16.5l-.8-.7C16 12 14 10 14 7.5c0-1.8 1.3-3.2 3.1-3.2 1.1 0 2.1.5 2.8 1.3.7-.8 1.7-1.3 2.8-1.3 1.8 0 3.2 1.4 3.2 3.2 0 2.5-2 4.5-6.1 8.3L21 16.5z" opacity="0.85" />
              </svg>
            </span>
          </div>
        </div>

        {/* Subtitle */}
        <p className="text-zinc-400 text-sm font-normal mb-5">
          {isForgotPassword 
            ? 'Reset your account password' 
            : activeTab === 'signup' 
              ? 'Create a new account with email' 
              : 'Sign in with your email & password'}
        </p>

        {/* Error Feedback Banner */}
        {errorMsg && (
          <div className="w-full p-3.5 mb-4 rounded-2xl bg-red-500/15 border border-red-500/40 text-red-200 text-xs flex flex-col gap-2.5 animate-in fade-in text-left shadow-lg">
            <div className="flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <span className="leading-relaxed flex-1 font-medium">{errorMsg}</span>
            </div>
            {showCreateAccountPrompt && (
              <div className="pt-2 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-t border-red-500/20">
                <span className="text-[11px] text-zinc-300">Need to register?</span>
                <button
                  type="button"
                  onClick={handleSwitchToCreateAccount}
                  className="px-3 py-1.5 rounded-xl bg-[#FF6BA9] hover:bg-[#FF7FB7] text-white text-[11px] font-bold shadow-[0_2px_12px_rgba(255,107,169,0.3)] transition cursor-pointer"
                >
                  Create Account with this Email
                </button>
              </div>
            )}
            {showResendConfirmation && (
              <div className="pt-1 flex items-center justify-between border-t border-red-500/20">
                <span className="text-[11px] text-zinc-400">Didn't receive the email?</span>
                <button
                  type="button"
                  onClick={handleResendConfirmation}
                  disabled={resendingEmail}
                  className="px-3 py-1.5 rounded-xl bg-[#FF6BA9] hover:bg-[#FF7FB7] text-white text-[11px] font-bold shadow-[0_2px_12px_rgba(255,107,169,0.3)] transition cursor-pointer disabled:opacity-50"
                >
                  {resendingEmail ? 'Sending Link...' : 'Resend Verification Email'}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Success Feedback Banner */}
        {infoMsg && (
          <div className="w-full p-3 mb-4 rounded-2xl bg-[#FF6BA9]/15 border border-[#FF6BA9]/40 text-pink-200 text-xs flex items-center gap-2.5 animate-in fade-in text-left">
            <CheckCircle2 className="w-4 h-4 text-[#FF6BA9] shrink-0" />
            <span className="leading-relaxed flex-1">{infoMsg}</span>
          </div>
        )}

        {/* Requirement 2: Auth screen should have 2 tabs: Create Account and Login */}
        {!isForgotPassword && (
          <div className="w-full grid grid-cols-2 gap-2 p-1.5 mb-5 rounded-2xl bg-[#121217] border border-zinc-800">
            <button
              type="button"
              onClick={() => handleTabChange('signup')}
              className={`py-3 px-3 rounded-xl font-serif text-sm font-semibold transition-all duration-200 cursor-pointer flex items-center justify-center gap-1.5 ${
                activeTab === 'signup'
                  ? 'bg-[#FF6BA9] text-white shadow-[0_2px_16px_rgba(255,107,169,0.5)] scale-[1.01]'
                  : 'text-zinc-400 hover:text-white hover:bg-zinc-800/50'
              }`}
            >
              <span>Create Account</span>
            </button>

            <button
              type="button"
              onClick={() => handleTabChange('login')}
              className={`py-3 px-3 rounded-xl font-serif text-sm font-semibold transition-all duration-200 cursor-pointer flex items-center justify-center gap-1.5 ${
                activeTab === 'login'
                  ? 'bg-[#FF6BA9] text-white shadow-[0_2px_16px_rgba(255,107,169,0.5)] scale-[1.01]'
                  : 'text-zinc-400 hover:text-white hover:bg-zinc-800/50'
              }`}
            >
              <span>Login</span>
            </button>
          </div>
        )}

        {/* ============================================================ */}
        {/* TAB 1: CREATE ACCOUNT (Requirement 3)                         */}
        {/* Fields: Name, Email, Password, Confirm Password              */}
        {/* ============================================================ */}
        {!isForgotPassword && activeTab === 'signup' && (
          <form onSubmit={handleSignUpSubmit} className="w-full space-y-3.5 animate-in fade-in">
            {/* Field 1: Name */}
            <div className="text-left">
              <label className="text-xs font-semibold text-zinc-300 block mb-1.5">
                Full Name
              </label>
              <div className="flex items-center rounded-2xl border-2 border-[#FF6BA9]/80 focus-within:border-[#FF6BA9] bg-[#121217] px-3.5 py-3 gap-2.5 transition shadow-[0_0_12px_rgba(255,107,169,0.12)]">
                <User className="w-4 h-4 text-[#FF6BA9] shrink-0" />
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Enter your full name"
                  className="w-full bg-transparent text-sm font-medium text-white placeholder:text-zinc-500 focus:outline-none"
                  required
                />
              </div>
            </div>

            {/* Field 2: Email */}
            <div className="text-left">
              <label className="text-xs font-semibold text-zinc-300 block mb-1.5">
                Email Address
              </label>
              <div className="flex items-center rounded-2xl border-2 border-[#FF6BA9]/80 focus-within:border-[#FF6BA9] bg-[#121217] px-3.5 py-3 gap-2.5 transition shadow-[0_0_12px_rgba(255,107,169,0.12)]">
                <Mail className="w-4 h-4 text-[#FF6BA9] shrink-0" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="w-full bg-transparent text-sm font-medium text-white placeholder:text-zinc-500 focus:outline-none"
                  required
                />
              </div>
            </div>

            {/* Field 3: Password with Show/Hide Toggle (Requirement 5) */}
            <div className="text-left">
              <label className="text-xs font-semibold text-zinc-300 block mb-1.5">
                Password <span className="text-zinc-500 font-normal">(min 6 characters)</span>
              </label>
              <div className="flex items-center rounded-2xl border-2 border-[#FF6BA9]/80 focus-within:border-[#FF6BA9] bg-[#121217] px-3.5 py-3 gap-2.5 transition shadow-[0_0_12px_rgba(255,107,169,0.12)]">
                <Lock className="w-4 h-4 text-[#FF6BA9] shrink-0" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Create a password"
                  className="w-full bg-transparent text-sm font-medium text-white placeholder:text-zinc-500 focus:outline-none"
                  required
                  minLength={6}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="text-zinc-400 hover:text-zinc-200 transition p-1 cursor-pointer"
                  title={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4 text-[#FF6BA9]" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Field 4: Confirm Password with Show/Hide Toggle */}
            <div className="text-left">
              <label className="text-xs font-semibold text-zinc-300 block mb-1.5">
                Confirm Password
              </label>
              <div className="flex items-center rounded-2xl border-2 border-[#FF6BA9]/80 focus-within:border-[#FF6BA9] bg-[#121217] px-3.5 py-3 gap-2.5 transition shadow-[0_0_12px_rgba(255,107,169,0.12)]">
                <Lock className="w-4 h-4 text-[#FF6BA9] shrink-0" />
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter password"
                  className="w-full bg-transparent text-sm font-medium text-white placeholder:text-zinc-500 focus:outline-none"
                  required
                  minLength={6}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="text-zinc-400 hover:text-zinc-200 transition p-1 cursor-pointer"
                  title={showConfirmPassword ? 'Hide password' : 'Show password'}
                >
                  {showConfirmPassword ? <EyeOff className="w-4 h-4 text-[#FF6BA9]" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Terms & Privacy Notice */}
            <p className="text-[11px] text-zinc-400 text-left pt-1">
              By creating an account, you agree to our{' '}
              <button
                type="button"
                onClick={() => setShowPrivacyModal(true)}
                className="text-[#FF6BA9] hover:underline cursor-pointer inline"
              >
                Terms & Privacy Policy
              </button>
              .
            </p>

            {/* Submit Button */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3.5 px-6 rounded-2xl sm:rounded-3xl bg-[#FF6BA9] hover:bg-[#FF7FB7] active:scale-[0.99] text-white font-serif text-base font-bold shadow-[0_6px_28px_rgba(255,107,169,0.5)] transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
              >
                <span>{submitting ? 'Creating Account...' : 'Create Account'}</span>
                <ArrowRight className="w-5 h-5 text-white" />
              </button>
            </div>
          </form>
        )}

        {/* ============================================================ */}
        {/* TAB 2: LOGIN (Requirement 4)                                  */}
        {/* Fields: Email, Password, Forgot Password link                */}
        {/* ============================================================ */}
        {!isForgotPassword && activeTab === 'login' && (
          <form onSubmit={handleLoginSubmit} className="w-full space-y-3.5 animate-in fade-in">
            {/* Field 1: Email */}
            <div className="text-left">
              <label className="text-xs font-semibold text-zinc-300 block mb-1.5">
                Email Address
              </label>
              <div className="flex items-center rounded-2xl border-2 border-[#FF6BA9]/80 focus-within:border-[#FF6BA9] bg-[#121217] px-3.5 py-3 gap-2.5 transition shadow-[0_0_12px_rgba(255,107,169,0.12)]">
                <Mail className="w-4 h-4 text-[#FF6BA9] shrink-0" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="w-full bg-transparent text-sm font-medium text-white placeholder:text-zinc-500 focus:outline-none"
                  required
                />
              </div>
            </div>

            {/* Field 2: Password with Show/Hide Toggle (Requirement 5) */}
            <div className="text-left">
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-zinc-300">
                  Password
                </label>
                {/* Requirement 6: Forgot Password link */}
                <button
                  type="button"
                  onClick={() => {
                    setForgotEmail(email);
                    setIsForgotPassword(true);
                    setErrorMsg(null);
                    setInfoMsg(null);
                  }}
                  className="text-xs text-[#FF6BA9] hover:underline transition cursor-pointer"
                >
                  Forgot Password?
                </button>
              </div>

              <div className="flex items-center rounded-2xl border-2 border-[#FF6BA9]/80 focus-within:border-[#FF6BA9] bg-[#121217] px-3.5 py-3 gap-2.5 transition shadow-[0_0_12px_rgba(255,107,169,0.12)]">
                <Lock className="w-4 h-4 text-[#FF6BA9] shrink-0" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="w-full bg-transparent text-sm font-medium text-white placeholder:text-zinc-500 focus:outline-none"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="text-zinc-400 hover:text-zinc-200 transition p-1 cursor-pointer"
                  title={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4 text-[#FF6BA9]" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3.5 px-6 rounded-2xl sm:rounded-3xl bg-[#FF6BA9] hover:bg-[#FF7FB7] active:scale-[0.99] text-white font-serif text-base font-bold shadow-[0_6px_28px_rgba(255,107,169,0.5)] transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
              >
                <span>{submitting ? 'Logging in...' : 'Sign In'}</span>
                <ArrowRight className="w-5 h-5 text-white" />
              </button>
            </div>
          </form>
        )}

        {/* ============================================================ */}
        {/* FORGOT PASSWORD VIEW (Requirement 6)                         */}
        {/* ============================================================ */}
        {isForgotPassword && (
          <form onSubmit={handleForgotPasswordSubmit} className="w-full space-y-4 animate-in fade-in text-left">
            <div className="p-4 rounded-2xl bg-[#121217] border border-zinc-800 text-center">
              <KeyRound className="w-8 h-8 text-[#FF6BA9] mx-auto mb-2" />
              <h3 className="text-base font-serif font-bold text-white mb-1">
                Forgot Password?
              </h3>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Enter your registered email address and we'll send you a link to reset your password.
              </p>
            </div>

            <div>
              <label className="text-xs font-semibold text-zinc-300 block mb-1.5">
                Registered Email
              </label>
              <div className="flex items-center rounded-2xl border-2 border-[#FF6BA9]/80 focus-within:border-[#FF6BA9] bg-[#121217] px-3.5 py-3 gap-2.5 transition shadow-[0_0_12px_rgba(255,107,169,0.12)]">
                <Mail className="w-4 h-4 text-[#FF6BA9] shrink-0" />
                <input
                  type="email"
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="w-full bg-transparent text-sm font-medium text-white placeholder:text-zinc-500 focus:outline-none"
                  required
                />
              </div>
            </div>

            <div className="space-y-2 pt-1">
              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3.5 px-6 rounded-2xl sm:rounded-3xl bg-[#FF6BA9] hover:bg-[#FF7FB7] text-white font-serif text-base font-bold shadow-[0_6px_28px_rgba(255,107,169,0.5)] transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
              >
                <span>{submitting ? 'Sending Link...' : 'Send Reset Link'}</span>
                <ArrowRight className="w-5 h-5 text-white" />
              </button>

              <button
                type="button"
                onClick={() => {
                  setIsForgotPassword(false);
                  setErrorMsg(null);
                  setInfoMsg(null);
                }}
                className="w-full py-2.5 text-xs text-zinc-400 hover:text-white transition flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back to Login</span>
              </button>
            </div>
          </form>
        )}

        {/* Divider: "or continue with" */}
        {!isForgotPassword && (
          <>
            <div className="relative flex items-center justify-center my-5 w-full">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-zinc-800"></div>
              </div>
              <span className="relative px-4 bg-[#0A0A0A] text-xs italic text-zinc-400 font-serif">
                or continue with
              </span>
            </div>

            {/* Google Sign In Button */}
            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={submitting}
              className="w-full py-3 px-4 rounded-2xl bg-[#121217] border border-zinc-800 hover:border-zinc-600 transition flex items-center justify-center gap-3 text-sm font-medium text-white cursor-pointer active:scale-[0.99] disabled:opacity-60"
            >
              <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z"/>
                <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.24v3.15C3.26 21.4 7.33 24 12 24z"/>
                <path fill="#FBBC05" d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.14-1.55.38-2.27V6.58H1.24C.45 8.14 0 9.97 0 12s.45 3.86 1.24 5.42l4.04-3.15z"/>
                <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.6 1.24 6.58l4.04 3.15c.95-2.83 3.6-4.98 6.72-4.98z"/>
              </svg>
              <span>Continue with Google</span>
            </button>
          </>
        )}
      </div>

      {/* Bottom Protected Footer */}
      <div className="w-full max-w-[420px] z-10 flex items-center justify-center gap-1.5 text-zinc-400 text-xs italic font-serif py-2 select-none">
        <Shield className="w-4 h-4 text-[#FF6BA9] shrink-0" />
        <span 
          onClick={() => setShowAdminModal(true)}
          className="hover:text-zinc-200 transition cursor-pointer"
        >
          Protected • Private & Encrypted
        </span>
      </div>

      {/* Hidden Super Admin Access Modal */}
      {showAdminModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-in fade-in">
          <div className="w-full max-w-sm rounded-3xl bg-[#121217] border border-pink-500/30 p-6 shadow-[0_0_50px_rgba(255,107,169,0.3)] text-left">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-[#FF6BA9]/20 flex items-center justify-center text-[#FF6BA9]">
                <Shield className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Administrator Access</h3>
                <p className="text-xs text-zinc-400">Restricted authentication portal</p>
              </div>
            </div>

            {adminError && (
              <div className="p-3 mb-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 text-xs">
                {adminError}
              </div>
            )}

            <form onSubmit={handleSuperAdminLogin} className="space-y-4">
              <div>
                <label className="text-xs text-zinc-300 block mb-1.5 font-medium">Select Admin Account</label>
                <div className="grid grid-cols-3 gap-1.5 mb-2">
                  <button
                    type="button"
                    onClick={() => setSelectedAdminEmail('rajasuvimarriage09@gmail.com')}
                    className={`px-2 py-1.5 rounded-xl text-left border text-xs transition cursor-pointer ${
                      selectedAdminEmail === 'rajasuvimarriage09@gmail.com'
                        ? 'bg-[#FF6BA9]/20 border-[#FF6BA9] text-white font-bold'
                        : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:border-zinc-700'
                    }`}
                  >
                    <div className="text-[10px] font-bold truncate">rajasuvimarriage</div>
                    <div className="text-[8px] text-zinc-400">Raja Admin</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedAdminEmail('gcrtech.raja@gmail.com')}
                    className={`px-2 py-1.5 rounded-xl text-left border text-xs transition cursor-pointer ${
                      selectedAdminEmail === 'gcrtech.raja@gmail.com'
                        ? 'bg-[#FF6BA9]/20 border-[#FF6BA9] text-white font-bold'
                        : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:border-zinc-700'
                    }`}
                  >
                    <div className="text-[10px] font-bold truncate">gcrtech.raja</div>
                    <div className="text-[8px] text-zinc-400">Raja Admin</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedAdminEmail('mrraavana07@gmail.com')}
                    className={`px-2 py-1.5 rounded-xl text-left border text-xs transition cursor-pointer ${
                      selectedAdminEmail === 'mrraavana07@gmail.com'
                        ? 'bg-[#FF6BA9]/20 border-[#FF6BA9] text-white font-bold'
                        : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:border-zinc-700'
                    }`}
                  >
                    <div className="text-[10px] font-bold truncate">mrraavana07</div>
                    <div className="text-[8px] text-zinc-400">Raavana Admin</div>
                  </button>
                </div>
              </div>

              <div>
                <label className="text-xs text-zinc-300 block mb-1.5 font-medium">Security Password</label>
                <div className="flex items-center rounded-xl bg-black border border-zinc-800 px-3 py-2.5">
                  <Lock className="w-4 h-4 text-zinc-500 mr-2 shrink-0" />
                  <input
                    type="password"
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                    placeholder="Enter admin password"
                    className="w-full bg-transparent text-sm text-white focus:outline-none"
                    autoFocus
                    required
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAdminModal(false)}
                  className="flex-1 py-2.5 rounded-xl bg-zinc-800 text-zinc-300 text-xs font-semibold hover:bg-zinc-700 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={adminVerifying}
                  className="flex-1 py-2.5 rounded-xl bg-[#FF6BA9] text-white text-xs font-semibold hover:bg-[#FF7FB7] shadow-[0_0_15px_rgba(255,107,169,0.4)] transition disabled:opacity-50"
                >
                  {adminVerifying ? 'Verifying...' : 'Unlock Admin'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Legal Modals */}
      {showPrivacyModal && (
        <LegalModals
          type="privacy"
          onClose={() => setShowPrivacyModal(false)}
        />
      )}
    </div>
  );
};
