import { create } from 'zustand';
import { persist } from 'zustand/middleware';

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

  addLog: (entry: Omit<InventoryLogEntry, 'id' | 'timestamp'>) => void;
  clearLogs: () => void;
  updateSnapshot: (snapshot: ApiSnapshot) => void;
  setLogs: (logs: InventoryLogEntry[]) => void;
}

export const useInventoryStore = create<InventoryState>()(
  persist(
    (set) => ({
      logs: [],
      lastSnapshot: null,

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
      },

      clearLogs: () => {
        set({ logs: [], lastSnapshot: null });
      },

      updateSnapshot: (snapshot) => {
        set({ lastSnapshot: snapshot });
      },

      setLogs: (logs) => {
        set({ logs });
      },
    }),
    {
      name: 'schmelzdepot-inventory-store',
    }
  )
);
