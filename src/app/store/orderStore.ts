import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { projectId, publicAnonKey } from '../../../utils/supabase/info';

export interface OrderItem {
  name: string;
  price: number;
  qty: number;
  disc: number;
}

export interface Order {
  id: string;
  number: string;
  ref: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  items: OrderItem[];
  status: 'Ausstehend' | 'In Bearbeitung' | 'Warten auf Zahlung' | 'Gezahlt' | 'Abgeschlossen';
  createdAt: string;
  finishedAt?: string;
  completedAt?: string;
  paidAt?: string;
  taxRate: number;
  taxSign: 'plus' | 'minus';
  archived?: boolean;
}

export interface Customer {
  id: string;
  name: string;
  email: string;
  phone: string;
}

export interface Item {
  id: string;
  name: string;
  price: number;
}

interface OrderState {
  ordersOpen: Order[];
  ordersDone: Order[];
  ordersArchive: Order[];
  customers: Customer[];
  items: Item[];

  // Settings
  orderPrefix: string;
  orderDigits: number;
  nextCounter: number;

  // Sync tracking
  _lastSavedAt: number;

  isLoading: boolean;

  // Actions
  loadFromBackend: () => Promise<boolean>;
  saveToBackend: () => Promise<void>;

  createOrder: (data: Partial<Order>) => void;
  updateOrder: (id: string, data: Partial<Order>) => void;
  deleteOrder: (id: string) => void;
  moveOrderToCompleted: (id: string) => void;
  reopenOrder: (id: string) => void;
  archiveOrder: (id: string) => void;
  unarchiveOrder: (id: string) => void;
  restoreFromArchive: (id: string) => void;
  deleteFromArchive: (id: string) => void;
  moveToArchive: (id: string) => void;
  autoArchiveCompleted: () => void;

  // Customer & Item Actions
  addCustomer: (customer: Omit<Customer, 'id'>) => void;
  updateCustomer: (id: string, data: Partial<Customer>) => void;
  deleteCustomer: (id: string) => void;
  addItem: (item: Omit<Item, 'id'>) => void;
  updateItem: (id: string, data: Partial<Item>) => void;
  deleteItem: (id: string) => void;

  // Settings Actions
  updateSettings: (settings: { prefix: string; digits: number; counter: number }) => void;
}

const defaultCustomers: Customer[] = [
  { id: 'cust-1', name: 'Nika_May', email: 'Nika_May@statev.de', phone: '' },
  { id: 'cust-2', name: 'Titus_Gruber', email: 'Titus_Gruber@statev.de', phone: '' },
  { id: 'cust-3', name: 'Jannis_Cain', email: 'Jannis_Cain@statev.de', phone: '' },
  { id: 'cust-4', name: 'Eric_Ludwig', email: 'Eric_Ludwig@statev.de', phone: '' },
  { id: 'cust-5', name: 'CarFactoryGambinoCo', email: 'CarFactoryGambinoCo@statev.de', phone: '' },
  { id: 'cust-6', name: 'hyped', email: 'hyped@statev.de', phone: '' },
  { id: 'cust-7', name: 'Nexus Corp', email: 'Jannis_Cain@statev.de', phone: '' },
  { id: 'cust-8', name: 'Andre_Johnson', email: 'Andre_Johnson@statev.de', phone: '' },
  { id: 'cust-9', name: 'PDM Motors', email: 'Valea_Machiavelli@statev.de', phone: '' },
  { id: 'cust-10', name: 'Hope-Production', email: 'Lucia_Lorenzi@statev.de', phone: '' },
  { id: 'cust-11', name: 'Robert_Finster', email: 'Robert_Finster@statev.de', phone: '' },
];

const defaultItems: Item[] = [
  { id: 'item-1', name: 'Messingbarren', price: 85.00 },
  { id: 'item-2', name: 'Sack Glasgranulat', price: 10.50 },
  { id: 'item-3', name: 'Pappe', price: 1.00 },
  { id: 'item-4', name: 'Tannenholz', price: 1.00 },
  { id: 'item-5', name: 'Eisenbarren', price: 17.00 },
  { id: 'item-6', name: 'Kupferbarren', price: 22.00 },
  { id: 'item-7', name: 'Silberbarren', price: 25.00 },
  { id: 'item-8', name: 'Stahlbarren', price: 56.00 },
  { id: 'item-9', name: 'Goldbarren', price: 65.00 },
];

const BASE_URL = `https://${projectId}.supabase.co/functions/v1/make-server-b50ee5dd`;

const AUTH_HEADERS = {
  'Authorization': `Bearer ${publicAnonKey}`,
  'Content-Type': 'application/json',
};

export const useOrderStore = create<OrderState>()(
  persist(
    (set, get) => ({
      ordersOpen: [],
      ordersDone: [],
      ordersArchive: [],
      customers: defaultCustomers,
      items: defaultItems,

      orderPrefix: 'SD',
      orderDigits: 4,
      nextCounter: 1145,
      _lastSavedAt: 0,
      isLoading: false,

      // Returns true if new data was applied from server
      loadFromBackend: async (): Promise<boolean> => {
        try {
          const response = await fetch(`${BASE_URL}/store/full_data`, {
            headers: AUTH_HEADERS,
          });
          if (!response.ok) return false;

          const { data } = await response.json();
          if (!data) return false;

          const serverTs: number = data._savedAt || 0;
          const localTs: number = get()._lastSavedAt;

          // Nur anwenden wenn Server neuer ist
          if (serverTs <= localTs) return false;

          set({
            ordersOpen: data.ordersOpen || [],
            ordersDone: data.ordersDone || [],
            ordersArchive: data.ordersArchive || [],
            customers: data.customers?.length > 0 ? data.customers : defaultCustomers,
            items: data.items?.length > 0 ? data.items : defaultItems,
            orderPrefix: data.orderPrefix || 'SD',
            orderDigits: data.orderDigits || 4,
            nextCounter: data.nextCounter || 1145,
            _lastSavedAt: serverTs,
          });
          return true;
        } catch (error) {
          console.error('OrderStore: Backend-Load fehlgeschlagen, nutze LocalStorage-Cache:', error);
          return false;
        }
      },

      saveToBackend: async () => {
        const state = get();
        if (state.isLoading) return;

        const timestamp = Date.now();
        const dataToSave = {
          ordersOpen: state.ordersOpen,
          ordersDone: state.ordersDone,
          ordersArchive: state.ordersArchive,
          customers: state.customers,
          items: state.items,
          orderPrefix: state.orderPrefix,
          orderDigits: state.orderDigits,
          nextCounter: state.nextCounter,
          _savedAt: timestamp,
        };

        try {
          const res = await fetch(`${BASE_URL}/store/full_data`, {
            method: 'POST',
            headers: AUTH_HEADERS,
            body: JSON.stringify(dataToSave),
          });
          if (res.ok) {
            set({ _lastSavedAt: timestamp });
          }
        } catch (error) {
          console.error('OrderStore: Backend-Save fehlgeschlagen, Daten im LocalStorage gesichert:', error);
        }
      },

      createOrder: (data) => {
        set((state) => {
          const orderNumber = `${state.orderPrefix}${String(state.nextCounter).padStart(state.orderDigits, '0')}`;
          const newOrder: Order = {
            id: `ord-${Date.now()}`,
            number: orderNumber,
            ref: '',
            customerName: '',
            customerEmail: '',
            customerPhone: '',
            items: [],
            status: 'Ausstehend',
            createdAt: new Date().toISOString(),
            taxRate: 0,
            taxSign: 'plus',
            ...data,
          };
          return {
            ordersOpen: [newOrder, ...state.ordersOpen],
            nextCounter: state.nextCounter + 1,
          };
        });
        get().saveToBackend();
      },

      updateOrder: (id, data) => {
        set((state) => {
          const updateInList = (list: Order[]) =>
            list.map((o) => {
              if (o.id !== id) return o;
              const updated = { ...o, ...data };
              if (data.status === 'Abgeschlossen' && o.status !== 'Abgeschlossen')
                updated.completedAt = new Date().toISOString();
              if (data.status === 'Gezahlt' && o.status !== 'Gezahlt')
                updated.paidAt = new Date().toISOString();
              return updated;
            });

          const orderInOpen = state.ordersOpen.find((o) => o.id === id);
          if (orderInOpen && (data.status === 'Gezahlt' || data.status === 'Abgeschlossen')) {
            const updatedOrder = { ...orderInOpen, ...data };
            if (data.status === 'Gezahlt' && !updatedOrder.paidAt)
              updatedOrder.paidAt = new Date().toISOString();
            if (data.status === 'Abgeschlossen' && !updatedOrder.completedAt)
              updatedOrder.completedAt = new Date().toISOString();
            return {
              ordersOpen: state.ordersOpen.filter((o) => o.id !== id),
              ordersDone: [updatedOrder, ...state.ordersDone],
            };
          }

          const orderInDone = state.ordersDone.find((o) => o.id === id);
          if (
            orderInDone &&
            (data.status === 'Ausstehend' ||
              data.status === 'In Bearbeitung' ||
              data.status === 'Warten auf Zahlung')
          ) {
            const updatedOrder = { ...orderInDone, ...data };
            return {
              ordersDone: state.ordersDone.filter((o) => o.id !== id),
              ordersOpen: [updatedOrder, ...state.ordersOpen],
            };
          }

          return {
            ordersOpen: updateInList(state.ordersOpen),
            ordersDone: updateInList(state.ordersDone),
            ordersArchive: updateInList(state.ordersArchive),
          };
        });
        get().saveToBackend();
      },

      deleteOrder: (id) => {
        set((state) => ({
          ordersOpen: state.ordersOpen.filter((o) => o.id !== id),
          ordersDone: state.ordersDone.filter((o) => o.id !== id),
          ordersArchive: state.ordersArchive.filter((o) => o.id !== id),
        }));
        get().saveToBackend();
      },

      moveOrderToCompleted: (id) => get().updateOrder(id, { status: 'Abgeschlossen' }),
      reopenOrder: (id) => get().updateOrder(id, { status: 'In Bearbeitung' }),

      archiveOrder: (id) => {
        set((state) => {
          const order = state.ordersDone.find((o) => o.id === id);
          if (!order) return {};
          return {
            ordersDone: state.ordersDone.filter((o) => o.id !== id),
            ordersArchive: [{ ...order, archived: true }, ...state.ordersArchive],
          };
        });
        get().saveToBackend();
      },

      moveToArchive: (id) => get().archiveOrder(id),

      unarchiveOrder: (id) => {
        set((state) => {
          const order = state.ordersArchive.find((o) => o.id === id);
          if (!order) return {};
          return {
            ordersArchive: state.ordersArchive.filter((o) => o.id !== id),
            ordersDone: [{ ...order, archived: false }, ...state.ordersDone],
          };
        });
        get().saveToBackend();
      },

      restoreFromArchive: (id) => get().unarchiveOrder(id),

      deleteFromArchive: (id) => {
        set((state) => ({
          ordersArchive: state.ordersArchive.filter((o) => o.id !== id),
        }));
        get().saveToBackend();
      },

      autoArchiveCompleted: () => {
        set((state) => {
          const now = Date.now();
          const oneHour = 60 * 60 * 1000;
          const toArchive = state.ordersDone.filter((o) => {
            if (o.status !== 'Abgeschlossen') return false;
            const timeRef = o.completedAt ? new Date(o.completedAt).getTime() : 0;
            return timeRef > 0 && now - timeRef > oneHour;
          });
          if (toArchive.length === 0) return {};
          const ids = new Set(toArchive.map((o) => o.id));
          return {
            ordersDone: state.ordersDone.filter((o) => !ids.has(o.id)),
            ordersArchive: [...toArchive.map((o) => ({ ...o, archived: true })), ...state.ordersArchive],
          };
        });
        get().saveToBackend();
      },

      addCustomer: (customer) => {
        set((state) => ({
          customers: [...state.customers, { ...customer, id: `cust-${Date.now()}` }],
        }));
        get().saveToBackend();
      },
      updateCustomer: (id, data) => {
        set((state) => ({
          customers: state.customers.map((c) => (c.id === id ? { ...c, ...data } : c)),
        }));
        get().saveToBackend();
      },
      deleteCustomer: (id) => {
        set((state) => ({
          customers: state.customers.filter((c) => c.id !== id),
        }));
        get().saveToBackend();
      },

      addItem: (item) => {
        set((state) => ({
          items: [...state.items, { ...item, id: `item-${Date.now()}` }],
        }));
        get().saveToBackend();
      },
      updateItem: (id, data) => {
        set((state) => ({
          items: state.items.map((i) => (i.id === id ? { ...i, ...data } : i)),
        }));
        get().saveToBackend();
      },
      deleteItem: (id) => {
        set((state) => ({
          items: state.items.filter((i) => i.id !== id),
        }));
        get().saveToBackend();
      },

      updateSettings: (settings) => {
        set({
          orderPrefix: settings.prefix,
          orderDigits: settings.digits,
          nextCounter: settings.counter,
        });
        get().saveToBackend();
      },
    }),
    {
      name: 'schmelzdepot-order-store',
      partialize: (state) => ({
        ordersOpen: state.ordersOpen,
        ordersDone: state.ordersDone,
        ordersArchive: state.ordersArchive,
        customers: state.customers,
        items: state.items,
        orderPrefix: state.orderPrefix,
        orderDigits: state.orderDigits,
        nextCounter: state.nextCounter,
        _lastSavedAt: state._lastSavedAt,
      }),
    }
  )
);