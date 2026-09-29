import { getConsistentListenerAvatar } from '../data/listenerAvatars';

/**
 * static.io / Statically CDN image service & Avatar Provider
 * Delivers optimized, high-speed cached images via the static.io CDN proxy.
 * Supports 3D realistic illustrated portraits matching reference style.
 */

/**
 * Returns a 3D illustrated realistic avatar (consistent based on seed/userId)
 */
export function getDefaultFemaleAvatar(seed?: string): string {
  return getConsistentListenerAvatar(seed || 'female-user');
}

/**
 * Returns a cute fun-emoji female avatar illustration alternative
 */
export function getFunEmojiAvatar(seed?: string): string {
  return getConsistentListenerAvatar(seed || 'girl');
}

/**
 * Delivers optimized image URL.
 * Never defaults to robots/bottts - always defaults to 3D realistic avatar.
 */
export function getStaticCdnUrl(originalUrl?: string | null, options?: { width?: number; height?: number; quality?: number; format?: string }): string {
  if (!originalUrl || originalUrl.includes('bottts') || originalUrl.includes('seed=user')) {
    return getConsistentListenerAvatar('meetup-customer');
  }

  // Local 3D avatar assets
  if (originalUrl.startsWith('/avatars/') || originalUrl.includes('/avatars/')) {
    return originalUrl;
  }

  // If Supabase Storage public URL, return directly (Supabase serves public photos directly)
  if (originalUrl.includes('supabase.co/storage') || originalUrl.includes('/storage/v1/object/public/photos')) {
    return originalUrl;
  }

  // If already a static.io CDN url, return as is
  if (originalUrl.includes('cdn.statically.io') || originalUrl.includes('cdn.static.io')) {
    return originalUrl;
  }

  // If data URI (uploaded base64 photo), return directly
  if (originalUrl.startsWith('data:') || originalUrl.startsWith('blob:')) {
    return originalUrl;
  }

  // If Dicebear SVG avatar, return directly (Dicebear has built-in global CDN)
  if (originalUrl.includes('dicebear.com')) {
    return originalUrl;
  }

  try {
    // Strip protocol (http:// or https://)
    const stripped = originalUrl.replace(/^https?:\/\//i, '');
    const w = options?.width ? `w=${options.width}&` : '';
    const h = options?.height ? `h=${options.height}&` : '';
    const q = options?.quality ? `q=${options.quality}&` : 'q=90&';
    const f = options?.format ? `f=${options.format}&` : 'f=auto&';

    // Format via Statically CDN (cdn.statically.io)
    return `https://cdn.statically.io/img/${stripped}?${w}${h}${q}${f}`.replace(/[&?]$/, '');
  } catch (err) {
    return originalUrl;
  }
}

/**
 * Resolves avatar URL according to business rules:
 * 1. Has uploaded/assigned profile_pic or avatar_url -> Show that image
 * 2. Missing photoURL/profile_pic -> Consistent 3D realistic illustrated avatar based on userId hash
 */
export function getUserAvatarUrl(user?: {
  uid?: string;
  name?: string;
  role?: string;
  profile_pic?: string;
  avatar_url?: string;
  photoURL?: string;
  email?: string;
} | null): string {
  if (!user) {
    return getConsistentListenerAvatar('guest');
  }

  const pic = user.profile_pic || user.avatar_url || (user as any).photoURL;

  // Real customer or listener with an explicit profile_pic or avatar_url
  if (pic && pic.trim()) {
    if (!pic.includes('bottts') && !pic.includes('seed=user') && !pic.includes('randomuser.me')) {
      if (pic.startsWith('/avatars/') || pic.includes('/avatars/')) {
        return pic;
      }
      return getStaticCdnUrl(pic);
    }
  }

  // Fallback: Consistent 3D realistic avatar based on user ID or seed key
  const seedKey = user.uid || user.name || user.email || 'listener';
  return getConsistentListenerAvatar(seedKey);
}

/**
 * Upload and process image for static storage and CDN delivery
 */
export async function uploadImageToStaticCdn(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    // Check file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      reject(new Error('File size exceeds 5MB limit. Please choose a smaller photo.'));
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const base64Data = reader.result as string;
      // In production, upload to CDN endpoint or return optimized base64 for persistent Firestore storage
      resolve(base64Data);
    };
    reader.onerror = (error) => reject(error);
    reader.readAsDataURL(file);
  });
}

