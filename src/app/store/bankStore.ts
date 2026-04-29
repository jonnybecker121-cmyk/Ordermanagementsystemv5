import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { projectId, publicAnonKey } from '../../../utils/supabase/info';

const SYNC_KEY = 'bank_data';
const SYNC_URL = `https://${projectId}.supabase.co/functions/v1/make-server-b50ee5dd/store/${SYNC_KEY}`;
const SYNC_HEADERS = {
  Authorization: `Bearer ${publicAnonKey}`,
  'Content-Type': 'application/json',
};

export interface BankAccount {
  id: string;
  name: string;
  vban: string;
  balance: number;
  note?: string;
}

export type TransactionType = 'incoming' | 'outgoing' | 'transfer';

export interface BankTransaction {
  id: string;
  accountId: string;
  counterAccountId?: string;
  type: TransactionType;
  amount: number;
  reference?: string;
  purpose?: string;
  timestamp: string;
}

interface BankState {
  accounts: BankAccount[];
  transactions: BankTransaction[];
  lastSyncedAt: number;
  syncStatus: 'idle' | 'pulling' | 'pushing' | 'error';
  syncError: string | null;
  addAccount: (data: Omit<BankAccount, 'id'>) => BankAccount;
  updateAccount: (id: string, patch: Partial<Omit<BankAccount, 'id'>>) => void;
  deleteAccount: (id: string) => void;
  addTransaction: (
    data: Omit<BankTransaction, 'id' | 'timestamp'> & { timestamp?: string }
  ) => BankTransaction;
  deleteTransaction: (id: string) => void;
  clearAll: () => void;
  pullFromServer: () => Promise<void>;
  pushToServer: () => Promise<void>;
}

const uid = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2) + Date.now().toString(36);

export const useBankStore = create<BankState>()(
  persist(
    (set, get) => {
      let pushTimer: ReturnType<typeof setTimeout> | null = null;
      const schedulePush = () => {
        if (pushTimer) clearTimeout(pushTimer);
        pushTimer = setTimeout(() => {
          get().pushToServer();
        }, 300);
      };

      return {
        accounts: [],
        transactions: [],
        lastSyncedAt: 0,
        syncStatus: 'idle',
        syncError: null,

        addAccount: (data) => {
          const account: BankAccount = { id: uid(), ...data };
          set((s) => ({ accounts: [...s.accounts, account] }));
          schedulePush();
          return account;
        },

        updateAccount: (id, patch) => {
          set((s) => ({
            accounts: s.accounts.map((a) => (a.id === id ? { ...a, ...patch } : a)),
          }));
          schedulePush();
        },

        deleteAccount: (id) => {
          set((s) => ({
            accounts: s.accounts.filter((a) => a.id !== id),
            transactions: s.transactions.filter(
              (t) => t.accountId !== id && t.counterAccountId !== id
            ),
          }));
          schedulePush();
        },

        addTransaction: (data) => {
          const tx: BankTransaction = {
            id: uid(),
            timestamp: data.timestamp ?? new Date().toISOString(),
            ...data,
          };

          const accounts = get().accounts.map((a) => {
            if (a.id === tx.accountId) {
              const delta =
                tx.type === 'incoming'
                  ? tx.amount
                  : tx.type === 'outgoing'
                  ? -tx.amount
                  : -tx.amount;
              return { ...a, balance: a.balance + delta };
            }
            if (tx.type === 'transfer' && a.id === tx.counterAccountId) {
              return { ...a, balance: a.balance + tx.amount };
            }
            return a;
          });

          set((s) => ({
            accounts,
            transactions: [tx, ...s.transactions],
          }));

          schedulePush();
          return tx;
        },

        deleteTransaction: (id) => {
          set((s) => {
            const tx = s.transactions.find((t) => t.id === id);
            if (!tx) return s;
            const accounts = s.accounts.map((a) => {
              if (a.id === tx.accountId) {
                const delta =
                  tx.type === 'incoming'
                    ? -tx.amount
                    : tx.type === 'outgoing'
                    ? tx.amount
                    : tx.amount;
                return { ...a, balance: a.balance + delta };
              }
              if (tx.type === 'transfer' && a.id === tx.counterAccountId) {
                return { ...a, balance: a.balance - tx.amount };
              }
              return a;
            });
            return {
              accounts,
              transactions: s.transactions.filter((t) => t.id !== id),
            };
          });
          schedulePush();
        },

        clearAll: () => {
          set({ accounts: [], transactions: [] });
          schedulePush();
        },

        pullFromServer: async () => {
          if (typeof navigator !== 'undefined' && navigator.onLine === false) {
            set({ syncStatus: 'error', syncError: 'Offline' });
            return;
          }
          set({ syncStatus: 'pulling', syncError: null });
          try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 8000);
            const res = await fetch(SYNC_URL, {
              headers: SYNC_HEADERS,
              signal: controller.signal,
            });
            clearTimeout(timeout);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const { data } = await res.json();
            if (data && Array.isArray(data.accounts)) {
              const serverSaved = data._savedAt || 0;
              const localSaved = get().lastSyncedAt || 0;
              if (serverSaved >= localSaved || get().accounts.length === 0) {
                set({
                  accounts: data.accounts,
                  transactions: Array.isArray(data.transactions)
                    ? data.transactions
                    : [],
                  lastSyncedAt: serverSaved || Date.now(),
                  syncStatus: 'idle',
                });
              } else {
                set({ syncStatus: 'idle' });
              }
            } else {
              set({ syncStatus: 'idle' });
            }
          } catch (err: any) {
            const msg = String(err?.message || err);
            set({ syncStatus: 'error', syncError: msg });
          }
        },

        pushToServer: async () => {
          if (typeof navigator !== 'undefined' && navigator.onLine === false) {
            set({ syncStatus: 'error', syncError: 'Offline' });
            return;
          }
          const { accounts, transactions } = get();
          set({ syncStatus: 'pushing', syncError: null });
          try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 8000);
            const res = await fetch(SYNC_URL, {
              method: 'POST',
              headers: SYNC_HEADERS,
              body: JSON.stringify({
                accounts,
                transactions,
                _savedAt: Date.now(),
              }),
              signal: controller.signal,
            });
            clearTimeout(timeout);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const json = await res.json();
            set({
              lastSyncedAt: json._savedAt || Date.now(),
              syncStatus: 'idle',
            });
          } catch (err: any) {
            const msg = String(err?.message || err);
            set({ syncStatus: 'error', syncError: msg });
          }
        },
      };
    },
    {
      name: 'schmelzdepot-bank',
      partialize: (s) => ({
        accounts: s.accounts,
        transactions: s.transactions,
        lastSyncedAt: s.lastSyncedAt,
      }),
      onRehydrateStorage: () => (state) => {
        // Nach Hydration aus localStorage direkt Supabase abfragen
        if (state) {
          setTimeout(() => {
            state.pullFromServer();
          }, 0);
        }
      },
    }
  )
);

// Periodischer Pull alle 30 Sekunden für Multi-Device Sync.
// Pause wenn der letzte Versuch fehlgeschlagen ist, um Fetch-Error-Spam zu vermeiden.
if (typeof window !== 'undefined') {
  setInterval(() => {
    const s = useBankStore.getState();
    if (s.syncStatus === 'idle') s.pullFromServer();
  }, 30_000);

  window.addEventListener('focus', () => {
    const s = useBankStore.getState();
    // Auch nach 'error' einmal erneut versuchen, wenn Nutzer zurückkehrt
    if (s.syncStatus === 'idle' || s.syncStatus === 'error') s.pullFromServer();
  });

  window.addEventListener('online', () => {
    const s = useBankStore.getState();
    if (s.syncStatus === 'error') s.pullFromServer();
  });
}
