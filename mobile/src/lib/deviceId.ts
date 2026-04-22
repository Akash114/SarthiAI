import Constants from 'expo-constants';

/** Stable-enough id for push registration (optional API field, max 128 chars). */
export function getClientDeviceId(): string | undefined {
  const sid = Constants.sessionId;
  if (sid && typeof sid === 'string' && sid.length > 0) {
    return sid.length > 128 ? sid.slice(0, 128) : sid;
  }
  return undefined;
}
