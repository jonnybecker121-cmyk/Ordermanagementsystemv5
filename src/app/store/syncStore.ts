import { create } from 'zustand';

export type SyncStatus = 'idle' | 'syncing' | 'online' | 'offline' | 'error';

interface SyncState {
  status: SyncStatus;
  lastSyncedAt: number | null; // timestamp
  pendingChanges: boolean;
  deviceId: string;
  
  setStatus: (status: SyncStatus) => void;
  setLastSyncedAt: (ts: number) => void;
  setPendingChanges: (pending: boolean) => void;
}

// Persistente Geräte-ID generieren (bleibt pro Browser/Gerät gleich)
function getOrCreateDeviceId(): string {
  const key = 'schmelzdepot-device-id';
  let id = localStorage.getItem(key);
  if (!id) {
    id = `DEV-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
    localStorage.setItem(key, id);
  }
  return id;
}

export const useSyncStore = create<SyncState>((set) => ({
  status: 'idle',
  lastSyncedAt: null,
  pendingChanges: false,
  deviceId: getOrCreateDeviceId(),

  setStatus: (status) => set({ status }),
  setLastSyncedAt: (ts) => set({ lastSyncedAt: ts }),
  setPendingChanges: (pending) => set({ pendingChanges: pending }),
}));
