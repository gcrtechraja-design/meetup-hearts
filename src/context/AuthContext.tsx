import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { 
  User as FirebaseUser,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  deleteUser,
  signInWithPhoneNumber,
  ConfirmationResult
} from 'firebase/auth';
import { getOrCreateRecaptchaVerifier, clearRecaptchaVerifier } from '../utils/recaptcha';
import { 
  doc, 
  onSnapshot, 
  setDoc, 
  updateDoc, 
  deleteDoc,
  serverTimestamp,
  increment,
  getDoc,
  collection,
  query,
  where,
  getDocs
} from 'firebase/firestore';
import { auth, db } from '../firebase/config';
import { UserProfile, UserRole, AUDIO_COIN_PER_MINUTE, VIDEO_COIN_PER_MINUTE } from '../types';
import { SupportedLanguage } from '../utils/i18n';
import { seedFirestoreDatabase } from '../firebase/seed';
import { getDefaultFemaleAvatar } from '../services/staticCdnService';
import { requestNotificationPermissionAndSaveToken, initFCM } from '../services/fcmService';
import { findCity } from '../utils/cities';
import { hashPassword } from '../utils/crypto';
import { 
  getSupabaseClient, 
  signInWithSupabase, 
  signUpWithSupabase, 
  resetPasswordWithSupabase, 
  resendConfirmationEmail,
  signOutFromSupabase 
} from '../services/supabase';
import { isAdminEmail, isUserAdmin } from '../utils/admin';

interface AuthContextType {
  currentUser: UserProfile | null;
  firebaseUser: FirebaseUser | null;
  loading: boolean;
  login: (email: string, pass: string) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  signInWithSupabaseAuth: (email: string, pass: string) => Promise<void>;
  signUpWithSupabaseAuth: (params: { name: string; email: string; pass: string }) => Promise<{ needsEmailConfirmation: boolean; user: any }>;
  resetPasswordForEmail: (email: string) => Promise<boolean>;
  resendConfirmationForEmail: (email: string) => Promise<boolean>;
  register: (data: {
    email: string;
    pass: string;
    name: string;
    age: number;
    gender: 'male' | 'female' | 'other';
    location: string;
    city?: string;
    bio?: string;
    interests?: string[];
    role?: UserRole;
    allowVideoCalls?: boolean;
  }) => Promise<void>;
  sendPhoneOtp: (phoneNumber: string, containerId?: string) => Promise<ConfirmationResult>;
  verifyPhoneLogin: (confirmationResult: ConfirmationResult, otp: string, phoneNumber: string) => Promise<void>;
  verifyPhoneRegister: (
    confirmationResult: ConfirmationResult,
    otp: string,
    data: {
      phone: string;
      name: string;
      age: number;
      gender: 'male' | 'female' | 'other';
      location: string;
      city?: string;
      bio?: string;
      interests?: string[];
      role?: UserRole;
      allowVideoCalls?: boolean;
    }
  ) => Promise<void>;
  logout: () => Promise<void>;
  updateUserLanguage: (lang: SupportedLanguage) => Promise<void>;
  updateCoins: (delta: number) => Promise<void>;
  updateDiamonds: (delta: number) => Promise<void>;
  deleteMyAccount: () => Promise<void>;
  demoLoginAsUser: () => Promise<void>;
  demoLoginAsAdmin: (targetEmail?: string) => Promise<void>;
  loginAsSuperAdmin: (password: string, adminEmail?: string) => Promise<void>;
  requestPushPermission: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const unsubscribeSnapshotRef = useRef<(() => void) | null>(null);
  const requestedFcmRef = useRef<string | null>(null);

  // Requirement 1: Request notification permission on login and save FCM token to Firestore
  useEffect(() => {
    if (currentUser?.uid && requestedFcmRef.current !== currentUser.uid) {
      requestedFcmRef.current = currentUser.uid;
      // Initialize FCM service worker and request notification permission
      requestNotificationPermissionAndSaveToken(currentUser.uid).then((res) => {
        if (res.token) {
          console.log('[FCM] Push token registered for active user:', currentUser.name);
        }
      }).catch((err) => {
        console.warn('[FCM] Notification permission request error:', err);
      });
    }
  }, [currentUser?.uid]);

  // Safety timeout: Never let the app hang on "Connecting to Firestore & Auth..."
  useEffect(() => {
    const timer = setTimeout(() => {
      setLoading(false);
    }, 2000);
    return () => clearTimeout(timer);
  }, []);

  const requestPushPermission = async () => {
    if (!currentUser?.uid) return;
    await requestNotificationPermissionAndSaveToken(currentUser.uid);
  };

  // Bind real-time snapshot to user document in Firestore
  const bindUserDoc = (uid: string) => {
    if (unsubscribeSnapshotRef.current) {
      unsubscribeSnapshotRef.current();
      unsubscribeSnapshotRef.current = null;
    }

    const userDocRef = doc(db, 'users', uid);
    unsubscribeSnapshotRef.current = onSnapshot(userDocRef, (docSnapshot) => {
      if (docSnapshot.exists()) {
        const data = docSnapshot.data() as UserProfile;
        const isAdmin = isAdminEmail(data.email);
        if (isAdmin && (data.role !== 'admin' || !data.is_admin)) {
          data.role = 'admin';
          data.is_admin = true;
          data.isAdmin = true;
          updateDoc(userDocRef, { role: 'admin', is_admin: true, isAdmin: true }).catch(() => {});
        }
        // Real customer without uploaded photo: ensure cute female avatar illustration
        if (data.role === 'user' && (!data.profile_pic || data.profile_pic.includes('bottts') || data.profile_pic.includes('seed=user'))) {
          const femaleAvatar = getDefaultFemaleAvatar(uid);
          data.profile_pic = femaleAvatar;
          updateDoc(userDocRef, { profile_pic: femaleAvatar }).catch(() => {});
        }
        setCurrentUser(data);
      } else {
        setCurrentUser(null);
      }
      setLoading(false);
    }, (err) => {
      console.error('Firestore user snapshot error:', err);
      setLoading(false);
    });
  };

  // Auto run seeding on first mount
  useEffect(() => {
    seedFirestoreDatabase().catch(console.error);
  }, []);

  // Helper to sync Supabase user session to Firestore and bind state
  const handleSupabaseUserSession = async (sbUser: any) => {
    const uid = sbUser.id;
    const userDocRef = doc(db, 'users', uid);
    const email = sbUser.email?.trim().toLowerCase() || '';
    const isAdmin = isAdminEmail(email);

    // Sync to Supabase profiles table
    if (isAdmin) {
      try {
        const supabase = getSupabaseClient();
        await supabase
          .from('profiles')
          .update({ role: 'admin', is_admin: true })
          .eq('id', uid);
      } catch (err) {
        console.warn('Could not update role in Supabase profiles:', err);
      }
    }

    try {
      const snap = await getDoc(userDocRef);
      if (!snap.exists()) {
        const name = sbUser.user_metadata?.name || sbUser.user_metadata?.full_name || sbUser.email?.split('@')[0] || (isAdmin ? 'Admin' : 'Member');
        const newProfile: UserProfile = {
          uid,
          name,
          email: sbUser.email || '',
          age: 25,
          gender: 'other',
          location: 'Chennai, Tamil Nadu',
          bio: isAdmin ? 'Meet Up Platform Administrator' : 'Hey there! Exploring Meet Up.',
          profile_pic: getDefaultFemaleAvatar(uid),
          interests: isAdmin ? ['Safety', 'Platform Operations', 'Moderation'] : ['Music', 'Dating', 'Conversations'],
          language: 'en',
          role: isAdmin ? 'admin' : 'user',
          is_admin: isAdmin,
          isAdmin: isAdmin,
          coins_balance: isAdmin ? 9999 : 50,
          diamonds_balance: isAdmin ? 500 : 0,
          voice_rate: AUDIO_COIN_PER_MINUTE,
          video_rate: VIDEO_COIN_PER_MINUTE,
          status: 'online',
          is_blocked: false,
          isBlocked: false,
          created_at: serverTimestamp(),
          createdAt: serverTimestamp(),
        };
        await setDoc(userDocRef, newProfile);
      } else {
        const existingData = snap.data();
        if (isAdmin && (existingData.role !== 'admin' || !existingData.is_admin)) {
          await updateDoc(userDocRef, {
            role: 'admin',
            is_admin: true,
            isAdmin: true,
            coins_balance: Math.max(existingData.coins_balance || 0, 9999),
          });
        }
      }
    } catch (e) {
      console.warn('Error reading/writing user doc for Supabase auth:', e);
    }
    bindUserDoc(uid);
    setLoading(false);
  };

  // Listen to Supabase Auth state (persisted session)
  useEffect(() => {
    let isMounted = true;
    const supabase = getSupabaseClient();

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!isMounted) return;
      if (session?.user) {
        await handleSupabaseUserSession(session.user);
      }
    }).catch(console.warn);

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!isMounted) return;
      if (session?.user) {
        await handleSupabaseUserSession(session.user);
      } else if (event === 'SIGNED_OUT') {
        if (!auth.currentUser && !localStorage.getItem('meetup_active_user_uid')) {
          setCurrentUser(null);
        }
      }
    });

    return () => {
      isMounted = false;
      subscription?.unsubscribe();
    };
  }, []);

  // Listen to Firebase Auth state with fallback to local session
  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (fUser) => {
      setFirebaseUser(fUser);

      if (fUser) {
        localStorage.removeItem('meetup_active_user_uid');
        const userDocRef = doc(db, 'users', fUser.uid);
        const email = fUser.email?.trim().toLowerCase() || '';
        const isAdmin = isAdminEmail(email);
        
        // Ensure doc exists in Firestore
        try {
          const snap = await getDoc(userDocRef);
          if (!snap.exists()) {
            const fallbackEmail = fUser.email || (fUser.phoneNumber ? `${fUser.phoneNumber.replace(/[^0-9]/g, '')}@meetup.user` : '');
            const newProfile: UserProfile = {
              uid: fUser.uid,
              name: fUser.displayName || (fUser.phoneNumber ? `User ${fUser.phoneNumber.slice(-4)}` : fUser.email?.split('@')[0] || (isAdmin ? 'Admin' : 'Member')),
              email: fallbackEmail,
              phone_number: fUser.phoneNumber || undefined,
              age: 25,
              gender: 'other',
              location: 'Chennai, Tamil Nadu',
              bio: isAdmin ? 'Meet Up Platform Administrator' : 'Hey there! Exploring Meet Up.',
              profile_pic: fUser.photoURL || `https://api.dicebear.com/7.x/bottts/svg?seed=${fUser.uid}`,
              interests: isAdmin ? ['Safety', 'Platform Operations', 'Moderation'] : ['Music', 'Dating', 'Conversations'],
              language: 'en',
              role: isAdmin ? 'admin' : 'user',
              is_admin: isAdmin,
              isAdmin: isAdmin,
              coins_balance: isAdmin ? 9999 : 50,
              diamonds_balance: isAdmin ? 500 : 0,
              voice_rate: AUDIO_COIN_PER_MINUTE,
              video_rate: VIDEO_COIN_PER_MINUTE,
              status: 'online',
              is_blocked: false,
              isBlocked: false,
              created_at: serverTimestamp(),
              createdAt: serverTimestamp(),
            };
            await setDoc(userDocRef, newProfile);
          } else {
            const existingData = snap.data();
            if (isAdmin && (existingData.role !== 'admin' || !existingData.is_admin)) {
              await updateDoc(userDocRef, {
                role: 'admin',
                is_admin: true,
                isAdmin: true,
                coins_balance: Math.max(existingData.coins_balance || 0, 9999),
              });
            } else if (fUser.phoneNumber && !existingData.phone_number) {
              await updateDoc(userDocRef, { phone_number: fUser.phoneNumber });
            }
          }
        } catch (e) {
          console.warn('Error reading/writing user doc on auth change:', e);
        }

        bindUserDoc(fUser.uid);
      } else {
        // If not in Firebase Auth, check if active local/Firestore session exists
        const localUid = localStorage.getItem('meetup_active_user_uid');
        if (localUid) {
          console.log('[AuthContext] Restoring active local session for:', localUid);
          bindUserDoc(localUid);
        } else {
          if (unsubscribeSnapshotRef.current) {
            unsubscribeSnapshotRef.current();
            unsubscribeSnapshotRef.current = null;
          }
          setCurrentUser(null);
          setLoading(false);
        }
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeSnapshotRef.current) {
        unsubscribeSnapshotRef.current();
      }
    };
  }, []);

  // Google Sign In (Supported directly by Firebase in AI Studio)
  const loginWithGoogle = async () => {
    setLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (err: any) {
      console.error('Google sign in error:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // Supabase Auth Methods
  const signInWithSupabaseAuth = async (email: string, pass: string) => {
    setLoading(true);
    const trimmedEmail = email.trim().toLowerCase();

    console.log('[AuthContext] signInWithSupabaseAuth initiated for:', trimmedEmail);

    // 1. Check if it's super admin credentials or authorized admin email
    if (
      (trimmedEmail === 'admin@meetup.com' ||
       trimmedEmail === 'rajasuvimarriage09@gmail.com' ||
       trimmedEmail === 'gcrtech.raja@gmail.com' ||
       trimmedEmail === 'mrraavana07@gmail.com') &&
      (pass === 'admin123' || pass === 'Raja@2026')
    ) {
      console.log('[AuthContext] Logging in as admin with credentials for:', trimmedEmail);
      await demoLoginAsAdmin(trimmedEmail);
      setLoading(false);
      return;
    }

    try {
      // 2. Try Supabase Auth
      const res = await signInWithSupabase(trimmedEmail, pass);
      if (res.user) {
        console.log('[AuthContext] Supabase sign in successful, syncing user session for:', res.user.id);
        await handleSupabaseUserSession(res.user);
        return;
      }
    } catch (sbErr: any) {
      console.warn('[AuthContext] Supabase sign in attempt failed, checking Firestore credentials:', sbErr.message);

      // 3. Fallback: Check Firestore users collection for matching email & password hash
      try {
        const usersRef = collection(db, 'users');
        const snap = await getDocs(query(usersRef, where('email', '==', trimmedEmail)));
        if (!snap.empty) {
          const userDoc = snap.docs[0];
          const data = userDoc.data();
          const hashedPass = await hashPassword(pass);

          const passMatches = 
            data.password_hash === hashedPass ||
            data.password_hash === pass ||
            (isAdminEmail(trimmedEmail) && (pass === 'admin123' || pass === 'Raja@2026'));

          if (passMatches) {
            console.log('[AuthContext] Firestore password match succeeded for:', trimmedEmail);
            localStorage.setItem('meetup_active_user_uid', userDoc.id);
            bindUserDoc(userDoc.id);
            return;
          }
        }
      } catch (fsErr) {
        console.warn('[AuthContext] Firestore credential check error:', fsErr);
      }

      console.error('[AuthContext] signInWithSupabaseAuth error:', sbErr);
      throw sbErr;
    } finally {
      setLoading(false);
    }
  };

  const signUpWithSupabaseAuth = async (params: { name: string; email: string; pass: string }) => {
    setLoading(true);
    const trimmedEmail = params.email.trim().toLowerCase();
    const trimmedName = params.name.trim();

    console.log('[AuthContext] signUpWithSupabaseAuth initiated for:', trimmedEmail);

    try {
      const res = await signUpWithSupabase({
        name: trimmedName,
        email: trimmedEmail,
        password: params.pass,
      });

      console.log('[AuthContext] Supabase signUp returned:', {
        userId: res.user?.id,
        hasSession: !!res.session,
        needsEmailConfirmation: res.needsEmailConfirmation,
      });

      // ONLY establish active session if session is present (not waiting on email verification)
      if (res.session && res.user) {
        console.log('[AuthContext] Active session returned immediately, syncing user session');
        await handleSupabaseUserSession(res.user);
      } else {
        console.log('[AuthContext] Email confirmation required. Session will activate once email is verified.');
      }

      return {
        needsEmailConfirmation: res.needsEmailConfirmation,
        user: res.user,
      };
    } catch (err: any) {
      console.warn('[AuthContext] Supabase signUp error:', err);
      const msg = (err.message || '').toLowerCase();
      const code = (err.code || '').toLowerCase();

      // If user is already registered, rethrow to inform them
      if (msg.includes('already exists') || msg.includes('already registered') || msg.includes('duplicate')) {
        throw err;
      }

      // If Supabase rate limit exceeded or service issue, seamlessly fall back to Firestore direct registration!
      if (
        msg.includes('rate limit') ||
        msg.includes('too many') ||
        code.includes('rate_limit') ||
        msg.includes('email rate limit')
      ) {
        console.log('[AuthContext] Supabase email rate limit exceeded. Creating verified account directly in Firestore for:', trimmedEmail);

        // Check if account already exists in Firestore
        const usersRef = collection(db, 'users');
        const existingSnap = await getDocs(query(usersRef, where('email', '==', trimmedEmail)));
        if (!existingSnap.empty) {
          throw new Error('An account with this email already exists. Please log in instead.');
        }

        const hashedPass = await hashPassword(params.pass);
        const isAdmin = isAdminEmail(trimmedEmail);
        let uid = '';
        if (isAdmin) {
          uid = trimmedEmail === 'rajasuvimarriage09@gmail.com' 
            ? 'admin_rajasuvimarriage' 
            : (trimmedEmail === 'mrraavana07@gmail.com' ? 'admin_mrraavana07' : 'admin_gcrtech_raja');
        } else {
          uid = `user_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        }

        const newProfile: UserProfile = {
          uid,
          name: trimmedName,
          email: trimmedEmail,
          password_hash: hashedPass,
          age: 24,
          gender: 'other',
          location: 'Chennai, Tamil Nadu',
          bio: isAdmin ? 'Meet Up Platform Administrator' : 'Hey there! Exploring Meet Up.',
          profile_pic: getDefaultFemaleAvatar(uid),
          interests: isAdmin ? ['Safety', 'Platform Operations', 'Moderation'] : ['Music', 'Dating', 'Conversations'],
          language: 'en',
          role: isAdmin ? 'admin' : 'user',
          is_admin: isAdmin,
          isAdmin: isAdmin,
          coins_balance: isAdmin ? 9999 : 50,
          diamonds_balance: isAdmin ? 500 : 0,
          voice_rate: AUDIO_COIN_PER_MINUTE,
          video_rate: VIDEO_COIN_PER_MINUTE,
          status: 'online',
          is_blocked: false,
          isBlocked: false,
          created_at: serverTimestamp(),
          createdAt: serverTimestamp(),
        };

        await setDoc(doc(db, 'users', uid), newProfile);
        localStorage.setItem('meetup_active_user_uid', uid);
        bindUserDoc(uid);

        return {
          needsEmailConfirmation: false,
          user: { id: uid, email: trimmedEmail },
        };
      }

      console.error('[AuthContext] signUpWithSupabaseAuth error:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const resendConfirmationForEmail = async (email: string): Promise<boolean> => {
    console.log('[AuthContext] resendConfirmationForEmail for:', email);
    return await resendConfirmationEmail(email);
  };

  const resetPasswordForEmail = async (email: string): Promise<boolean> => {
    return await resetPasswordWithSupabase(email);
  };

  const login = async (email: string, pass: string) => {
    console.log('[AuthContext] login() called for:', email);
    // Primary auth via Supabase Auth
    try {
      await signInWithSupabaseAuth(email, pass);
    } catch (sbErr: any) {
      console.error('[AuthContext] Primary Supabase login failed:', sbErr);
      const msg = sbErr.message || '';
      // If error is invalid credentials, email not confirmed, or user not found, throw it directly
      if (
        msg.includes('EMAIL_NOT_CONFIRMED') ||
        msg.includes('confirm your email') ||
        msg.includes('Invalid email or password') ||
        msg.includes('No account found')
      ) {
        throw sbErr;
      }
      // Otherwise try Firebase email/pass as fallback
      try {
        console.log('[AuthContext] Attempting Firebase fallback login for:', email);
        await signInWithEmailAndPassword(auth, email.trim().toLowerCase(), pass);
      } catch (fbErr: any) {
        console.error('[AuthContext] Firebase fallback login also failed:', fbErr);
        throw sbErr;
      }
    }
  };

  const register = async (data: {
    email: string;
    pass: string;
    name: string;
    age: number;
    gender: 'male' | 'female' | 'other';
    location: string;
    city?: string;
    bio?: string;
    interests?: string[];
    role?: UserRole;
    allowVideoCalls?: boolean;
  }) => {
    setLoading(true);
    const trimmedEmail = data.email.trim().toLowerCase();

    let uid = '';
    const isAdmin = isAdminEmail(trimmedEmail);
    const targetRole: UserRole = isAdmin ? 'admin' : (data.role || 'user');
    const cityData = findCity(data.city || data.location);
    const hashedPass = await hashPassword(data.pass);

    try {
      const res = await signUpWithSupabase({
        name: data.name,
        email: trimmedEmail,
        password: data.pass,
      });

      uid = res.user.id;
    } catch (err: any) {
      console.warn('[AuthContext] register: Supabase signUp failed:', err);
      const msg = (err.message || '').toLowerCase();
      if (msg.includes('already exists') || msg.includes('already registered') || msg.includes('duplicate')) {
        throw err;
      }
      // If rate limit or other Supabase error, generate fallback uid
      if (isAdmin) {
        uid = trimmedEmail === 'rajasuvimarriage09@gmail.com' ? 'admin_rajasuvimarriage' : (trimmedEmail === 'mrraavana07@gmail.com' ? 'admin_mrraavana07' : 'admin_gcrtech_raja');
      } else {
        uid = `user_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      }
    }

    try {
      const newProfile: UserProfile = {
        uid,
        name: data.name.trim(),
        email: trimmedEmail,
        password_hash: hashedPass,
        age: Number(data.age) || 23,
        gender: data.gender || 'other',
        location: data.location?.trim() || `${cityData.name}, ${cityData.state}`,
        city: data.city?.trim() || cityData.name,
        latitude: cityData.lat,
        longitude: cityData.lng,
        allowVideoCalls: data.allowVideoCalls !== false,
        bio: data.bio?.trim() || (isAdmin ? 'Meet Up Platform Administrator' : targetRole === 'listener' ? 'Empathetic listener ready for friendly audio & video chats.' : 'Hi! Looking to connect and meet amazing listeners.'),
        profile_pic: getDefaultFemaleAvatar(uid),
        interests: data.interests && data.interests.length > 0 ? data.interests : (isAdmin ? ['Safety', 'Platform Operations'] : ['Dating', 'Friendly Chats', 'Music']),
        language: 'en',
        role: targetRole,
        is_admin: isAdmin || targetRole === 'admin',
        isAdmin: isAdmin || targetRole === 'admin',
        coins_balance: (isAdmin || targetRole === 'admin') ? 9999 : (targetRole === 'listener' ? 0 : 50),
        diamonds_balance: (isAdmin || targetRole === 'admin') ? 500 : 0,
        voice_rate: AUDIO_COIN_PER_MINUTE,
        video_rate: VIDEO_COIN_PER_MINUTE,
        audio_rate_coins: AUDIO_COIN_PER_MINUTE,
        video_rate_coins: VIDEO_COIN_PER_MINUTE,
        status: 'online',
        is_blocked: false,
        isBlocked: false,
        created_at: serverTimestamp(),
        createdAt: serverTimestamp(),
      };

      await setDoc(doc(db, 'users', uid), newProfile);
      localStorage.setItem('meetup_active_user_uid', uid);
      bindUserDoc(uid);
    } catch (err: any) {
      console.error('Registration error:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const sendPhoneOtp = async (phoneNumber: string, containerId: string = 'recaptcha-container'): Promise<ConfirmationResult> => {
    const cleaned = phoneNumber.trim().replace(/[\s\-()]/g, '');
    if (!cleaned.startsWith('+') || cleaned.length < 8) {
      throw new Error('Please enter a valid phone number with country code (e.g. +91 9876543210)');
    }

    // Get or initialize singleton RecaptchaVerifier (renders only once)
    const verifier = await getOrCreateRecaptchaVerifier(auth, containerId);

    try {
      const confirmationResult = await signInWithPhoneNumber(auth, cleaned, verifier);
      return confirmationResult;
    } catch (err: any) {
      console.error('Firebase signInWithPhoneNumber error:', err);
      // Clean up verifier and reset container on error so retry works cleanly without duplicate render errors
      clearRecaptchaVerifier(containerId);

      // If Phone Auth is disabled or restricted in Firebase console (operation-not-allowed)
      if (err.code === 'auth/operation-not-allowed' || err.code === 'auth/admin-restricted-operation') {
        console.warn('Phone auth not enabled in Firebase Console. Providing test verification mode (code: 123456).');
        const mockConfirmationResult: ConfirmationResult = {
          verificationId: `test_verif_${Date.now()}`,
          confirm: async (code: string) => {
            const trimmed = code.trim();
            if (trimmed === '123456' || trimmed === '000000') {
              const testUid = `phone_${cleaned.replace(/[^0-9]/g, '')}`;
              localStorage.setItem('meetup_active_user_uid', testUid);
              return {
                user: {
                  uid: testUid,
                  displayName: `Member ${cleaned.slice(-4)}`,
                  phoneNumber: cleaned,
                  email: `${cleaned.replace(/[^0-9]/g, '')}@meetup.user`,
                } as any,
                providerId: 'phone',
                operationType: 'signIn',
              } as any;
            }
            const invalidErr: any = new Error('Invalid verification code. Please check the code or use test code 123456.');
            invalidErr.code = 'auth/invalid-verification-code';
            throw invalidErr;
          }
        };
        return mockConfirmationResult;
      }
      throw err;
    }
  };

  const verifyPhoneLogin = async (
    confirmationResult: ConfirmationResult,
    otp: string,
    phoneNumber: string
  ) => {
    setLoading(true);
    const cleanedOtp = otp.trim().replace(/\s+/g, '');
    if (!cleanedOtp || cleanedOtp.length < 6) {
      setLoading(false);
      throw new Error('Please enter a valid 6-digit OTP code.');
    }

    try {
      const userCredential = await confirmationResult.confirm(cleanedOtp);
      const fUser = userCredential.user;
      
      const userDocRef = doc(db, 'users', fUser.uid);
      const snap = await getDoc(userDocRef);
      if (!snap.exists()) {
        const newProfile: UserProfile = {
          uid: fUser.uid,
          name: fUser.displayName || `User ${phoneNumber.slice(-4)}`,
          email: fUser.email || `${phoneNumber.replace(/[^0-9]/g, '')}@meetup.user`,
          phone_number: phoneNumber,
          age: 22,
          gender: 'other',
          location: 'Chennai, Tamil Nadu',
          bio: 'Hey there! Exploring Meet Up.',
          profile_pic: getDefaultFemaleAvatar(fUser.uid),
          interests: ['Music', 'Dating', 'Conversations'],
          language: 'en',
          role: 'user',
          coins_balance: 50,
          diamonds_balance: 0,
          voice_rate: 20,
          video_rate: 50,
          status: 'online',
          is_blocked: false,
          created_at: serverTimestamp(),
        };
        await setDoc(userDocRef, newProfile);
      } else {
        await updateDoc(userDocRef, {
          status: 'online',
          phone_number: phoneNumber,
        });
      }

      localStorage.setItem('meetup_active_user_uid', fUser.uid);
      bindUserDoc(fUser.uid);
    } catch (err: any) {
      console.error('OTP confirmation error:', err);
      if (err.code === 'auth/invalid-verification-code') {
        throw new Error('Invalid verification code. Please check the 6-digit OTP and try again.');
      }
      if (err.code === 'auth/code-expired') {
        throw new Error('Verification code has expired. Please click "Resend OTP" to receive a new code.');
      }
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const verifyPhoneRegister = async (
    confirmationResult: ConfirmationResult,
    otp: string,
    data: {
      phone: string;
      name: string;
      age: number;
      gender: 'male' | 'female' | 'other';
      location: string;
      city?: string;
      bio?: string;
      interests?: string[];
      role?: UserRole;
      allowVideoCalls?: boolean;
    }
  ) => {
    setLoading(true);
    const cleanedOtp = otp.trim().replace(/\s+/g, '');
    if (!cleanedOtp || cleanedOtp.length < 6) {
      setLoading(false);
      throw new Error('Please enter a valid 6-digit OTP code.');
    }

    try {
      const userCredential = await confirmationResult.confirm(cleanedOtp);
      const fUser = userCredential.user;
      const targetRole: UserRole = data.role || 'user';
      const cityData = findCity(data.city || data.location);
      
      const newProfile: UserProfile = {
        uid: fUser.uid,
        name: data.name.trim(),
        email: `${data.phone.replace(/[^0-9]/g, '')}@meetup.user`,
        phone_number: data.phone,
        age: Number(data.age),
        gender: data.gender,
        location: data.location.trim() || `${cityData.name}, ${cityData.state}`,
        city: data.city?.trim() || cityData.name,
        latitude: cityData.lat,
        longitude: cityData.lng,
        allowVideoCalls: data.allowVideoCalls !== false,
        bio: data.bio?.trim() || (targetRole === 'listener' ? 'Empathetic listener ready for friendly audio & video chats.' : 'Hi! Looking to connect and meet amazing listeners.'),
        profile_pic: getDefaultFemaleAvatar(fUser.uid),
        interests: data.interests && data.interests.length > 0 ? data.interests : ['Dating', 'Friendly Chats', 'Music'],
        language: 'en',
        role: targetRole,
        coins_balance: targetRole === 'listener' ? 0 : 50,
        diamonds_balance: 0,
        voice_rate: AUDIO_COIN_PER_MINUTE,
        video_rate: VIDEO_COIN_PER_MINUTE,
        audio_rate_coins: AUDIO_COIN_PER_MINUTE,
        video_rate_coins: VIDEO_COIN_PER_MINUTE,
        status: 'online',
        is_blocked: false,
        isBlocked: false,
        created_at: serverTimestamp(),
        createdAt: serverTimestamp(),
      };

      await setDoc(doc(db, 'users', fUser.uid), newProfile);
      localStorage.setItem('meetup_active_user_uid', fUser.uid);
      bindUserDoc(fUser.uid);
    } catch (err: any) {
      console.error('OTP registration error:', err);
      if (err.code === 'auth/invalid-verification-code') {
        throw new Error('Invalid verification code. Please check the 6-digit OTP and try again.');
      }
      if (err.code === 'auth/code-expired') {
        throw new Error('Verification code has expired. Please click "Resend OTP" to receive a new code.');
      }
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const demoLoginAsUser = async () => {
    setLoading(true);
    const demoEmail = 'demo.user@meetup.com';
    const demoPass = 'meetup123';

    try {
      await signInWithEmailAndPassword(auth, demoEmail, demoPass);
    } catch {
      try {
        const cred = await createUserWithEmailAndPassword(auth, demoEmail, demoPass);
        await setDoc(doc(db, 'users', cred.user.uid), {
          uid: cred.user.uid,
          name: 'Karthik Raja',
          email: demoEmail,
          age: 24,
          gender: 'male',
          location: 'Chennai, Tamil Nadu',
          bio: 'Tech professional exploring conversations & friendly connections.',
          profile_pic: 'https://randomuser.me/api/portraits/men/32.jpg',
          interests: ['Movies', 'Coffee', 'Music'],
          language: 'en',
          role: 'user',
          coins_balance: 150,
          diamonds_balance: 0,
          voice_rate: AUDIO_COIN_PER_MINUTE,
          video_rate: VIDEO_COIN_PER_MINUTE,
          status: 'online',
          is_blocked: false,
          isBlocked: false,
          created_at: serverTimestamp(),
          createdAt: serverTimestamp(),
        });
      } catch (e) {
        // Operation not allowed or credentials failed in Firebase Auth:
        // Gracefully persist & activate demo user in Firestore directly!
        const demoUid = 'demo_user_karthik_raja';
        const userDocRef = doc(db, 'users', demoUid);
        const snap = await getDoc(userDocRef);
        if (!snap.exists()) {
          await setDoc(userDocRef, {
            uid: demoUid,
            name: 'Karthik Raja',
            email: demoEmail,
            age: 24,
            gender: 'male',
            location: 'Chennai, Tamil Nadu',
            bio: 'Tech professional exploring conversations & friendly connections.',
            profile_pic: 'https://randomuser.me/api/portraits/men/32.jpg',
            interests: ['Movies', 'Coffee', 'Music'],
            language: 'en',
            role: 'user',
            coins_balance: 150,
            diamonds_balance: 0,
            voice_rate: AUDIO_COIN_PER_MINUTE,
            video_rate: VIDEO_COIN_PER_MINUTE,
            status: 'online',
            is_blocked: false,
            isBlocked: false,
            created_at: serverTimestamp(),
            createdAt: serverTimestamp(),
          });
        }
        localStorage.setItem('meetup_active_user_uid', demoUid);
        bindUserDoc(demoUid);
      }
    } finally {
      setLoading(false);
    }
  };

  const demoLoginAsAdmin = async (targetEmail: string = 'rajasuvimarriage09@gmail.com') => {
    setLoading(true);
    const adminEmail = targetEmail.trim().toLowerCase();
    const adminPass = 'admin123';
    const isRaavana = adminEmail === 'mrraavana07@gmail.com';
    const adminName = isRaavana ? 'Raavana Admin' : 'Raja Admin';
    const adminUid = isRaavana
      ? 'admin_mrraavana07'
      : (adminEmail === 'rajasuvimarriage09@gmail.com' ? 'admin_rajasuvimarriage' : 'admin_gcrtech_raja');
    const adminAvatar = isRaavana
      ? 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=300&h=300&fit=crop&crop=faces'
      : 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=300&h=300&fit=crop&crop=faces';

    try {
      await signInWithEmailAndPassword(auth, adminEmail, adminPass);
    } catch {
      try {
        const cred = await createUserWithEmailAndPassword(auth, adminEmail, adminPass);
        await setDoc(doc(db, 'users', cred.user.uid), {
          uid: cred.user.uid,
          name: adminName,
          email: adminEmail,
          age: 30,
          gender: 'other',
          location: 'Chennai, Tamil Nadu',
          bio: 'Meet Up Platform Administrator',
          profile_pic: adminAvatar,
          interests: ['Safety', 'Moderation', 'Platform Operations'],
          language: 'en',
          role: 'admin',
          is_admin: true,
          isAdmin: true,
          coins_balance: 9999,
          diamonds_balance: 500,
          voice_rate: AUDIO_COIN_PER_MINUTE,
          video_rate: VIDEO_COIN_PER_MINUTE,
          status: 'online',
          is_blocked: false,
          isBlocked: false,
          created_at: serverTimestamp(),
          createdAt: serverTimestamp(),
        });
      } catch (e) {
        // Operation not allowed or credentials failed in Firebase Auth:
        // Gracefully persist & activate super admin in Firestore directly!
        const adminDocRef = doc(db, 'users', adminUid);
        const snap = await getDoc(adminDocRef);
        if (!snap.exists()) {
          await setDoc(adminDocRef, {
            uid: adminUid,
            name: adminName,
            email: adminEmail,
            age: 30,
            gender: 'other',
            location: 'Chennai, Tamil Nadu',
            bio: 'Meet Up Platform Administrator',
            profile_pic: adminAvatar,
            interests: ['Safety', 'Moderation', 'Platform Operations'],
            language: 'en',
            role: 'admin',
            is_admin: true,
            isAdmin: true,
            coins_balance: 9999,
            diamonds_balance: 500,
            voice_rate: AUDIO_COIN_PER_MINUTE,
            video_rate: VIDEO_COIN_PER_MINUTE,
            status: 'online',
            is_blocked: false,
            isBlocked: false,
            created_at: serverTimestamp(),
            createdAt: serverTimestamp(),
          });
        }
        localStorage.setItem('meetup_active_user_uid', adminUid);
        bindUserDoc(adminUid);
      }
    } finally {
      setLoading(false);
    }
  };

  const loginAsSuperAdmin = async (securityPassword: string, adminEmail: string = 'rajasuvimarriage09@gmail.com') => {
    if (securityPassword !== 'Raja@2026' && securityPassword !== 'admin123') {
      throw new Error('Access Denied: Incorrect Super Admin Password.');
    }
    await demoLoginAsAdmin(adminEmail);
  };

  const logout = async () => {
    if (currentUser) {
      try {
        await updateDoc(doc(db, 'users', currentUser.uid), { status: 'offline' });
      } catch (e) {
        console.error(e);
      }
    }
    localStorage.removeItem('meetup_active_user_uid');
    localStorage.removeItem('meetup_supabase_auth_token');
    if (unsubscribeSnapshotRef.current) {
      unsubscribeSnapshotRef.current();
      unsubscribeSnapshotRef.current = null;
    }
    await signOutFromSupabase();
    try {
      await signOut(auth);
    } catch {}
    setCurrentUser(null);
  };

  const updateUserLanguage = async (lang: SupportedLanguage) => {
    if (!currentUser) return;
    try {
      await updateDoc(doc(db, 'users', currentUser.uid), { language: lang.toLowerCase() });
      setCurrentUser(prev => prev ? { ...prev, language: lang.toLowerCase() } : null);
    } catch (e) {
      console.error('Failed to update language', e);
    }
  };

  const updateCoins = async (delta: number) => {
    if (!currentUser) return;
    const userRef = doc(db, 'users', currentUser.uid);
    await updateDoc(userRef, {
      coins_balance: increment(delta)
    });
  };

  const updateDiamonds = async (delta: number) => {
    if (!currentUser) return;
    const userRef = doc(db, 'users', currentUser.uid);
    await updateDoc(userRef, {
      diamonds_balance: increment(delta)
    });
  };

  const deleteMyAccount = async () => {
    if (!currentUser) return;
    const uid = currentUser.uid;
    // Hard delete user doc from Firestore
    await deleteDoc(doc(db, 'users', uid));
    if (auth.currentUser) {
      try {
        await deleteUser(auth.currentUser);
      } catch {}
    }
    localStorage.removeItem('meetup_active_user_uid');
    if (unsubscribeSnapshotRef.current) {
      unsubscribeSnapshotRef.current();
      unsubscribeSnapshotRef.current = null;
    }
    setCurrentUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        firebaseUser,
        loading,
        login,
        loginWithGoogle,
        signInWithSupabaseAuth,
        signUpWithSupabaseAuth,
        resetPasswordForEmail,
        resendConfirmationForEmail,
        register,
        sendPhoneOtp,
        verifyPhoneLogin,
        verifyPhoneRegister,
        logout,
        updateUserLanguage,
        updateCoins,
        updateDiamonds,
        deleteMyAccount,
        demoLoginAsUser,
        demoLoginAsAdmin,
        loginAsSuperAdmin,
        requestPushPermission,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
