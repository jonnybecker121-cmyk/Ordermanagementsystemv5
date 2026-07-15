// Service für die "StateV" Factory-Markt-API.
// Die Aufrufe gehen an unsere eigene Edge-Function-Route (Proxy), die den
// STATEV_API_KEY serverseitig setzt. Der Key wird NIE ans Frontend ausgeliefert.
import { projectId, publicAnonKey } from "/utils/supabase/info";

export interface Factory {
  id: string;
  name: string;
  hash?: string;
  isOpen?: boolean;
  type?: string;
  address?: string;
}

export interface SellOffer {
  item: string;
  listPrice?: number;
  pricePerUnit: number;
  totalPrice: number;
  availableAmount: number;
  createdAt: string;
  icon?: string | null;
}

export interface BuyOffer {
  item: string;
  listPrice?: number;
  pricePerUnit: number;
  totalPrice: number;
  availableAmount: number;
  createdAt: string;
  icon?: string | null;
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
  createdAt: string;
}

export interface InventoryEntry {
  item: string;
  amount: number;
  singleWeight: number;
  totalWeight: number;
  price?: number;
  icon?: string | null;
}

export interface Inventory {
  totalWeight: number;
  items: InventoryEntry[];
}

const BASE = `https://${projectId}.supabase.co/functions/v1/make-server-d632b7fe/statev`;

/** Wird geworfen, wenn die State-V-Anbindung serverseitig noch nicht konfiguriert ist. */
class StateVNotConfiguredError extends Error {}

async function request<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { Authorization: `Bearer ${publicAnonKey}` },
  });

  const text = await res.text();
  let body: any;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }

  if (!res.ok) {
    const detail = body?.error || body?.upstream || text || res.statusText;
    // Fehlende Konfiguration (Basis-URL/Key) ist kein Laufzeitfehler, sondern ein
    // "noch nicht eingerichtet"-Zustand → sauber als leer behandeln.
    if (res.status === 500 && typeof detail === "string" && detail.includes("nicht konfiguriert")) {
      throw new StateVNotConfiguredError(detail);
    }
    throw new Error(`State-V Request '${path}' fehlgeschlagen (${res.status}): ${detail}`);
  }
  return body as T;
}

/** Führt eine Request aus; bei fehlender Konfiguration wird still ein Leerwert geliefert. */
async function requestOrEmpty<T>(path: string, empty: T, map: (data: any) => T): Promise<T> {
  try {
    const data = await request<any>(path);
    return map(data);
  } catch (err) {
    if (err instanceof StateVNotConfiguredError) {
      console.info(`State-V noch nicht konfiguriert – '${path}' liefert leer.`);
      return empty;
    }
    throw err;
  }
}

// ── Defensive Helfer, da das genaue Upstream-JSON-Schema unbekannt ist ──────────

/** Zieht das Array aus der Antwort – akzeptiert direktes Array oder gängige Wrapper. */
const asArray = (data: any): any[] => {
  if (Array.isArray(data)) return data;
  if (!data || typeof data !== "object") return [];
  for (const key of ["data", "offers", "items", "results", "logs", "entries"]) {
    if (Array.isArray(data[key])) return data[key];
  }
  return [];
};

/** Erster definierter Wert aus mehreren möglichen Feldnamen. */
const pick = (obj: any, keys: string[], fallback: any = undefined) => {
  for (const k of keys) {
    if (obj != null && obj[k] !== undefined && obj[k] !== null) return obj[k];
  }
  return fallback;
};

const num = (v: any, fallback = 0): number => {
  const n = typeof v === "string" ? parseFloat(v) : v;
  return typeof n === "number" && !isNaN(n) ? n : fallback;
};

const str = (v: any, fallback = ""): string => (v == null ? fallback : String(v));

const mapFactory = (o: any): Factory => ({
  id: str(pick(o, ["id", "_id", "factoryId", "firmenId"])),
  name: str(pick(o, ["name", "label", "title"])),
  hash: pick(o, ["hash"]) != null ? str(pick(o, ["hash"])) : undefined,
  isOpen: pick(o, ["isOpen", "is_open", "open"]) != null ? Boolean(pick(o, ["isOpen", "is_open", "open"])) : undefined,
  type: pick(o, ["type"]) != null ? str(pick(o, ["type"])) : undefined,
  address: pick(o, ["address"]) != null ? str(pick(o, ["address"])) : undefined,
});

const mapSell = (o: any): SellOffer => {
  const pricePerUnit = num(pick(o, ["pricePerUnit", "price_per_unit", "unitPrice", "price"]));
  const availableAmount = num(pick(o, ["availableAmount", "available_amount", "amount", "quantity"]));
  return {
    item: str(pick(o, ["item", "name", "label"])),
    listPrice: pick(o, ["listPrice", "list_price"]) != null ? num(pick(o, ["listPrice", "list_price"])) : undefined,
    pricePerUnit,
    totalPrice: num(pick(o, ["totalPrice", "total_price"], pricePerUnit * availableAmount)),
    availableAmount,
    createdAt: str(pick(o, ["createdAt", "created_at", "date", "timestamp"]), new Date().toISOString()),
    icon: pick(o, ["icon"]) ?? null,
  };
};

const mapBuy = (o: any): BuyOffer => ({ ...mapSell(o) });

const mapLog = (o: any): PurchaseLog => ({
  seller: str(pick(o, ["seller", "seller_name", "from"])),
  buyer: str(pick(o, ["buyer", "buyer_name", "to"])),
  price: num(pick(o, ["price", "total", "totalPrice"])),
  discount: num(pick(o, ["discount", "disc"])),
  items: asArray(pick(o, ["items", "products"], [])).map((it: any) => ({
    name: str(pick(it, ["name", "item", "label"])),
    amount: num(pick(it, ["amount", "quantity", "qty", "count"])),
  })),
  createdAt: str(pick(o, ["createdAt", "created_at", "date", "timestamp"]), new Date().toISOString()),
});

const mapInventory = (data: any): Inventory => ({
  totalWeight: num(pick(data, ["totalWeight", "total_weight"])),
  items: asArray(data).map((it: any) => {
    const amount = num(pick(it, ["amount", "quantity", "qty", "count"]));
    const singleWeight = num(pick(it, ["singleWeight", "single_weight", "weight"]));
    const price = pick(it, ["price"]);
    return {
      item: str(pick(it, ["item", "name", "label"])),
      amount,
      singleWeight,
      totalWeight: num(pick(it, ["totalWeight", "total_weight"], singleWeight * amount)),
      price: price != null ? num(price) : undefined,
      icon: pick(it, ["icon"]) ?? null,
    };
  }),
});

const EMPTY_INV: Inventory = { totalWeight: 0, items: [] };

export const statevApi = {
  getFactories(): Promise<Factory[]> {
    return requestOrEmpty("/factories", [] as Factory[], (d) => asArray(d).map(mapFactory));
  },
  getFactoryInventory(id: string): Promise<Inventory> {
    return requestOrEmpty(`/inventory/${encodeURIComponent(id)}`, EMPTY_INV, mapInventory);
  },
  getFactoryMachines(id: string): Promise<Inventory> {
    return requestOrEmpty(`/machines/${encodeURIComponent(id)}`, EMPTY_INV, mapInventory);
  },
  getFactoryCounter(id: string): Promise<Inventory> {
    return requestOrEmpty(`/counter/${encodeURIComponent(id)}`, EMPTY_INV, mapInventory);
  },
  getFactoryMarketSellOffers(id: string): Promise<SellOffer[]> {
    return requestOrEmpty(`/market/sell/${encodeURIComponent(id)}`, [] as SellOffer[], (d) => asArray(d).map(mapSell));
  },
  getFactoryMarketBuyOffers(id: string): Promise<BuyOffer[]> {
    return requestOrEmpty(`/market/buy/${encodeURIComponent(id)}`, [] as BuyOffer[], (d) => asArray(d).map(mapBuy));
  },
  getFactoryBuyLog(id: string, limit = 50, skip = 0): Promise<PurchaseLog[]> {
    const qs = new URLSearchParams({ limit: String(limit), skip: String(skip) });
    return requestOrEmpty(`/buy-log/${encodeURIComponent(id)}?${qs.toString()}`, [] as PurchaseLog[], (d) =>
      asArray(d).map(mapLog),
    );
  },
};
