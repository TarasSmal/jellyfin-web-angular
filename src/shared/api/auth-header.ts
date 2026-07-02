import { getDeviceId } from '../lib/device-id';

export const CLIENT_NAME = 'Jellyfin Web Angular';
export const CLIENT_VERSION = '0.1.0';

/**
 * Jellyfin's MediaBrowser authorization scheme. Sent on every API request;
 * Token is appended once a session exists.
 */
export function buildAuthHeader(accessToken: string | null): string {
  const parts = [
    `Client="${CLIENT_NAME}"`,
    `Device="Browser"`,
    `DeviceId="${getDeviceId()}"`,
    `Version="${CLIENT_VERSION}"`,
  ];
  if (accessToken) parts.push(`Token="${accessToken}"`);
  return `MediaBrowser ${parts.join(', ')}`;
}
