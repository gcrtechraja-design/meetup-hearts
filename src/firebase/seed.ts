import { collection, doc, getDocs, query, where, setDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { db } from './config';
import { UserProfile } from '../types';
import { findCity } from '../utils/cities';
import { isAdminEmail } from '../utils/admin';

export const SEED_LISTENERS: Omit<UserProfile, 'uid' | 'created_at'>[] = [
  // 10 Indian Females (22-32, warm friendly smile, saree/kurti/salwar, side braid/waves/ponytail/bun, 100% unique 3D realistic portraits)
  {
    name: 'Priya Rajendran',
    email: 'priya.listener@meetup.com',
    age: 23,
    gender: 'female',
    location: 'Chennai, Tamil Nadu',
    city: 'Chennai',
    latitude: 13.0827,
    longitude: 80.2707,
    allowVideoCalls: true,
    bio: 'Software engineer by day, friendly listener by evening. Traditional Bharatanatyam dancer who loves Carnatic fusion, modern cinema, and deep conversations over filter coffee.',
    profile_pic: '/avatars/avatar_1.jpg',
    interests: ['Classical Dance', 'Filter Coffee', 'Tech & AI', 'Deep Talks'],
    language: 'ta',
    role: 'listener',
    coins_balance: 120,
    diamonds_balance: 45,
    voice_rate: 10,
    video_rate: 50,
    status: 'online',
    presence_status: 'available',
    is_available: true,
    is_blocked: false,
  },
  {
    name: 'Ananya Sridhar',
    email: 'ananya.listener@meetup.com',
    age: 25,
    gender: 'female',
    location: 'Coimbatore, Tamil Nadu',
    city: 'Coimbatore',
    latitude: 11.0168,
    longitude: 76.9558,
    allowVideoCalls: true,
    bio: 'Kind-hearted literature grad. Balanced blend of modern cafe culture and traditional Tamil poetry. Let us share laughter, acoustic songs, and calm vibes after a long day.',
    profile_pic: '/avatars/avatar_2.jpg',
    interests: ['Tamil Poetry', 'Books & Novels', 'Acoustic Guitar', 'Mindfulness'],
    language: 'en',
    role: 'listener',
    coins_balance: 200,
    diamonds_balance: 90,
    voice_rate: 25,
    video_rate: 60,
    status: 'online',
    presence_status: 'available',
    is_available: true,
    is_blocked: false,
  },
  {
    name: 'Diya Bharathi',
    email: 'diya.listener@meetup.com',
    age: 22,
    gender: 'female',
    location: 'Madurai, Tamil Nadu',
    city: 'Madurai',
    latitude: 9.9252,
    longitude: 78.1198,
    allowVideoCalls: true,
    bio: 'Madurai ponnu with a contagious smile! College final year student who loves spicy street food, temple architecture, and chatting about college life and dreams.',
    profile_pic: '/avatars/avatar_3.jpg',
    interests: ['Street Food', 'Tamil Cinema', 'College Stories', 'Photography'],
    language: 'ta',
    role: 'listener',
    coins_balance: 80,
    diamonds_balance: 30,
    voice_rate: 10,
    video_rate: 50,
    status: 'busy',
    presence_status: 'busy',
    is_available: true,
    is_blocked: false,
  },
  {
    name: 'Kaviya Murali',
    email: 'kaviya.listener@meetup.com',
    age: 27,
    gender: 'female',
    location: 'Trichy, Tamil Nadu',
    city: 'Trichy',
    latitude: 10.7905,
    longitude: 78.7047,
    allowVideoCalls: true,
    bio: 'Certified yoga instructor and wellness podcaster. Calm, grounded, and empathetic. Here to listen whenever you need a soothing voice or an open non-judgmental space.',
    profile_pic: '/avatars/avatar_4.jpg',
    interests: ['Yoga', 'Mental Wellness', 'Nature Walks', 'Meditation'],
    language: 'ta',
    role: 'listener',
    coins_balance: 150,
    diamonds_balance: 60,
    voice_rate: 10,
    video_rate: 45,
    status: 'online',
    presence_status: 'available',
    is_available: true,
    is_blocked: false,
  },
  {
    name: 'Meena Sundaram',
    email: 'meena.listener@meetup.com',
    age: 24,
    gender: 'female',
    location: 'Salem, Tamil Nadu',
    city: 'Salem',
    latitude: 11.6643,
    longitude: 78.1460,
    allowVideoCalls: false, // audio only listener
    bio: 'Fine arts student & modern graphic designer. Passionate about retro Ilayaraja tunes, nighttime sketching, and heartwarming life stories.',
    profile_pic: '/avatars/avatar_5.jpg',
    interests: ['Retro Music', 'Graphic Design', 'Night Owl', 'Art & Sketching'],
    language: 'ta',
    role: 'listener',
    coins_balance: 95,
    diamonds_balance: 25,
    voice_rate: 22,
    video_rate: 55,
    status: 'offline',
    presence_status: 'unavailable',
    is_available: false,
    is_blocked: false,
  },
  {
    name: 'Deepa Krishnan',
    email: 'deepa.listener@meetup.com',
    age: 28,
    gender: 'female',
    location: 'Tirunelveli, Tamil Nadu',
    city: 'Tirunelveli',
    latitude: 8.7139,
    longitude: 77.7567,
    allowVideoCalls: true,
    bio: 'Sweet halwa city native speaking fluent Tamil & Telugu. Upbeat, caring, and loves talking about music, celebrations, fashion, and everyday happiness.',
    profile_pic: '/avatars/avatar_6.jpg',
    interests: ['Dance', 'Tamil & Telugu Hits', 'Fashion', 'Celebrations'],
    language: 'te',
    role: 'listener',
    coins_balance: 60,
    diamonds_balance: 15,
    voice_rate: 10,
    video_rate: 50,
    status: 'online',
    presence_status: 'available',
    is_available: true,
    is_blocked: false,
  },
  {
    name: 'Nivetha Ramesh',
    email: 'nivetha.listener@meetup.com',
    age: 26,
    gender: 'female',
    location: 'Vellore, Tamil Nadu',
    city: 'Vellore',
    latitude: 12.9165,
    longitude: 79.1325,
    allowVideoCalls: true,
    bio: 'Tech professional who loves mentoring and friendly chats. A thoughtful listener who can give you warm perspective on career stress or life crossroads.',
    profile_pic: '/avatars/avatar_7.jpg',
    interests: ['Self-Growth', 'Podcasts', 'Tea Sessions', 'Life Advice'],
    language: 'en',
    role: 'listener',
    coins_balance: 310,
    diamonds_balance: 140,
    voice_rate: 30,
    video_rate: 70,
    status: 'online',
    presence_status: 'available',
    is_available: true,
    is_blocked: false,
  },
  {
    name: 'Harini Venkatesh',
    email: 'harini.listener@meetup.com',
    age: 25,
    gender: 'female',
    location: 'Erode, Tamil Nadu',
    city: 'Erode',
    latitude: 11.3410,
    longitude: 77.7172,
    allowVideoCalls: true,
    bio: 'Home baker and foodie with a golden heart. Loves exchanging recipes, funny memories, and listening to people from all walks of life.',
    profile_pic: '/avatars/avatar_8.jpg',
    interests: ['Baking', 'Traditional Recipes', 'Humor', 'Gardening'],
    language: 'ta',
    role: 'listener',
    coins_balance: 110,
    diamonds_balance: 40,
    voice_rate: 10,
    video_rate: 50,
    status: 'online',
    presence_status: 'available',
    is_available: true,
    is_blocked: false,
  },
  {
    name: 'Sneha Balan',
    email: 'sneha.listener@meetup.com',
    age: 29,
    gender: 'female',
    location: 'Tiruppur, Tamil Nadu',
    city: 'Tiruppur',
    latitude: 11.1085,
    longitude: 77.3411,
    allowVideoCalls: true,
    bio: 'Textile styling graduate with high energy and cheerful vibes. Whether you want a friendly banter or deep venting, I am always right here!',
    profile_pic: '/avatars/avatar_9.jpg',
    interests: ['Ethnic Wear', 'Travel', 'Banter', 'Pop Culture'],
    language: 'hi',
    role: 'listener',
    coins_balance: 180,
    diamonds_balance: 75,
    voice_rate: 25,
    video_rate: 60,
    status: 'busy',
    presence_status: 'busy',
    is_available: true,
    is_blocked: false,
  },
  {
    name: 'Keerthana Natarajan',
    email: 'keerthana.listener@meetup.com',
    age: 24,
    gender: 'female',
    location: 'Thanjavur, Tamil Nadu',
    city: 'Thanjavur',
    latitude: 10.7870,
    longitude: 79.1378,
    allowVideoCalls: true,
    bio: 'Veena player & traditional storyteller from Thanjavur. Modern outlook with deep roots in heritage, art, and nostalgic conversations.',
    profile_pic: '/avatars/avatar_10.jpg',
    interests: ['Carnatic Veena', 'Heritage', 'Storytelling', 'South Indian Art'],
    language: 'ta',
    role: 'listener',
    coins_balance: 140,
    diamonds_balance: 55,
    voice_rate: 10,
    video_rate: 50,
    status: 'online',
    presence_status: 'available',
    is_available: true,
    is_blocked: false,
  },

  // 5 Indian Males (22-32, warm friendly smile, casual shirt/t-shirt, short hair + light beard, 100% unique 3D realistic portraits)
  {
    name: 'Karthik Ramachandran',
    email: 'karthik.listener@meetup.com',
    age: 26,
    gender: 'male',
    location: 'Dindigul, Tamil Nadu',
    city: 'Dindigul',
    latitude: 10.3673,
    longitude: 77.9803,
    allowVideoCalls: true,
    bio: 'Tech enthusiast and patient listener. Love discussing sports, startups, weekend travel, and life thoughts without any pressure or judgment.',
    profile_pic: '/avatars/avatar_11.jpg',
    interests: ['Cricket', 'Tech Trends', 'Acoustic Music', 'Friendly Talks'],
    language: 'ta',
    role: 'listener',
    coins_balance: 120,
    diamonds_balance: 45,
    voice_rate: 10,
    video_rate: 50,
    status: 'online',
    presence_status: 'available',
    is_available: true,
    is_blocked: false,
  },
  {
    name: 'Ashwin Subramaniam',
    email: 'ashwin.listener@meetup.com',
    age: 29,
    gender: 'male',
    location: 'Kanchipuram, Tamil Nadu',
    city: 'Kanchipuram',
    latitude: 12.8342,
    longitude: 79.7036,
    allowVideoCalls: true,
    bio: 'Friendly product designer who enjoys calm evening conversations, cinema analysis, fitness routines, and motivating life stories.',
    profile_pic: '/avatars/avatar_12.jpg',
    interests: ['Design & Art', 'Tamil Cinema', 'Fitness', 'Deep Conversations'],
    language: 'ta',
    role: 'listener',
    coins_balance: 210,
    diamonds_balance: 95,
    voice_rate: 25,
    video_rate: 65,
    status: 'offline',
    presence_status: 'unavailable',
    is_available: false,
    is_blocked: false,
  },
  {
    name: 'Vignesh Murugan',
    email: 'vignesh.listener@meetup.com',
    age: 24,
    gender: 'male',
    location: 'Puducherry',
    city: 'Puducherry',
    latitude: 11.9416,
    longitude: 79.8083,
    allowVideoCalls: true,
    bio: 'Pondicherry local with an easygoing attitude. Big fan of coastal bike rides, indie rock, coffee sessions, and late-night heart-to-heart chats.',
    profile_pic: '/avatars/avatar_13.jpg',
    interests: ['Motorcycle Trips', 'Indie Rock', 'Coffee Sessions', 'Casual Banter'],
    language: 'ta',
    role: 'listener',
    coins_balance: 130,
    diamonds_balance: 50,
    voice_rate: 22,
    video_rate: 55,
    status: 'online',
    presence_status: 'available',
    is_available: true,
    is_blocked: false,
  },
  {
    name: 'Siddharth Selvam',
    email: 'siddharth.listener@meetup.com',
    age: 28,
    gender: 'male',
    location: 'Nagercoil, Tamil Nadu',
    city: 'Nagercoil',
    latitude: 8.1833,
    longitude: 77.4119,
    allowVideoCalls: true,
    bio: 'Warm empathetic listener from the hills of Kanyakumari. Always here to hear you out, share positivity, and offer a calm supportive ear.',
    profile_pic: '/avatars/avatar_14.jpg',
    interests: ['Nature Photography', 'Mindfulness', 'Podcasts', 'Positive Vibes'],
    language: 'ta',
    role: 'listener',
    coins_balance: 160,
    diamonds_balance: 65,
    voice_rate: 10,
    video_rate: 50,
    status: 'online',
    presence_status: 'available',
    is_available: true,
    is_blocked: false,
  },
  {
    name: 'Arvind Raj',
    email: 'arvind.listener@meetup.com',
    age: 27,
    gender: 'male',
    location: 'Kumbakonam, Tamil Nadu',
    city: 'Kumbakonam',
    latitude: 10.9602,
    longitude: 79.3845,
    allowVideoCalls: true,
    bio: 'Architecture buff with a hearty laugh. Loves talking about heritage, food adventures, daily work stress venting, and lighthearted humor.',
    profile_pic: '/avatars/avatar_15.jpg',
    interests: ['Architecture', 'Food Adventures', 'Stress Relief', 'Humor'],
    language: 'ta',
    role: 'listener',
    coins_balance: 100,
    diamonds_balance: 40,
    voice_rate: 10,
    video_rate: 50,
    status: 'online',
    presence_status: 'available',
    is_available: true,
    is_blocked: false,
  },
];

const SEED_STORAGE_KEY = 'meetup_firestore_seeded_v4';

export async function seedFirestoreDatabase(forceRefresh = false): Promise<void> {
  // Prevent duplicate background seed attempts in the same browser session
  if (typeof window !== 'undefined' && sessionStorage.getItem(SEED_STORAGE_KEY) === 'true' && !forceRefresh) {
    return;
  }

  try {
    const usersRef = collection(db, 'users');
    const validSeedIds = new Set(SEED_LISTENERS.map((_, i) => `listener_seed_${i + 1}`));

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
            role: 'listener',
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
      if (typeof window !== 'undefined') {
        sessionStorage.setItem(SEED_STORAGE_KEY, 'true');
      }
      console.log('15 Listener profiles with 3D realistic avatars verified and seeded.');
    } catch (listenerSeedErr) {
      console.warn('Listener profiles seed notice:', listenerSeedErr);
    }

    // 2. Seed or verify official platform administrators
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
          });
        }
      }
    } catch (adminSeedErr) {
      console.warn('Admin seed notice:', adminSeedErr);
    }

    // 3. Remove any extra listener profiles or stale test/phone accounts
    try {
      const allUsersSnap = await getDocs(usersRef);
      for (const userDoc of allUsersSnap.docs) {
        const data = userDoc.data();
        const docId = userDoc.id;

        // Always protect official admins from deletion
        if (isAdminEmail(data.email) || docId === 'admin_gcrtech_raja' || docId === 'admin_mrraavana07') {
          continue;
        }

        try {
          // If document is duplicate or legacy placeholder admin
          if (docId === 'admin_meetup_super' || docId === 'admin_meetup_uid') {
            await deleteDoc(doc(db, 'users', docId));
          }
        } catch {}
      }
    } catch (cleanupErr) {
      console.warn('Profile cleanup notice:', cleanupErr);
    }

    if (typeof window !== 'undefined') {
      sessionStorage.setItem(SEED_STORAGE_KEY, 'true');
    }
  } catch (error: any) {
    console.warn('Firestore database seeding notice:', error?.message || error);
  }
}
