import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface PaymentNote {
  id: string;
  title: string;
  content: string;
  isDefault: boolean;
}

interface InvoiceState {
  paymentNotes: PaymentNote[];

  addPaymentNote: (title: string, content: string) => void;
  updatePaymentNote: (id: string, title: string, content: string) => void;
  deletePaymentNote: (id: string) => void;
  setDefaultPaymentNote: (id: string) => void;
  getDefaultPaymentNote: () => PaymentNote | undefined;
}

const defaultPaymentNotes: PaymentNote[] = [
  {
    id: 'default-note',
    title: 'Standard',
    content: 'Bitte überweisen Sie den Betrag innerhalb von 14 Tagen ohne Abzug.',
    isDefault: true,
  },
];

export const useInvoiceStore = create<InvoiceState>()(
  persist(
    (set, get) => ({
      paymentNotes: defaultPaymentNotes,

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
      },

      updatePaymentNote: (id, title, content) => {
        set((state) => ({
          paymentNotes: state.paymentNotes.map((n) =>
            n.id === id ? { ...n, title, content } : n
          ),
        }));
      },

      deletePaymentNote: (id) => {
        set((state) => ({
          paymentNotes: state.paymentNotes.filter((n) => n.id !== id),
        }));
      },

      setDefaultPaymentNote: (id) => {
        set((state) => ({
          paymentNotes: state.paymentNotes.map((n) => ({
            ...n,
            isDefault: n.id === id,
          })),
        }));
      },

      getDefaultPaymentNote: () => get().paymentNotes.find((n) => n.isDefault),
    }),
    {
      name: 'schmelzdepot-invoice-store',
    }
  )
);
