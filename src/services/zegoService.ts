import { ZegoUIKitPrebuilt } from '@zegocloud/zego-uikit-prebuilt';

const DEFAULT_APP_ID = 1484647939;
const DEFAULT_SERVER_SECRET = '4068ef573678dc2fbb5591cfc24cb349';

/**
 * Get active ZEGOCLOUD App ID (from localStorage, env, or default)
 */
export function getZegoAppId(): number {
  const saved = localStorage.getItem('meetup_zego_app_id');
  if (saved && !isNaN(Number(saved))) {
    return Number(saved);
  }
  return Number(import.meta.env.VITE_ZEGOCLOUD_APP_ID || DEFAULT_APP_ID);
}

/**
 * Get active ZEGOCLOUD Server Secret (from localStorage, env, or default)
 */
export function getZegoServerSecret(): string {
  const saved = localStorage.getItem('meetup_zego_server_secret');
  if (saved && saved.trim().length > 5) {
    return saved.trim();
  }
  return (import.meta.env.VITE_ZEGOCLOUD_SERVER_SECRET as string) || DEFAULT_SERVER_SECRET;
}

/**
 * Save custom ZEGOCLOUD AppID and Server Secret
 */
export function setZegoCredentials(appId: number, serverSecret: string) {
  localStorage.setItem('meetup_zego_app_id', appId.toString());
  localStorage.setItem('meetup_zego_server_secret', serverSecret.trim());
}

/**
 * Generate ZEGOCLOUD Kit Token for user in room
 */
export function generateZegoKitToken(roomID: string, userID: string, userName: string): string {
  const appId = getZegoAppId();
  const serverSecret = getZegoServerSecret();

  try {
    return ZegoUIKitPrebuilt.generateKitTokenForTest(
      appId,
      serverSecret,
      roomID,
      userID,
      userName || 'User_' + userID.slice(0, 4)
    );
  } catch (error) {
    console.error('Failed to generate ZEGOCLOUD Kit Token with provided credentials:', error);
    return `token_${roomID}_${userID}_${Date.now()}`;
  }
}
