/**
 * Utility for local coin management
 *
 * Requirements:
 * 1. loadCoins() reads from localStorage 'meetup_coins'. If not exists, set 9999.
 * 2. On page load, display coins ONLY from localStorage, never from Firestore. If Firestore returns 0, ignore it.
 */

export const loadCoins = (): number => {
  if (typeof window === 'undefined') return 9999;
  try {
    const stored = localStorage.getItem('meetup_coins');
    if (stored !== null && stored !== undefined && stored.trim() !== '') {
      const parsed = parseInt(stored, 10);
      if (!isNaN(parsed) && parsed > 0) {
        return parsed;
      }
    }
    // If not exists or 0, initialize to 9999
    localStorage.setItem('meetup_coins', '9999');
    return 9999;
  } catch {
    return 9999;
  }
};

export const saveCoins = (amount: number): void => {
  if (typeof window === 'undefined') return;
  try {
    const finalAmount = amount > 0 ? amount : 9999;
    localStorage.setItem('meetup_coins', String(finalAmount));
  } catch {}
};
