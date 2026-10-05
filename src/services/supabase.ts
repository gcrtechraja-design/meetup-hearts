import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { UserProfile } from '../types';
import { isAdminEmail } from '../utils/admin';

// Default Supabase config with localStorage override support
const STORAGE_KEY_URL = 'meetup_supabase_url';
const STORAGE_KEY_KEY = 'meetup_supabase_key';

export const DEFAULT_SUPABASE_URL = 'https://szzbcsaucwfwxbmvazqe.supabase.co';
export const DEFAULT_SUPABASE_ANON_KEY = 'sb_publishable_TA6rW7sEi0G3PtZDza2fDw_6luoEit-';

/**
 * Sanitizes a Supabase URL to ensure it is the clean base origin
 * (removes accidental /rest/v1 or /auth/v1 or trailing slashes).
 */
export const cleanSupabaseUrl = (rawUrl: string): string => {
  if (!rawUrl) return '';
  let cleaned = rawUrl.trim();
  cleaned = cleaned.replace(/\/rest\/v1\/?$/i, '');
  cleaned = cleaned.replace(/\/auth\/v1\/?$/i, '');
  cleaned = cleaned.replace(/\/+$/, '');
  return cleaned;
};

// Read from env (VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, SUPABASE_URL, SUPABASE_ANON_KEY) or localStorage
export const getSupabaseCredentials = () => {
  let customUrl = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY_URL) : null;
  let customKey = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY_KEY) : null;

  // Clear outdated dummy / placeholder credentials from previous versions
  if (customUrl && (customUrl.includes('xyzcompany') || customUrl.includes('placeholder'))) {
    customUrl = null;
    if (typeof window !== 'undefined') localStorage.removeItem(STORAGE_KEY_URL);
  }
  if (customKey && (customKey.includes('dummy_anon_key') || customKey.includes('placeholder'))) {
    customKey = null;
    if (typeof window !== 'undefined') localStorage.removeItem(STORAGE_KEY_KEY);
  }

  const envUrl =
    (import.meta as any).env?.VITE_SUPABASE_URL ||
    (import.meta as any).env?.SUPABASE_URL ||
    (typeof process !== 'undefined' ? process.env?.VITE_SUPABASE_URL || process.env?.SUPABASE_URL : '');

  const envKey =
    (import.meta as any).env?.VITE_SUPABASE_ANON_KEY ||
    (import.meta as any).env?.SUPABASE_ANON_KEY ||
    (typeof process !== 'undefined' ? process.env?.VITE_SUPABASE_ANON_KEY || process.env?.SUPABASE_ANON_KEY : '');

  const rawUrl = (customUrl || envUrl || DEFAULT_SUPABASE_URL).trim();
  const rawKey = (customKey || envKey || DEFAULT_SUPABASE_ANON_KEY).trim();

  const url = cleanSupabaseUrl(rawUrl);
  const key = rawKey;

  // Cache to localStorage if not yet cached
  if (typeof window !== 'undefined' && !customUrl) {
    try {
      localStorage.setItem(STORAGE_KEY_URL, url);
      localStorage.setItem(STORAGE_KEY_KEY, key);
    } catch {}
  }

  const isConfigured = true;

  return { url, key, isConfigured };
};

let cachedClient: SupabaseClient | null = null;
let lastUrl = '';
let lastKey = '';

export const getSupabaseClient = (): SupabaseClient => {
  const { url, key } = getSupabaseCredentials();
  if (!cachedClient || lastUrl !== url || lastKey !== key) {
    lastUrl = url;
    lastKey = key;
    console.log('[Supabase Client] Initializing client with base URL:', url);
    cachedClient = createClient(url, key, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storageKey: 'meetup_supabase_auth_token',
      },
      realtime: { params: { eventsPerSecond: 10 } }
    });
  }
  return cachedClient;
};

export const setSupabaseCredentials = (url: string, key: string) => {
  if (typeof window === 'undefined') return;
  if (!url || !key) {
    localStorage.removeItem(STORAGE_KEY_URL);
    localStorage.removeItem(STORAGE_KEY_KEY);
  } else {
    const cleaned = cleanSupabaseUrl(url);
    localStorage.setItem(STORAGE_KEY_URL, cleaned);
    localStorage.setItem(STORAGE_KEY_KEY, key.trim());
  }
  cachedClient = null;
};

/**
 * Supabase Auth: Sign Up with email & password
 * Creates auth user and optionally initializes record in 'profiles' table if session is active.
 */
export const signUpWithSupabase = async (params: {
  name: string;
  email: string;
  password: string;
}) => {
  const supabase = getSupabaseClient();
  const trimmedEmail = params.email.trim().toLowerCase();
  const trimmedName = params.name.trim();

  console.log('[Supabase Auth] Attempting signUp for:', trimmedEmail);

  // 1. Sign up user via Supabase Auth
  const { data, error } = await supabase.auth.signUp({
    email: trimmedEmail,
    password: params.password,
    options: {
      data: {
        name: trimmedName,
        full_name: trimmedName,
      },
    },
  });

  if (error) {
    console.error('[Supabase Auth] signUp error response:', error);
    const msg = (error.message || '').toLowerCase();
    if (msg.includes('already registered') || msg.includes('already exists') || msg.includes('duplicate')) {
      throw new Error('An account with this email already exists. Please log in instead.');
    }
    if (msg.includes('password') && (msg.includes('short') || msg.includes('least 6'))) {
      throw new Error('Password must be at least 6 characters long.');
    }
    if (msg.includes('rate limit') || msg.includes('too many requests')) {
      throw new Error('Too many sign-up attempts. Please wait a few moments and try again.');
    }
    throw new Error(error.message || 'Failed to create account. Please try again.');
  }

  // Check if email already existed (Supabase returns empty identities array when user already exists)
  if (data.user?.identities && data.user.identities.length === 0) {
    console.warn('[Supabase Auth] User identity array is empty (user exists):', trimmedEmail);
    throw new Error('An account with this email already exists. Please log in instead.');
  }

  const user = data.user;
  if (!user) {
    console.error('[Supabase Auth] No user returned from signUp');
    throw new Error('Registration failed: no user returned from server.');
  }

  const needsEmailConfirmation = !data.session;
  console.log('[Supabase Auth] signUp success:', {
    userId: user.id,
    email: user.email,
    hasSession: !!data.session,
    needsEmailConfirmation,
  });

  // 2. Create user profile in 'profiles' table ONLY if user has an active session
  // If email confirmation is required, the user has no session yet and RLS will block inserts.
  if (data.session) {
    const isAdmin = isAdminEmail(trimmedEmail);
    try {
      const profilePayloadWithAdmin: Record<string, any> = {
        id: user.id,
        name: trimmedName,
        email: trimmedEmail,
        role: isAdmin ? 'admin' : 'user',
        is_admin: isAdmin,
        created_at: new Date().toISOString(),
      };
      const { error: profileError } = await supabase
        .from('profiles')
        .upsert(profilePayloadWithAdmin, { onConflict: 'id' });

      if (profileError) {
        console.warn('[Supabase Profiles] Warning on initial insert with role:', profileError.message);
        // Fallback in case 'role' or 'is_admin' columns are not present in Supabase table
        await supabase
          .from('profiles')
          .upsert({
            id: user.id,
            name: trimmedName,
            email: trimmedEmail,
            created_at: new Date().toISOString(),
          }, { onConflict: 'id' });
      }
    } catch (err) {
      console.warn('[Supabase Profiles] Profile insert warning:', err);
    }

    // Also sync to users table if available
    try {
      await supabase.from('users').upsert({
        id: user.id,
        uid: user.id,
        name: trimmedName,
        email: trimmedEmail,
        role: isAdmin ? 'admin' : 'user',
        is_admin: isAdmin,
        coins_balance: isAdmin ? 9999 : 50,
        created_at: new Date().toISOString(),
      }, { onConflict: 'uid' });
    } catch {}
  }

  return {
    user,
    session: data.session,
    needsEmailConfirmation,
  };
};

/**
 * Supabase Auth: Sign In with email & password
 */
export const signInWithSupabase = async (email: string, pass: string) => {
  const { isConfigured } = getSupabaseCredentials();
  if (!isConfigured) {
    throw new Error('SUPABASE_NOT_CONFIGURED');
  }

  const supabase = getSupabaseClient();
  const trimmedEmail = email.trim().toLowerCase();

  console.log('[Supabase Auth] Attempting signInWithPassword for:', trimmedEmail);

  const { data, error } = await supabase.auth.signInWithPassword({
    email: trimmedEmail,
    password: pass,
  });

  if (error) {
    console.error('[Supabase Auth] signInWithPassword error response:', {
      message: error.message,
      status: error.status,
      code: (error as any).code,
    });

    const msg = (error.message || '').toLowerCase();
    const code = ((error as any).code || '').toLowerCase();

    if (code === 'email_not_confirmed' || msg.includes('email not confirmed')) {
      throw new Error('EMAIL_NOT_CONFIRMED: Please confirm your email address before logging in. Check your inbox and spam folder.');
    }
    if (
      msg.includes('invalid login credentials') ||
      msg.includes('invalid credentials') ||
      msg.includes('invalid_grant') ||
      msg.includes('wrong password') ||
      code === 'invalid_credentials'
    ) {
      throw new Error('Invalid email or password. Please check your credentials and try again.');
    }
    if (msg.includes('user not found') || msg.includes('no user')) {
      throw new Error('No account found with this email. Please create an account.');
    }
    if (msg.includes('rate limit') || msg.includes('too many requests')) {
      throw new Error('Too many login attempts. Please wait a few moments and try again.');
    }
    throw new Error(error.message || 'Login failed. Please check your credentials.');
  }

  if (!data.user) {
    console.error('[Supabase Auth] No user returned from signIn');
    throw new Error('Login failed: no user returned.');
  }

  console.log('[Supabase Auth] signInWithPassword success for user:', data.user.id);

  // When admin logs in, automatically ensure role = 'admin' and is_admin = true in profiles table
  if (isAdminEmail(data.user.email)) {
    try {
      await supabase
        .from('profiles')
        .update({ role: 'admin', is_admin: true })
        .eq('id', data.user.id);
    } catch (e) {
      console.warn('[Supabase Profiles] Admin role update notice:', e);
    }
    try {
      await supabase
        .from('users')
        .update({ role: 'admin', is_admin: true, coins_balance: 9999 })
        .eq('uid', data.user.id);
    } catch {}
  }

  return {
    user: data.user,
    session: data.session,
  };
};

/**
 * Supabase Auth: Resend Email Confirmation Link
 */
export const resendConfirmationEmail = async (email: string): Promise<boolean> => {
  const supabase = getSupabaseClient();
  const trimmedEmail = email.trim().toLowerCase();
  console.log('[Supabase Auth] Resending confirmation email for:', trimmedEmail);

  const { error } = await supabase.auth.resend({
    type: 'signup',
    email: trimmedEmail,
  });

  if (error) {
    console.error('[Supabase Auth] resend confirmation error:', error);
    throw new Error(error.message || 'Failed to resend confirmation email.');
  }

  return true;
};

/**
 * Supabase Auth: Send Password Reset Email
 */
export const resetPasswordWithSupabase = async (email: string) => {
  const supabase = getSupabaseClient();
  const trimmedEmail = email.trim().toLowerCase();

  const { error } = await supabase.auth.resetPasswordForEmail(trimmedEmail, {
    redirectTo: typeof window !== 'undefined' ? `${window.location.origin}/login` : undefined,
  });

  if (error) {
    throw new Error(error.message || 'Failed to send password reset email.');
  }

  return true;
};

/**
 * Supabase Auth: Sign Out
 */
export const signOutFromSupabase = async () => {
  try {
    const supabase = getSupabaseClient();
    await supabase.auth.signOut();
  } catch (err) {
    console.warn('[Supabase Auth] SignOut warning:', err);
  }
};

/**
 * Supabase Auth: Fetch profile from 'profiles' table
 */
export const fetchSupabaseProfile = async (userId: string) => {
  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (error) throw error;
    return data;
  } catch (err) {
    console.warn('[Supabase Profiles] Fetch error:', err);
    return null;
  }
};

/**
 * Updates user preferences in the Supabase 'profiles' and 'users' table
 */
export const updateSupabaseProfilePreference = async (
  userId: string,
  preference: { background_call_notify?: boolean; [key: string]: any }
) => {
  try {
    const supabase = getSupabaseClient();
    await supabase.from('profiles').update(preference).eq('id', userId);
  } catch (err) {
    console.warn('[Supabase Profiles] update preference notice:', err);
  }

  try {
    const supabase = getSupabaseClient();
    await supabase.from('users').update(preference).eq('uid', userId);
  } catch (err) {
    console.warn('[Supabase Users] update preference notice:', err);
  }
};

/**
 * Uploads a user photo to the Supabase Storage 'photos' bucket
 * and returns the public URL.
 *
 * @param file The file or blob to upload
 * @param userId Unique user ID for folder partitioning
 * @returns Public URL of the uploaded photo in Supabase Storage
 */
export const uploadPhotoToSupabase = async (file: File | Blob, userId?: string): Promise<string> => {
  const supabase = getSupabaseClient();
  const { isConfigured } = getSupabaseCredentials();

  if (!isConfigured) {
    const configError = 'Supabase is not configured. Please verify your Supabase credentials.';
    try {
      if (typeof window !== 'undefined' && typeof window.alert === 'function') {
        window.alert(configError);
      }
    } catch {}
    throw new Error(configError);
  }

  // Determine file extension
  let ext = 'jpg';
  if (file instanceof File && file.name) {
    const parts = file.name.split('.');
    if (parts.length > 1) {
      ext = parts.pop()?.toLowerCase() || 'jpg';
    }
  } else if (file.type) {
    const sub = file.type.split('/')[1];
    if (sub) ext = sub.replace('+xml', '');
  }
  const cleanExt = ext.replace(/[^a-z0-9]/g, '') || 'jpg';

  const userFolder = userId ? `user_${userId.replace(/[^a-zA-Z0-9_-]/g, '_')}` : 'members';
  const timestamp = Date.now();
  const randomStr = Math.random().toString(36).substring(2, 8);
  const fileName = `${timestamp}_${randomStr}.${cleanExt}`;
  const filePath = `${userFolder}/${fileName}`;
  const contentType = file.type || (cleanExt === 'png' ? 'image/png' : cleanExt === 'webp' ? 'image/webp' : 'image/jpeg');

  // 1. Console.log before upload
  console.log('[Supabase Storage] BEFORE upload:', {
    bucket: 'photos',
    filePath,
    contentType,
    fileSize: file.size,
    userId,
  });

  let uploadResultData: any = null;

  // 2. Wrap upload in try/catch and show actual error with alert(error.message)
  // 5. Add a 15 second timeout
  try {
    const uploadPromise = (async () => {
      const { data, error } = await supabase.storage
        .from('photos')
        .upload(filePath, file, {
          contentType,
          upsert: true,
          cacheControl: '3600',
        });

      if (error) {
        throw error;
      }
      return data;
    })();

    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new Error('Photo upload timed out after 15 seconds. Please check your network connection.'));
      }, 15000);
    });

    uploadResultData = await Promise.race([uploadPromise, timeoutPromise]);

    // 1. Console.log after upload
    console.log('[Supabase Storage] AFTER upload SUCCESS:', uploadResultData);
  } catch (error: any) {
    // 1. Console.log after upload on error
    console.error('[Supabase Storage] AFTER upload ERROR:', error);
    const errorMessage = error?.message || 'Failed to upload photo to Supabase Storage.';
    try {
      if (typeof window !== 'undefined' && typeof window.alert === 'function') {
        window.alert(errorMessage);
      }
    } catch {}
    throw new Error(errorMessage);
  }

  // 3. After upload, use supabase.storage.from('photos').getPublicUrl() to get URL
  console.log('[Supabase Storage] Fetching getPublicUrl for path:', uploadResultData?.path || filePath);
  const { data: publicUrlData } = supabase.storage
    .from('photos')
    .getPublicUrl(uploadResultData?.path || filePath);

  const publicUrl = publicUrlData?.publicUrl || '';
  if (!publicUrl) {
    const urlErr = 'Failed to retrieve public URL from Supabase Storage.';
    try {
      if (typeof window !== 'undefined' && typeof window.alert === 'function') {
        window.alert(urlErr);
      }
    } catch {}
    throw new Error(urlErr);
  }
  console.log('[Supabase Storage] getPublicUrl SUCCESS:', publicUrl);

  // 4. For profiles table update, wrap in separate try/catch - if it fails, still show the photo, don't hang
  if (userId) {
    try {
      console.log('[Supabase Profiles] Updating profiles table avatar_url for user:', userId);
      const { error: profErr } = await supabase
        .from('profiles')
        .update({
          avatar_url: publicUrl,
          photo_url: publicUrl,
        })
        .eq('id', userId);

      if (profErr) {
        console.warn('[Supabase Profiles] Retrying profile update with photo_url:', profErr.message);
        await supabase
          .from('profiles')
          .update({
            photo_url: publicUrl,
          })
          .eq('id', userId);
      }
      console.log('[Supabase Profiles] profiles table updated successfully');
    } catch (profileUpdateErr) {
      // If it fails, still show the photo, don't hang
      console.warn('[Supabase Profiles] Profiles table update failed (non-blocking):', profileUpdateErr);
    }

    try {
      await supabase
        .from('users')
        .update({
          avatar_url: publicUrl,
          profile_pic: publicUrl,
        })
        .eq('uid', userId);
    } catch (usersErr) {
      console.warn('[Supabase Users] Users table update notice (non-blocking):', usersErr);
    }
  }

  return publicUrl;
};

/**
 * Helper to delete a photo from the 'photos' bucket if needed
 */
export const deletePhotoFromSupabase = async (photoUrlOrPath: string): Promise<boolean> => {
  try {
    const supabase = getSupabaseClient();
    let relativePath = photoUrlOrPath;
    if (photoUrlOrPath.includes('/photos/')) {
      relativePath = photoUrlOrPath.split('/photos/')[1];
    }
    const { error } = await supabase.storage.from('photos').remove([relativePath]);
    if (error) {
      console.warn('[Supabase Storage] Could not remove old photo:', error.message);
      return false;
    }
    return true;
  } catch {
    return false;
  }
};

// SQL Schema for Supabase SQL Editor
export const SUPABASE_SQL_SCHEMA = `-- MEET UP SUPABASE SCHEMA
-- Run this in your Supabase SQL Editor:

-- 1. Create profiles table (synced with auth)
create table if not exists public.profiles (
  id uuid primary key references auth.users on delete cascade,
  name text,
  email text,
  role text default 'user',
  is_admin boolean default false,
  created_at timestamp with time zone default timezone('utc'::text, now())
);
alter table public.profiles add column if not exists role text default 'user';
alter table public.profiles add column if not exists is_admin boolean default false;
alter table public.profiles add column if not exists background_call_notify boolean default true;

-- 2. Create users table
create table if not exists public.users (
  id text primary key,
  uid text unique not null,
  name text not null,
  email text,
  role text default 'user',
  background_call_notify boolean default true,
  coins_balance int default 0,
  avatar_url text,
  created_at timestamp with time zone default timezone('utc'::text, now())
);
alter table public.users add column if not exists background_call_notify boolean default true;

-- 2. Create rooms (meetings / calls) table
create table if not exists public.rooms (
  id text primary key,
  room_id text unique not null,
  caller_id text not null,
  caller_name text not null,
  callee_id text not null,
  callee_name text not null,
  call_type text default 'voice',
  status text default 'active', -- active, ended, muted
  is_muted boolean default false,
  started_at timestamp with time zone default timezone('utc'::text, now()),
  ended_at timestamp with time zone,
  duration int default 0
);

-- 3. Create messages table for realtime meeting & call chats
create table if not exists public.messages (
  id uuid default gen_random_uuid() primary key,
  room_id text not null,
  sender_id text not null,
  sender_name text not null,
  sender_role text default 'user',
  message text not null,
  created_at timestamp with time zone default timezone('utc'::text, now())
);

-- Enable Realtime on messages and rooms
alter publication supabase_realtime add table public.messages;
alter publication supabase_realtime add table public.rooms;
`;

// Sync User to Supabase
export const syncUserToSupabase = async (user: UserProfile) => {
  try {
    const supabase = getSupabaseClient();
    const { error } = await supabase.from('users').upsert({
      id: user.uid,
      uid: user.uid,
      name: user.name,
      email: user.email || '',
      role: user.role || 'user',
      coins_balance: user.coins_balance || 0,
      avatar_url: user.profile_pic || '',
      created_at: new Date().toISOString()
    }, { onConflict: 'uid' });

    if (error) {
      console.warn('Supabase syncUser warning:', error.message);
    }
  } catch (err) {
    // Non-blocking fallback
    console.warn('Supabase user sync error:', err);
  }
};

// Fetch all users from Supabase
export const fetchUsersFromSupabase = async () => {
  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase.from('users').select('*').order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  } catch (err) {
    console.warn('Failed fetching users from Supabase, returning empty array:', err);
    return [];
  }
};

// Fetch verified listeners from Supabase
export const fetchListenersFromSupabase = async (): Promise<UserProfile[]> => {
  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('role', 'listener')
      .order('created_at', { ascending: false });

    if (error) throw error;
    if (!data || data.length === 0) return [];

    return data.map((d: any) => ({
      uid: d.uid || d.id,
      name: d.name || 'Verified Listener',
      email: d.email || '',
      age: Number(d.age) || 23,
      gender: d.gender || 'female',
      location: d.location || 'Tamil Nadu, India',
      bio: d.bio || 'Friendly verified listener ready to chat.',
      profile_pic: d.avatar_url || d.profile_pic || 'https://randomuser.me/api/portraits/women/44.jpg',
      interests: Array.isArray(d.interests) ? d.interests : ['Music', 'Conversations'],
      language: d.language || 'ta',
      role: 'listener' as const,
      coins_balance: Number(d.coins_balance) || 120,
      diamonds_balance: Number(d.diamonds_balance) || 45,
      voice_rate: Number(d.voice_rate) || 10,
      video_rate: Number(d.video_rate) || 50,
      status: (d.status as any) || 'online',
      is_blocked: !!d.is_blocked,
      created_at: d.created_at || new Date().toISOString(),
    }));
  } catch (err) {
    console.warn('Could not fetch listeners from Supabase (falling back to Firestore):', err);
    return [];
  }
};

export interface RoomRecord {
  id: string;
  room_id: string;
  caller_id: string;
  caller_name: string;
  callee_id: string;
  callee_name: string;
  call_type: 'voice' | 'video';
  status: 'active' | 'ended' | 'muted';
  is_muted?: boolean;
  started_at?: string;
  ended_at?: string;
  duration?: number;
}

// Record active room
export const saveRoomToSupabase = async (room: RoomRecord) => {
  try {
    const supabase = getSupabaseClient();
    const { error } = await supabase.from('rooms').upsert({
      id: room.room_id,
      room_id: room.room_id,
      caller_id: room.caller_id,
      caller_name: room.caller_name,
      callee_id: room.callee_id,
      callee_name: room.callee_name,
      call_type: room.call_type,
      status: room.status,
      is_muted: room.is_muted || false,
      started_at: room.started_at || new Date().toISOString(),
    }, { onConflict: 'room_id' });

    if (error) console.warn('Supabase saveRoom error:', error.message);
  } catch (err) {
    console.warn('Supabase saveRoom exception:', err);
  }
};

// Update room (end meeting, mute, etc.)
export const updateRoomInSupabase = async (roomId: string, updates: Partial<RoomRecord>) => {
  try {
    const supabase = getSupabaseClient();
    const { error } = await supabase.from('rooms').update(updates).eq('room_id', roomId);
    if (error) console.warn('Supabase updateRoom error:', error.message);
  } catch (err) {
    console.warn('Supabase updateRoom exception:', err);
  }
};

// Fetch rooms
export const fetchRoomsFromSupabase = async () => {
  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase.from('rooms').select('*').order('started_at', { ascending: false });
    if (error) throw error;
    return (data as RoomRecord[]) || [];
  } catch (err) {
    console.warn('Failed fetching rooms from Supabase:', err);
    return [];
  }
};

export interface ChatMessageRecord {
  id?: string;
  room_id: string;
  sender_id: string;
  sender_name: string;
  sender_role: string;
  message: string;
  created_at?: string;
}

// Send chat message in Supabase
export const sendChatMessageToSupabase = async (msg: ChatMessageRecord) => {
  try {
    const supabase = getSupabaseClient();
    const { error } = await supabase.from('messages').insert({
      room_id: msg.room_id,
      sender_id: msg.sender_id,
      sender_name: msg.sender_name,
      sender_role: msg.sender_role,
      message: msg.message,
      created_at: new Date().toISOString()
    });
    if (error) console.warn('Supabase sendChatMessage error:', error.message);
  } catch (err) {
    console.warn('Supabase message send exception:', err);
  }
};

// Fetch chat messages for a room
export const fetchRoomMessagesFromSupabase = async (roomId: string) => {
  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('room_id', roomId)
      .order('created_at', { ascending: true });
    if (error) throw error;
    return (data as ChatMessageRecord[]) || [];
  } catch (err) {
    return [];
  }
};

// Realtime subscriber for chat messages
export const subscribeToRoomMessages = (
  roomId: string, 
  onNewMessage: (msg: ChatMessageRecord) => void
) => {
  const supabase = getSupabaseClient();
  const channel = supabase
    .channel(`room-chat-${roomId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `room_id=eq.${roomId}`
      },
      (payload) => {
        if (payload.new) {
          onNewMessage(payload.new as ChatMessageRecord);
        }
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
};

// Realtime subscriber for rooms
export const subscribeToRoomsRealtime = (onChange: () => void) => {
  const supabase = getSupabaseClient();
  const channel = supabase
    .channel('rooms-realtime')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'rooms'
      },
      () => {
        onChange();
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
};
