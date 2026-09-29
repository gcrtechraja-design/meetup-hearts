import { UserProfile } from '../types';

/**
 * Checks if a listener is offline or marked unavailable in Firestore.
 * Supports multiple presence formats: presence_status, presence, status, and is_available.
 */
export const isListenerOffline = (user?: UserProfile | null): boolean => {
  if (!user) return true;

  const status = (user.status || '').toString().toLowerCase();
  const presenceStatus = (
    user.presence_status ||
    user.presence ||
    (user as any).presenceStatus ||
    ''
  ).toString().toLowerCase();

  // If explicitly unavailable, offline, or inactive
  if (
    status === 'unavailable' ||
    status === 'offline' ||
    status === 'inactive' ||
    presenceStatus === 'unavailable' ||
    presenceStatus === 'offline' ||
    presenceStatus === 'inactive' ||
    user.is_available === false ||
    (user as any).available === false
  ) {
    return true;
  }

  return false;
};

/**
 * Returns the standardized presence state: 'online' | 'busy' | 'offline'
 */
export const getListenerPresence = (user?: UserProfile | null): 'online' | 'busy' | 'offline' => {
  if (!user) return 'offline';

  if (isListenerOffline(user)) {
    return 'offline';
  }

  const status = (user.status || '').toString().toLowerCase();
  const presenceStatus = (
    user.presence_status ||
    user.presence ||
    (user as any).presenceStatus ||
    ''
  ).toString().toLowerCase();

  if (user.in_call === true || status === 'busy' || presenceStatus === 'busy') {
    return 'busy';
  }

  return 'online';
};
