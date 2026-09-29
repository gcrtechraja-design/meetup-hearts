/**
 * Simple SHA-256 password hashing utility for client-side password verification fallback
 */
export const hashPassword = async (password: string): Promise<string> => {
  if (typeof crypto === 'undefined' || !crypto.subtle) {
    // Basic fallback for environments without crypto.subtle
    let hash = 0;
    const str = password + '_meetup_salt_2026';
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash) + str.charCodeAt(i);
      hash |= 0;
    }
    return 'fallback_hash_' + Math.abs(hash).toString(16);
  }
  const encoder = new TextEncoder();
  const data = encoder.encode(password + '_meetup_salt_2026');
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
};
