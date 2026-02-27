import { projectId, publicAnonKey } from '../../../utils/supabase/info';

// Alle StateV-Calls laufen über den Backend-Proxy, der den API-Secret
// aus der Umgebungsvariable STATEV_API_SECRET liest.
const PROXY_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-b50ee5dd/statev`;

const PROXY_HEADERS = {
  'Authorization': `Bearer ${publicAnonKey}`,
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
    const response = await fetch(`${PROXY_BASE}${endpoint}`, {
      ...options,
      headers: {
        ...PROXY_HEADERS,
        ...options.headers,
      },
    });

    if (!response.ok) {
      let details = '';
      try {
        const body = await response.json();
        details = body?.details || body?.error || '';
      } catch {
        // ignore parse errors
      }
      throw new Error(
        `StateV API Fehler ${response.status} ${response.statusText}${details ? ': ' + details : ''}`
      );
    }

    return await response.json();
  }

  async getFactoryList(): Promise<Factory[]> {
    try {
      return await this.makeRequest<Factory[]>('/factory/list/');
    } catch (error) {
      console.debug('Using mock factory list:', error);
      return [{
        id: FACTORY_ID,
        name: 'SCHMELZDEPOT',
        adLine: 'Edelmetalle & Recycling',
        isOpen: true,
        type: 'Factory',
        address: 'Los Santos'
      }];
    }
  }

  // ── Kein Mock-Fallback – echte API-Daten oder Fehler ──────────────────────

  async getFactoryInventory(factoryId: string = FACTORY_ID): Promise<Inventory> {
    return this.makeRequest<Inventory>(`/factory/inventory/${factoryId}`);
  }

  async getFactoryMachines(factoryId: string = FACTORY_ID): Promise<Inventory> {
    return this.makeRequest<Inventory>(`/factory/machine/${factoryId}`);
  }

  // ── Mock-Fallback bleibt für Bank / Transaktionen ─────────────────────────

  async getFactoryBankAccounts(factoryId: string = FACTORY_ID): Promise<BankAccount[]> {
    try {
      return await this.makeRequest<BankAccount[]>(`/factory/bankaccounts/${factoryId}`);
    } catch (error) {
      console.debug('Using mock bank accounts:', error);
      return [
        { id: '1', vban: 'DE89 3704 0044 0532 0130 00', balance: 125000.50, note: 'Geschäftskonto Haupt' },
        { id: '2', vban: 'DE89 3704 0044 0532 0130 01', balance: 5430.00, note: 'Kasse' }
      ];
    }
  }

  async getTransactions(bankId: string, limit: number = 50, offset: number = 0): Promise<TransactionResponse> {
    try {
      return await this.makeRequest<TransactionResponse>(`/factory/transactions/${bankId}/${limit}/${offset}`);
    } catch (error) {
      console.debug('Using mock transactions:', error);
      return {
        totalTransactions: 3,
        transactions: [
          { senderVban: 123456, receiverVban: 987654, reference: 'Zahlung Auftrag #1023', amount: 1500.00, timestamp: new Date().toISOString(), type: 'incoming' },
          { senderVban: 987654, receiverVban: 111222, reference: 'Materialeinkauf Stahl', amount: -450.20, timestamp: new Date(Date.now() - 86400000).toISOString(), type: 'outgoing' },
          { senderVban: 555666, receiverVban: 987654, reference: 'Gutschrift', amount: 250.00, timestamp: new Date(Date.now() - 172800000).toISOString(), type: 'incoming' },
        ]
      };
    }
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
        },
      }),
    });
  }

  async getFactoryProductions(factoryId: string): Promise<Production[]> {
    return this.makeRequest<Production[]>(`/factory/productions/${factoryId}`);
  }

  // ── Kein Mock-Fallback – echte API-Daten oder Fehler ──────────────────────

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