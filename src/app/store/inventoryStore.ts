import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { projectId, publicAnonKey } from '../../../utils/supabase/info';

export interface InventoryLogEntry {
  id: string;
  timestamp: number;
  type?: string;
  category: string;
  item: string;
  change: number;
  previousQuantity?: number;
  newQuantity?: number;
  details?: string;
  itemName?: string;
  movementType?: string;
  amount?: number;
  reason?: string;
  notes?: string;
  user?: string;
  source?: string;
  weight?: number;
}

export interface SnapshotItem {
  name: string;
  quantity: number;
}

export interface ApiSnapshot {
  timestamp: string;
  gold: any[];
  silver: any[];
  items: SnapshotItem[];
  machines: SnapshotItem[];
}

interface InventoryState {
  logs: InventoryLogEntry[];
  lastSnapshot: ApiSnapshot | null;
  _lastSavedAt: number;

  addLog: (entry: Omit<InventoryLogEntry, 'id' | 'timestamp'>) => void;
  clearLogs: () => void;
  updateSnapshot: (snapshot: ApiSnapshot) => void;
  setLogs: (logs: InventoryLogEntry[]) => void;

  loadFromBackend: () => Promise<boolean>;
  saveToBackend: () => Promise<void>;
}

const BASE_URL = `https://${projectId}.supabase.co/functions/v1/make-server-b50ee5dd`;

const AUTH_HEADERS = {
  'Authorization': `Bearer ${publicAnonKey}`,
  'Content-Type': 'application/json',
};

export const useInventoryStore = create<InventoryState>()(
  persist(
    (set, get) => ({
      logs: [],
      lastSnapshot: null,
      _lastSavedAt: 0,

      // Returns true if new data was applied from server
      loadFromBackend: async (): Promise<boolean> => {
        try {
          const response = await fetch(`${BASE_URL}/store/inventory_data`, {
            headers: AUTH_HEADERS,
          });
          if (!response.ok) return false;

          const { data } = await response.json();
          if (!data) return false;

          const serverTs: number = data._savedAt || 0;
          const localTs: number = get()._lastSavedAt;

          if (serverTs <= localTs) return false;

          set({
            logs: data.logs || [],
            lastSnapshot: data.lastSnapshot || null,
            _lastSavedAt: serverTs,
          });
          return true;
        } catch (error) {
          console.error('InventoryStore: Backend-Load fehlgeschlagen, nutze LocalStorage-Cache:', error);
          return false;
        }
      },

      saveToBackend: async () => {
        const state = get();
        const timestamp = Date.now();
        try {
          const res = await fetch(`${BASE_URL}/store/inventory_data`, {
            method: 'POST',
            headers: AUTH_HEADERS,
            body: JSON.stringify({
              logs: state.logs,
              lastSnapshot: state.lastSnapshot,
              _savedAt: timestamp,
            }),
          });
          if (res.ok) {
            set({ _lastSavedAt: timestamp });
          }
        } catch (error) {
          console.error('InventoryStore: Backend-Save fehlgeschlagen, Daten im LocalStorage gesichert:', error);
        }
      },

      addLog: (entry) => {
        set((state) => ({
          logs: [
            {
              ...entry,
              id: `log-${Date.now()}-${Math.random()}`,
              timestamp: Date.now(),
            } as InventoryLogEntry,
            ...state.logs,
          ],
        }));
        get().saveToBackend();
      },

      clearLogs: () => {
        set({ logs: [], lastSnapshot: null });
        get().saveToBackend();
      },

      updateSnapshot: (snapshot) => {
        set({ lastSnapshot: snapshot });
        get().saveToBackend();
      },

      setLogs: (logs) => {
        set({ logs });
        get().saveToBackend();
      },
    }),
    {
      name: 'schmelzdepot-inventory-store',
      partialize: (state) => ({
        logs: state.logs,
        lastSnapshot: state.lastSnapshot,
        _lastSavedAt: state._lastSavedAt,
      }),
    }
  )
);