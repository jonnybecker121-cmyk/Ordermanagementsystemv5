import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { projectId, publicAnonKey } from '../../../utils/supabase/info';

export interface PaymentNote {
  id: string;
  title: string;
  content: string;
  isDefault: boolean;
}

interface InvoiceState {
  paymentNotes: PaymentNote[];
  _lastSavedAt: number;

  addPaymentNote: (title: string, content: string) => void;
  updatePaymentNote: (id: string, title: string, content: string) => void;
  deletePaymentNote: (id: string) => void;
  setDefaultPaymentNote: (id: string) => void;
  getDefaultPaymentNote: () => PaymentNote | undefined;

  loadFromBackend: () => Promise<boolean>;
  saveToBackend: () => Promise<void>;
}

const defaultPaymentNotes: PaymentNote[] = [
  {
    id: 'default-note',
    title: 'Standard',
    content: 'Bitte überweisen Sie den Betrag innerhalb von 14 Tagen ohne Abzug.',
    isDefault: true,
  },
];

const BASE_URL = `https://${projectId}.supabase.co/functions/v1/make-server-b50ee5dd`;

const AUTH_HEADERS = {
  'Authorization': `Bearer ${publicAnonKey}`,
  'Content-Type': 'application/json',
};

export const useInvoiceStore = create<InvoiceState>()(
  persist(
    (set, get) => ({
      paymentNotes: defaultPaymentNotes,
      _lastSavedAt: 0,

      // Returns true if new data was applied from server
      loadFromBackend: async (): Promise<boolean> => {
        try {
          const response = await fetch(`${BASE_URL}/store/invoice_data`, {
            headers: AUTH_HEADERS,
          });
          if (!response.ok) return false;

          const { data } = await response.json();
          if (!data) return false;

          const serverTs: number = data._savedAt || 0;
          const localTs: number = get()._lastSavedAt;

          if (serverTs <= localTs) return false;

          set({
            paymentNotes: data.paymentNotes || defaultPaymentNotes,
            _lastSavedAt: serverTs,
          });
          return true;
        } catch (error) {
          console.error('InvoiceStore: Backend-Load fehlgeschlagen, nutze LocalStorage-Cache:', error);
          return false;
        }
      },

      saveToBackend: async () => {
        const state = get();
        const timestamp = Date.now();
        try {
          const res = await fetch(`${BASE_URL}/store/invoice_data`, {
            method: 'POST',
            headers: AUTH_HEADERS,
            body: JSON.stringify({
              paymentNotes: state.paymentNotes,
              _savedAt: timestamp,
            }),
          });
          if (res.ok) {
            set({ _lastSavedAt: timestamp });
          }
        } catch (error) {
          console.error('InvoiceStore: Backend-Save fehlgeschlagen, Daten im LocalStorage gesichert:', error);
        }
      },

      addPaymentNote: (title, content) => {
        set((state) => ({
          paymentNotes: [
            ...state.paymentNotes,
            {
              id: `note-${Date.now()}`,
              title,
              content,
              isDefault: state.paymentNotes.length === 0,
            },
          ],
        }));
        get().saveToBackend();
      },

      updatePaymentNote: (id, title, content) => {
        set((state) => ({
          paymentNotes: state.paymentNotes.map((n) =>
            n.id === id ? { ...n, title, content } : n
          ),
        }));
        get().saveToBackend();
      },

      deletePaymentNote: (id) => {
        set((state) => ({
          paymentNotes: state.paymentNotes.filter((n) => n.id !== id),
        }));
        get().saveToBackend();
      },

      setDefaultPaymentNote: (id) => {
        set((state) => ({
          paymentNotes: state.paymentNotes.map((n) => ({
            ...n,
            isDefault: n.id === id,
          })),
        }));
        get().saveToBackend();
      },

      getDefaultPaymentNote: () => get().paymentNotes.find((n) => n.isDefault),
    }),
    {
      name: 'schmelzdepot-invoice-store',
      partialize: (state) => ({
        paymentNotes: state.paymentNotes,
        _lastSavedAt: state._lastSavedAt,
      }),
    }
  )
);