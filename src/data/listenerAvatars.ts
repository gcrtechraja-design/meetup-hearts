export interface ListenerAvatarItem {
  id: number;
  gender: 'female' | 'male';
  name: string;
  style: string;
  url: string;
}

export const LISTENER_AVATARS: ListenerAvatarItem[] = [
  { id: 1, gender: 'female', name: 'Priya', style: 'Silk Saree & Side Braid', url: '/avatars/avatar_1.jpg' },
  { id: 2, gender: 'female', name: 'Ananya', style: 'Emerald Green Kurti & Waves', url: '/avatars/avatar_2.jpg' },
  { id: 3, gender: 'female', name: 'Diya', style: 'Pastel Salwar & Sleek Ponytail', url: '/avatars/avatar_3.jpg' },
  { id: 4, gender: 'female', name: 'Kaviya', style: 'Royal Blue Saree & Jasmine Bun', url: '/avatars/avatar_4.jpg' },
  { id: 5, gender: 'female', name: 'Meena', style: 'Maroon Modern Kurti', url: '/avatars/avatar_5.jpg' },
  { id: 6, gender: 'female', name: 'Deepa', style: 'Peacock Teal Silk & Half-Up Style', url: '/avatars/avatar_6.jpg' },
  { id: 7, gender: 'female', name: 'Nivetha', style: 'Lavender Saree & Traditional Braid', url: '/avatars/avatar_7.jpg' },
  { id: 8, gender: 'female', name: 'Harini', style: 'Peach Anarkali Suit', url: '/avatars/avatar_8.jpg' },
  { id: 9, gender: 'female', name: 'Sneha', style: 'Mustard Saree & Classic Bun', url: '/avatars/avatar_9.jpg' },
  { id: 10, gender: 'female', name: 'Keerthana', style: 'Mint Green Kurti & Soft Curls', url: '/avatars/avatar_10.jpg' },
  { id: 11, gender: 'male', name: 'Karthik', style: 'Navy Button-Down & Fade Cut', url: '/avatars/avatar_11.jpg' },
  { id: 12, gender: 'male', name: 'Ashwin', style: 'Olive Henley & Trimmed Beard', url: '/avatars/avatar_12.jpg' },
  { id: 13, gender: 'male', name: 'Vignesh', style: 'Grey Crewneck & Clean Style', url: '/avatars/avatar_13.jpg' },
  { id: 14, gender: 'male', name: 'Siddharth', style: 'White Linen Shirt & Short Beard', url: '/avatars/avatar_14.jpg' },
  { id: 15, gender: 'male', name: 'Arvind', style: 'Maroon Polo & Designer Stubble', url: '/avatars/avatar_15.jpg' },
];

/**
 * Deterministically returns one of the 15 3D realistic avatars based on a string (e.g. userId or name),
 * ensuring the avatar remains consistent for the same listener across all screens and reloads.
 */
export function getConsistentListenerAvatar(seedKey?: string | null): string {
  if (!seedKey) return LISTENER_AVATARS[0].url;
  let hash = 0;
  for (let i = 0; i < seedKey.length; i++) {
    hash = (hash << 5) - hash + seedKey.charCodeAt(i);
    hash |= 0;
  }
  const index = Math.abs(hash) % LISTENER_AVATARS.length;
  return LISTENER_AVATARS[index].url;
}

/**
 * Returns a random avatar from the 15 avatars, optionally filtered by gender.
 */
export function getRandomListenerAvatar(gender?: 'female' | 'male'): string {
  const filtered = gender 
    ? LISTENER_AVATARS.filter((a) => a.gender === gender)
    : LISTENER_AVATARS;
  const randomIndex = Math.floor(Math.random() * filtered.length);
  return filtered[randomIndex].url;
}

export function getListenerAvatarById(id: number): ListenerAvatarItem {
  const item = LISTENER_AVATARS.find((a) => a.id === id);
  return item || LISTENER_AVATARS[0];
}
