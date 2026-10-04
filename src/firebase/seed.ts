import { collection, doc, getDocs, query, where, setDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { db } from './config';
import { UserProfile } from '../types';
import { findCity } from '../utils/cities';
import { isAdminEmail } from '../utils/admin';
import { DUMMY_LISTENERS } from '../data/dummyListeners';

export const SEED_LISTENERS: Omit<UserProfile, 'uid' | 'created_at'>[] = DUMMY_LISTENERS.map((d) => {
  const { uid, created_at, ...rest } = d;
  return rest;
});

export const REAL_LISTENERS: UserProfile[] = [
  {
    uid: 'real_listener_1',
    id: 'real_listener_1',
    name: 'Aishwarya V',
    email: 'aishwarya.listener@meetup.com',
    age: 26,
    gender: 'female',
    location: 'Chennai, Tamil Nadu',
    city: 'Chennai',
    latitude: 13.0827,
    longitude: 80.2707,
    allowVideoCalls: true,
    bio: 'Warm and empathetic certified counselor & listener. Fluent in Tamil and English.',
    profile_pic: '/avatars/avatar_1.jpg',
    interests: ['Counseling', 'Mindfulness', 'Deep Talks', 'Classical Music'],
    language: 'ta',
    role: 'listener',
    is_listener: true,
    isListener: true,
    isActive: true,
    is_active: true,
    isDummy: false,
    coins_balance: 150,
    diamonds_balance: 60,
    voice_rate: 10,
    video_rate: 50,
    audio_rate_coins: 10,
    video_rate_coins: 50,
    status: 'online',
    presence_status: 'available',
    is_available: true,
    isBlocked: false,
    is_blocked: false,
    password_hash: 'seed_encrypted_hash',
    created_at: new Date('2026-01-15T10:00:00.000Z').toISOString(),
    createdAt: new Date('2026-01-15T10:00:00.000Z').toISOString(),
  },
  {
    uid: 'real_listener_2',
    id: 'real_listener_2',
    name: 'Bhavana S',
    email: 'bhavana.listener@meetup.com',
    age: 25,
    gender: 'female',
    location: 'Bangalore, Karnataka',
    city: 'Bangalore',
    latitude: 12.9716,
    longitude: 77.5946,
    allowVideoCalls: true,
    bio: 'Friendly conversationalist, active listener, and music lover. Let us connect!',
    profile_pic: '/avatars/avatar_2.jpg',
    interests: ['Reading', 'Conversations', 'Music', 'Travel'],
    language: 'en',
    role: 'listener',
    is_listener: true,
    isListener: true,
    isActive: true,
    is_active: true,
    isDummy: false,
    coins_balance: 180,
    diamonds_balance: 75,
    voice_rate: 10,
    video_rate: 50,
    audio_rate_coins: 10,
    video_rate_coins: 50,
    status: 'online',
    presence_status: 'available',
    is_available: true,
    isBlocked: false,
    is_blocked: false,
    password_hash: 'seed_encrypted_hash',
    created_at: new Date('2026-01-16T10:00:00.000Z').toISOString(),
    createdAt: new Date('2026-01-16T10:00:00.000Z').toISOString(),
  },
];

const SEED_STORAGE_KEY = 'meetup_firestore_seeded_v6';

export async function seedFirestoreDatabase(forceRefresh = false): Promise<void> {
  // Prevent duplicate background seed attempts in the same browser session if already verified
  if (typeof window !== 'undefined' && sessionStorage.getItem(SEED_STORAGE_KEY) === 'true' && !forceRefresh) {
    return;
  }

  try {
    const usersRef = collection(db, 'users');

    // 1. Seed or refresh the 15 dummy listener profiles with 3D realistic avatars
    try {
      console.log('Seeding / verifying 15 3D realistic listener profiles...');
      for (let i = 0; i < SEED_LISTENERS.length; i++) {
        const listener = SEED_LISTENERS[i];
        const docId = `listener_seed_${i + 1}`;
        const cityData = findCity(listener.location);
        await setDoc(
          doc(db, 'users', docId),
          {
            ...listener,
            uid: docId,
            id: docId,
            role: 'listener',
            is_listener: true,
            isListener: true,
            status: listener.status || 'online',
            isActive: true,
            is_active: true,
            is_available: true,
            isDummy: false,
            city: listener.city || cityData.name,
            latitude: listener.latitude ?? cityData.lat,
            longitude: listener.longitude ?? cityData.lng,
            allowVideoCalls: listener.allowVideoCalls !== false,
            audio_rate_coins: listener.audio_rate_coins ?? listener.voice_rate ?? 10,
            video_rate_coins: listener.video_rate_coins ?? listener.video_rate ?? 50,
            isBlocked: false,
            is_blocked: false,
            password_hash: 'seed_encrypted_hash',
            created_at: serverTimestamp(),
            createdAt: serverTimestamp(),
          },
          { merge: true }
        );
      }
      console.log('15 Listener profiles with 3D realistic avatars verified and seeded.');
    } catch (listenerSeedErr) {
      console.warn('Listener profiles seed notice:', listenerSeedErr);
    }

    // 2. Ensure 2 Real Listener accounts exist and are never deleted or overwritten
    try {
      for (const rl of REAL_LISTENERS) {
        const rlRef = doc(db, 'users', rl.uid);
        await setDoc(rlRef, {
          ...rl,
          role: 'listener',
          is_listener: true,
          isListener: true,
          status: 'online',
          isActive: true,
          is_active: true,
          is_available: true,
          isDummy: false,
          created_at: serverTimestamp(),
          createdAt: serverTimestamp(),
        }, { merge: true });
      }
      console.log('2 Real Listener accounts verified and seeded.');
    } catch (rlErr) {
      console.warn('Real listener seed notice:', rlErr);
    }

    // 3. Seed or verify official platform administrators
    try {
      const officialAdmins = [
        {
          uid: 'admin_rajasuvimarriage',
          name: 'Raja Admin',
          email: 'rajasuvimarriage09@gmail.com',
          bio: 'Meet Up Platform Administrator',
          profile_pic: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=300&h=300&fit=crop&crop=faces',
        },
        {
          uid: 'admin_gcrtech_raja',
          name: 'Raja Admin',
          email: 'gcrtech.raja@gmail.com',
          bio: 'Meet Up Platform Administrator',
          profile_pic: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=300&h=300&fit=crop&crop=faces',
        },
        {
          uid: 'admin_mrraavana07',
          name: 'Raavana Admin',
          email: 'mrraavana07@gmail.com',
          bio: 'Meet Up Platform Administrator',
          profile_pic: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=300&h=300&fit=crop&crop=faces',
        },
      ];

      for (const admin of officialAdmins) {
        const adminDocRef = doc(db, 'users', admin.uid);
        const snap = await getDocs(query(usersRef, where('email', '==', admin.email)));
        if (snap.empty) {
          await setDoc(adminDocRef, {
            uid: admin.uid,
            id: admin.uid,
            name: admin.name,
            email: admin.email,
            age: 30,
            gender: 'other',
            location: 'Chennai, Tamil Nadu',
            city: 'Chennai',
            latitude: 13.0827,
            longitude: 80.2707,
            allowVideoCalls: true,
            bio: admin.bio,
            profile_pic: admin.profile_pic,
            interests: ['Safety', 'Platform Operations', 'Moderation'],
            language: 'en',
            role: 'admin',
            is_admin: true,
            isAdmin: true,
            coins_balance: 9999,
            diamonds_balance: 500,
            voice_rate: 10,
            video_rate: 50,
            status: 'online',
            isBlocked: false,
            is_blocked: false,
            created_at: serverTimestamp(),
            createdAt: serverTimestamp(),
          }, { merge: true });
        }
      }
    } catch (adminSeedErr) {
      console.warn('Admin seed notice:', adminSeedErr);
    }

    // 4. Ensure payment_config has hardcoded admin UPI ID
    try {
      await setDoc(doc(db, 'settings', 'payment_config'), {
        upi_id: 'rajasuvimarriage09-1@okhdfcbank',
        admin_name: 'MeetUp',
        updated_at: serverTimestamp()
      }, { merge: true });
    } catch (paymentSeedErr) {
      console.warn('Payment config seed notice:', paymentSeedErr);
    }

    // NOTE: DELETION LOGIC REMOVED ENTIRELY.
    // The seed script MUST NEVER delete or overwrite real user accounts.

    if (typeof window !== 'undefined') {
      sessionStorage.setItem(SEED_STORAGE_KEY, 'true');
    }
  } catch (error: any) {
    console.warn('Firestore database seeding notice:', error?.message || error);
  }
}
