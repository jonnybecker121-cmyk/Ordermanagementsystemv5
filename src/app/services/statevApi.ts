// Direkte StateV-API-Calls (ohne Supabase-Proxy)
const STATEV_BASE = 'https://api.statev.de/req';
const STATEV_API_KEY = 'QE5362BXWBQGS89EE7';
const STATEV_API_SECRET = 'fd46295715a3b222ad75ea34daecf050e69b1c753dd8dd54';

const STATEV_HEADERS = {
  'Authorization': `Bearer ${STATEV_API_KEY}`,
  'Content-Type': 'application/json',
};

const FACTORY_ID = '65ce2e98e3a3ab88426f2794';

export interface Factory {
  id: string;
  name: string;
  adLine: string;
  isOpen: boolean;
  type: string;
  address: string;
}

export interface InventoryItem {
  item: string;
  amount: number;
  singleWeight: number;
  totalWeight: number;
  icon?: string;
}

export interface Inventory {
  totalWeight: number;
  items: InventoryItem[];
}

export interface BankAccount {
  id: string;
  vban: string;
  balance: number;
  note: string;
}

export interface Transaction {
  senderVban: number;
  receiverVban: number;
  reference: string;
  purpose?: string;
  amount: number;
  timestamp: Date | string;
  type?: 'incoming' | 'outgoing';
}

export interface TransactionResponse {
  totalTransactions: number;
  transactions: Transaction[];
}

export interface FactoryOption {
  title: string;
  data: string;
  lastUpdate: Date;
}

export interface NeededItem {
  name: string;
  amount: number;
}

export interface Production {
  item: string;
  icon: string;
  neededItems: NeededItem[];
}

export interface SellOffer {
  item: string;
  listPrice: number;
  pricePerUnit: number;
  totalPrice: number;
  availableAmount: number;
  createdAt: Date | string;
}

export interface BuyOffer {
  item: string;
  pricePerUnit: number;
  totalPrice: number;
  availableAmount: number;
  createdAt: Date | string;
}

export interface PurchaseLogItem {
  name: string;
  amount: number;
}

export interface PurchaseLog {
  seller: string;
  buyer: string;
  price: number;
  discount: number;
  items: PurchaseLogItem[];
  createdAt: Date | string;
}

class StatevApiService {
  private async makeRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const response = await fetch(`${STATEV_BASE}${endpoint}`, {
      ...options,
      headers: {
        ...STATEV_HEADERS,
        ...options.headers,
      },
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new Error(`StateV API Error ${response.status}: ${text || response.statusText}`);
    }

    return await response.json();
  }

  async getFactoryList(): Promise<Factory[]> {
    return this.makeRequest<Factory[]>('/factory/list/');
  }

  async getFactoryInventory(factoryId: string = FACTORY_ID): Promise<Inventory> {
    return this.makeRequest<Inventory>(`/factory/inventory/${factoryId}`);
  }

  async getFactoryMachines(factoryId: string = FACTORY_ID): Promise<Inventory> {
    return this.makeRequest<Inventory>(`/factory/machine/${factoryId}`);
  }

  async getFactoryBankAccounts(factoryId: string = FACTORY_ID): Promise<BankAccount[]> {
    return this.makeRequest<BankAccount[]>(`/factory/bankaccounts/${factoryId}`);
  }

  async getTransactions(bankId: string, limit: number = 50, offset: number = 0): Promise<TransactionResponse> {
    return this.makeRequest<TransactionResponse>(`/factory/transactions/${bankId}/${limit}/${offset}`);
  }

  async getFactoryOption(factoryId: string, option: number): Promise<FactoryOption> {
    return this.makeRequest<FactoryOption>(`/factory/options/${factoryId}/${option}`);
  }

  async saveFactoryOption(factoryId: string = FACTORY_ID, option: number, title: string, data: string): Promise<any> {
    return this.makeRequest('/factory/options', {
      method: 'POST',
      body: JSON.stringify({
        request: {
          factoryId,
          option,
          title: title.substring(0, 64),
          data: data.substring(0, 2400),
          apiSecret: STATEV_API_SECRET,
        },
      }),
    });
  }

  async getFactoryProductions(factoryId: string): Promise<Production[]> {
    return this.makeRequest<Production[]>(`/factory/productions/${factoryId}`);
  }

  async getFactoryMarketSellOffers(factoryId: string = FACTORY_ID): Promise<SellOffer[]> {
    return this.makeRequest<SellOffer[]>(`/factory/marketoffers/sell/${factoryId}`);
  }

  async getFactoryMarketBuyOffers(factoryId: string = FACTORY_ID): Promise<BuyOffer[]> {
    return this.makeRequest<BuyOffer[]>(`/factory/marketoffers/buy/${factoryId}`);
  }

  async getFactoryBuyLog(factoryId: string = FACTORY_ID, limit: number = 50, skip: number = 0): Promise<PurchaseLog[]> {
    return this.makeRequest<PurchaseLog[]>(`/factory/buyLog/${factoryId}/${limit}/${skip}`);
  }
}

export { FACTORY_ID };

export const statevApi = new StatevApiService();
export type { Factory, InventoryItem, Inventory, BankAccount, Transaction, TransactionResponse, FactoryOption, Production, NeededItem, SellOffer, BuyOffer, PurchaseLog, PurchaseLogItem };
