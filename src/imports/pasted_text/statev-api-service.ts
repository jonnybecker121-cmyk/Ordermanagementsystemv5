const API_BASE_URL = 'https://api.statev.de/req';
const API_KEY = 'IPIMSTJVSLFMK3JM1P';
const API_SECRET = 'aa002ebf141bc823f6c768f3bdb500fd34b0efb656f11d70';
const FACTORY_ID = '65ce2e98e3a3ab88426f2794';

interface Factory {
  id: string;
  name: string;
  adLine: string;
  isOpen: boolean;
  type: string;
  address: string;
}

interface InventoryItem {
  item: string;
  amount: number;
  singleWeight: number;
  totalWeight: number;
  icon?: string;
}

interface Inventory {
  totalWeight: number;
  items: InventoryItem[];
}

interface BankAccount {
  id: string;
  vban: string;
  balance: number;
  note: string;
}

interface Transaction {
  senderVban: number;
  receiverVban: number;
  reference: string;
  purpose?: string;
  amount: number;
  timestamp: Date | string;
  type?: 'incoming' | 'outgoing';
}

interface TransactionResponse {
  totalTransactions: number;
  transactions: Transaction[];
}

interface FactoryOption {
  title: string;
  data: string;
  lastUpdate: Date;
}

interface NeededItem {
  name: string;
  amount: number;
}

interface Production {
  item: string;
  icon: string;
  neededItems: NeededItem[];
}

interface SellOffer {
  item: string;
  listPrice: number;
  pricePerUnit: number;
  totalPrice: number;
  availableAmount: number;
  createdAt: Date | string;
}

interface BuyOffer {
  item: string;
  pricePerUnit: number;
  totalPrice: number;
  availableAmount: number;
  createdAt: Date | string;
}

interface PurchaseLogItem {
  name: string;
  amount: number;
}

interface PurchaseLog {
  seller: string;
  buyer: string;
  price: number;
  discount: number;
  items: PurchaseLogItem[];
  createdAt: Date | string;
}

class StatevApiService {
  private async makeRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      throw new Error(`API Error: ${response.status} ${response.statusText}`);
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
          apiSecret: API_SECRET,
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

  async getFactoryMarketSellOffers(factoryId: string = FACTORY_ID): Promise<SellOffer[]> {
    try {
      return await this.makeRequest<SellOffer[]>(`/factory/marketoffers/sell/${factoryId}`);
    } catch (error) {
      console.warn('Using mock sell offers:', error);
      // Return mock data with correct Dashboard format
      return [
        {
          item: 'Goldbarren 100g 999.9',
          listPrice: 6225.00,
          pricePerUnit: 6550.00,
          totalPrice: 32750.00,
          availableAmount: 5,
          createdAt: new Date().toISOString(),
        },
        {
          item: 'Silberbarren 1kg 999',
          listPrice: 807.50,
          pricePerUnit: 850.00,
          totalPrice: 8500.00,
          availableAmount: 10,
          createdAt: new Date().toISOString(),
        },
        {
          item: 'Platinbarren 50g 999.5',
          listPrice: 1353.75,
          pricePerUnit: 1425.00,
          totalPrice: 7125.00,
          availableAmount: 3,
          createdAt: new Date().toISOString(),
        }
      ] as SellOffer[];
    }
  }

  async getFactoryMarketBuyOffers(factoryId: string = FACTORY_ID): Promise<BuyOffer[]> {
    try {
      return await this.makeRequest<BuyOffer[]>(`/factory/marketoffers/buy/${factoryId}`);
    } catch (error) {
      console.warn('Using mock buy offers:', error);
      // Return mock data with correct Dashboard format
      return [
        {
          item: 'Altgold gemischt',
          pricePerUnit: 45.50,
          totalPrice: 4550.00,
          availableAmount: 100,
          createdAt: new Date().toISOString(),
        },
        {
          item: 'Silberschrott 925',
          pricePerUnit: 0.65,
          totalPrice: 650.00,
          availableAmount: 1000,
          createdAt: new Date().toISOString(),
        }
      ] as BuyOffer[];
    }
  }

  async getFactoryBuyLog(factoryId: string = FACTORY_ID, limit: number = 50, skip: number = 0): Promise<PurchaseLog[]> {
    try {
      return await this.makeRequest<PurchaseLog[]>(`/factory/buyLog/${factoryId}/${limit}/${skip}`);
    } catch (error) {
      console.warn('Using mock purchase log:', error);
      // Return mock data - PurchaseLog has items array
      return [
        {
          seller: 'Goldhandel GmbH',
          buyer: 'SCHMELZDEPOT',
          price: 6550.00,
          discount: 0,
          items: [
            {
              name: 'Goldbarren 50g',
              amount: 2
            }
          ],
          createdAt: new Date().toISOString(),
        },
        {
          seller: 'Edelmetall AG',
          buyer: 'SCHMELZDEPOT',
          price: 285.00,
          discount: 5,
          items: [
            {
              name: 'Silbermünzen 1oz',
              amount: 10
            }
          ],
          createdAt: new Date(Date.now() - 86400000).toISOString(),
        }
      ] as PurchaseLog[];
    }
  }
}

export { FACTORY_ID };

export const statevApi = new StatevApiService();
export type { Factory, InventoryItem, Inventory, BankAccount, Transaction, TransactionResponse, FactoryOption, Production, NeededItem, SellOffer, BuyOffer, PurchaseLog, PurchaseLogItem };