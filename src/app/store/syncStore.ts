import { create } from 'zustand';

export type SyncStatus = 'local';

interface SyncState {
  status: SyncStatus;
  deviceId: string;
}

function getOrCreateDeviceId(): string {
  const key = 'schmelzdepot-device-id';
  let id = localStorage.getItem(key);
  if (!id) {
    id = `DEV-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
    localStorage.setItem(key, id);
  }
  return id;
}

export const useSyncStore = create<SyncState>(() => ({
  status: 'local',
  deviceId: getOrCreateDeviceId(),
}));
