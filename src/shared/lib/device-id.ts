const STORAGE_KEY = 'jf.deviceId';

/** Stable per-browser identifier sent with every Jellyfin auth header. */
export function getDeviceId(): string {
  let id = localStorage.getItem(STORAGE_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(STORAGE_KEY, id);
  }
  return id;
}
