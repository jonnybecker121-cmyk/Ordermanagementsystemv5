import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { projectId } from '../../../utils/supabase/info';

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
  
  loadFromBackend: () => Promise<void>;
  saveToBackend: () => Promise<void>;
}

export const useInventoryStore = create<InventoryState>()(
  persist(
    (set, get) => ({
      logs: [],
      lastSnapshot: null,
      
      loadFromBackend: async () => {
        try {
          const response = await fetch(`https://${projectId}.supabase.co/functions/v1/make-server-b50ee5dd/store/inventory_data`);
          if (response.ok) {
            const { data } = await response.json();
            if (data) {
              set({
                logs: data.logs || [],
                lastSnapshot: data.lastSnapshot || null
              });
            }
          }
        } catch (error) {
          console.error('Failed to load inventory data from backend, using cached LocalStorage data', error);
        }
      },
      
      saveToBackend: async () => {
        const state = get();
        try {
          await fetch(`https://${projectId}.supabase.co/functions/v1/make-server-b50ee5dd/store/inventory_data`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              logs: state.logs,
              lastSnapshot: state.lastSnapshot
            })
          });
        } catch (error) {
          console.error('Failed to save inventory data to backend, data is preserved in LocalStorage', error);
        }
      },

      addLog: (entry) => {
        set((state) => ({
          logs: [{
            ...entry,
            id: `log-${Date.now()}-${Math.random()}`,
            timestamp: Date.now(),
          } as InventoryLogEntry, ...state.logs]
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
      // Nur Daten persistieren, keine Funktionen
      partialize: (state) => ({
        logs: state.logs,
        lastSnapshot: state.lastSnapshot,
      }),
    }
  )
);
