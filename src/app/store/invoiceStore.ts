import { create } from 'zustand';
import { projectId } from '../../../utils/supabase/info';

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
  
  loadFromBackend: () => Promise<void>;
  saveToBackend: () => Promise<void>;
}

export const useInvoiceStore = create<InvoiceState>((set, get) => ({
  paymentNotes: [
    {
      id: 'default-note',
      title: 'Standard',
      content: 'Bitte überweisen Sie den Betrag innerhalb von 14 Tagen ohne Abzug.',
      isDefault: true
    }
  ],
  
  loadFromBackend: async () => {
    try {
      const response = await fetch(`https://${projectId}.supabase.co/functions/v1/make-server-b50ee5dd/store/invoice_data`);
      if (response.ok) {
        const { data } = await response.json();
        if (data) {
          set({
            paymentNotes: data.paymentNotes || [
              {
                id: 'default-note',
                title: 'Standard',
                content: 'Bitte überweisen Sie den Betrag innerhalb von 14 Tagen ohne Abzug.',
                isDefault: true
              }
            ]
          });
        }
      }
    } catch (error) {
      console.error('Failed to load invoice data', error);
    }
  },
  
  saveToBackend: async () => {
    const state = get();
    try {
      await fetch(`https://${projectId}.supabase.co/functions/v1/make-server-b50ee5dd/store/invoice_data`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paymentNotes: state.paymentNotes
        })
      });
    } catch (error) {
      console.error('Failed to save invoice data', error);
    }
  },
  
  addPaymentNote: (title, content) => {
    set((state) => ({
      paymentNotes: [...state.paymentNotes, {
        id: `note-${Date.now()}`,
        title,
        content,
        isDefault: state.paymentNotes.length === 0
      }]
    }));
    get().saveToBackend();
  },
  
  updatePaymentNote: (id, title, content) => {
    set((state) => ({
      paymentNotes: state.paymentNotes.map(n => n.id === id ? { ...n, title, content } : n)
    }));
    get().saveToBackend();
  },
  
  deletePaymentNote: (id) => {
    set((state) => ({
      paymentNotes: state.paymentNotes.filter(n => n.id !== id)
    }));
    get().saveToBackend();
  },
  
  setDefaultPaymentNote: (id) => {
    set((state) => ({
      paymentNotes: state.paymentNotes.map(n => ({
        ...n,
        isDefault: n.id === id
      }))
    }));
    get().saveToBackend();
  },
  
  getDefaultPaymentNote: () => get().paymentNotes.find(n => n.isDefault)
}));
