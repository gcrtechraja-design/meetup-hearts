export const AUDIO_COIN_PER_MINUTE = 10;
export const VIDEO_COIN_PER_MINUTE = 50;
export const AUDIO_COIN_PER_SECOND = AUDIO_COIN_PER_MINUTE / 60;
export const VIDEO_COIN_PER_SECOND = VIDEO_COIN_PER_MINUTE / 60;

export type UserRole = 'user' | 'listener' | 'admin' | 'owner';
export type UserStatus = 'online' | 'offline' | 'busy' | 'unavailable';

export interface UserProfile {
  uid: string;
  name: string;
  email: string;
  phone?: string;
  phone_number?: string;
  password_hash?: string;
  age: number;
  gender: 'male' | 'female' | 'other';
  location: string;
  bio: string;
  profile_pic: string;
  avatar_url?: string;
  interests: string[];
  language: string;
  role: UserRole;
  is_admin?: boolean;
  isAdmin?: boolean;
  coins_balance: number;
  diamonds_balance: number;
  voice_rate: number;
  video_rate: number;
  audio_rate_coins?: number;
  video_rate_coins?: number;
  status: UserStatus;
  presence_status?: string;
  presence?: string;
  is_available?: boolean;
  city?: string;
  latitude?: number;
  longitude?: number;
  allowVideoCalls?: boolean;
  in_call?: boolean;
  call_started_at?: any;
  average_duration?: number;
  fcm_token?: string;
  fcm_token_updated_at?: any;
  background_call_notify?: boolean;
  background_call_notifications?: boolean;
  is_blocked: boolean;
  isBlocked?: boolean;
  created_at: any;
  createdAt?: any;
}

export interface Transaction {
  id?: string;
  user_id: string;
  amount_inr: number;
  coins_credited: number;
  gateway_ref: string;
  status: 'success' | 'failed' | 'pending';
  created_at: any;
}

export interface CallLog {
  id?: string;
  caller_id: string;
  caller_name?: string;
  caller_pic?: string;
  receiver_id: string;
  receiver_name?: string;
  receiver_pic?: string;
  type: 'voice' | 'video';
  duration_sec: number;
  coins_spent: number;
  started_at: any;
}

export interface Bookmark {
  id?: string;
  user_id: string;
  favorited_user_id: string;
  created_at: any;
}

export type ReportReason = 'Fake Profile' | 'Inappropriate Content' | 'Abuse' | 'Others';

export interface Report {
  id?: string;
  reporter_id: string;
  reporter_name?: string;
  reported_id: string;
  reported_name?: string;
  reason: ReportReason;
  description: string;
  created_at: any;
}

export interface Block {
  id?: string;
  blocker_id: string;
  blocked_id: string;
  created_at: any;
}

export interface ListenerApplication {
  id?: string;
  user_id: string;
  name?: string;
  status: 'pending' | 'approved' | 'rejected';
  experience?: string;
  languages: string[];
  audio_bio?: string;
  location?: string;
  city?: string;
  voice_rate?: number;
  video_rate?: number;
  allowVideoCalls?: boolean;
  created_at: any;
}

export interface ActiveCall {
  id?: string;
  caller_id: string;
  caller_name: string;
  caller_pic: string;
  receiver_id: string;
  receiver_name: string;
  receiver_pic: string;
  type: 'voice' | 'video';
  call_type?: 'audio' | 'video';
  status: 'ringing' | 'ongoing' | 'connected' | 'ended' | 'completed' | 'declined' | 'missed' | 'busy';
  room_id: string;
  rate_per_min: number;
  is_surprise?: boolean;
  attempt_number?: number;
  offer?: any;
  answer?: any;
  offer_sent_at?: any;
  answer_sent_at?: any;
  created_at: any;
  accepted_at?: any;
  ended_at?: any;
}

export interface UserFavourite {
  id?: string;
  user_id: string;
  favorited_user_id: string;
  created_at: any;
}

export interface BlockedUser {
  id?: string;
  blocker_id: string;
  blocked_id: string;
  created_at: any;
}

export interface CoinPackage {
  id: string;
  coins: number;
  price_inr: number;
  original_price_inr?: number;
  discount_text?: string;
  badge?: 'hot' | 'value' | string;
  tag?: string;
  popular?: boolean;
}
