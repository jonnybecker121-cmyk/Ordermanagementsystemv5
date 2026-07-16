// ============================================================================
// StateV Integration – Gesamtdatei
// ============================================================================
//
// Diese Datei enthaelt ZWEI Teile, die an unterschiedlichen Orten laufen:
//
//  TEIL 1: CLIENT-CODE
//    -> laeuft im Browser, gehoert ins Frontend (z.B. src/services/statevApi.ts)
//
//  TEIL 2: SERVER-PROXY
//    -> laeuft als Supabase Edge Function (Deno), NICHT im Browser
//    -> Pfad: supabase/functions/make-server-d632b7fe/statev-proxy.ts
//
// Grund fuer die Trennung: Ein direkter Browser-Call gegen api.statev.de
// scheitert mit "Failed to fetch" (kein CORS von State-V gesetzt).
// Der Proxy laeuft Server-zu-Server (kein CORS-Problem) und haelt zugleich
// die Keys geheim, die sonst im Frontend sichtbar waeren.
//
// Copy-Paste: Teil 1 in die Frontend-Datei, Teil 2 in die Edge-Function-Datei.
// ============================================================================

// ############################################################################
// # TEIL 1 / 2 -- CLIENT-CODE (Browser, z.B. src/services/statevApi.ts)
// ############################################################################

// Service für die "StateV" Factory-Markt-API.
//
// Diese Version läuft OHNE Backend-Proxy: Die Aufrufe gehen direkt an die
// State-V-API und werden zusätzlich lokal im Browser (localStorage) gecacht,
// damit die Daten auch nach einem Reload sofort verfügbar sind bzw. die App
// bei einem fehlgeschlagenen Request auf den letzten bekannten Stand
// zurückfallen kann (offline-tauglich, "stale while error").
//
// WICHTIG (Sicherheit): Da es keinen Server mehr gibt, der einen Key geheim
// hält, ist ein evtl. benötigter API-Key clientseitig sichtbar (localStorage
// ist von jedem im Browser einsehbar). Nur verwenden, wenn die State-V-API
// entweder keinen geheimen Key braucht oder das Sichtbarwerden okay ist.

// ───────────────────────── Konfiguration ─────────────────────────

const CONFIG_KEY = "statev:config";

// WICHTIG: Ein direkter Browser-Call gegen https://api.statev.de schlägt mit
// "Failed to fetch" fehl, weil die State-V-API keine CORS-Header sendet und
// der Browser den Request deshalb blockiert (nicht reparierbar im Frontend).
// Deshalb läuft der Client hier gegen einen eigenen Server-Proxy
// (siehe statev-proxy.ts), der serverseitig an State-V weiterleitet.
// Dort liegen auch die echten Keys (API-Key + Secret-Key) als Umgebungs-
// variablen – NICHT mehr im Frontend-Code, damit sie nicht öffentlich sind.

export interface StateVConfig {
  /**
   * Basis-URL EURES EIGENEN Proxys, nicht der State-V-API direkt.
   * Bei Supabase Edge Functions z. B.:
   * "https://<project-id>.supabase.co/functions/v1/make-server-d632b7fe/statev-proxy"
   */
  baseUrl: string;
}

const DEFAULT_CONFIG: StateVConfig = {
  // TODO: eure echte Proxy-URL eintragen (siehe Kommentar oben), oder zur
  // Laufzeit per setStateVConfig() setzen.
  baseUrl: "",
};

/** Liest die aktuelle Konfiguration aus localStorage (mit Defaults). */
export function getStateVConfig(): StateVConfig {
  try {
    const raw = localStorage.getItem(CONFIG_KEY);
    if (!raw) return { ...DEFAULT_CONFIG };
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_CONFIG, ...parsed };
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

/** Setzt/merged die Konfiguration und speichert sie dauerhaft im Browser. */
export function setStateVConfig(config: Partial<StateVConfig>): void {
  const merged = { ...getStateVConfig(), ...config };
  localStorage.setItem(CONFIG_KEY, JSON.stringify(merged));
}

// ───────────────────────── Typen ─────────────────────────

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

// ───────────────────────── Lokaler Cache ─────────────────────────

const CACHE_PREFIX = "statev:cache:";

interface CacheEntry<T> {
  data: T;
  storedAt: number;
}

function cacheKey(path: string): string {
  return `${CACHE_PREFIX}${path}`;
}

function readCache<T>(path: string): CacheEntry<T> | null {
  try {
    const raw = localStorage.getItem(cacheKey(path));
    if (!raw) return null;
    return JSON.parse(raw) as CacheEntry<T>;
  } catch {
    return null;
  }
}

function writeCache<T>(path: string, data: T): void {
  try {
    const entry: CacheEntry<T> = { data, storedAt: Date.now() };
    localStorage.setItem(cacheKey(path), JSON.stringify(entry));
  } catch (err) {
    // z. B. QuotaExceededError – nicht kritisch, einfach ignorieren.
    console.warn(`State-V Cache konnte nicht geschrieben werden ('${path}')`, err);
  }
}

/** Löscht den kompletten lokalen State-V-Cache (z. B. für einen "Reset"-Button). */
export function clearStateVCache(): void {
  const toRemove: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith(CACHE_PREFIX)) toRemove.push(key);
  }
  toRemove.forEach((k) => localStorage.removeItem(k));
}

class StateVNotConfiguredError extends Error {}

/**
 * Führt einen Request gegen die State-V-API aus.
 *
 * Cache-Strategie:
 * - Ist ein frischer Cache-Eintrag (< maxAgeMs) vorhanden, wird dieser direkt
 *   zurückgegeben (kein Netzwerk-Call).
 * - Andernfalls wird die API aufgerufen; bei Erfolg wird der Cache
 *   aktualisiert.
 * - Schlägt der Request fehl, wird auf einen vorhandenen (auch veralteten)
 *   Cache-Eintrag zurückgefallen, statt einen Fehler zu werfen ("stale on
 *   error"). Gibt es gar keinen Cache, kommt der `empty`-Wert zurück.
 */
async function requestWithCache<T>(
  path: string,
  map: (data: any) => T,
  empty: T,
  maxAgeMs: number,
): Promise<T> {
  const cached = readCache<T>(path);
  if (cached && Date.now() - cached.storedAt < maxAgeMs) {
    return cached.data;
  }

  const { baseUrl } = getStateVConfig();
  if (!baseUrl) {
    console.info("Proxy-Basis-URL ist noch nicht konfiguriert (setStateVConfig).");
    return cached ? cached.data : empty;
  }

  try {
    // Kein Authorization-Header mehr nötig – der eigene Proxy hängt den
    // State-V-Key serverseitig an, der Browser kennt ihn gar nicht mehr.
    const res = await fetch(`${baseUrl}${path}`);
    const text = await res.text();
    let body: any;
    try {
      body = text ? JSON.parse(text) : null;
    } catch {
      body = text;
    }

    if (!res.ok) {
      const detail = body?.error || body?.upstream || text || res.statusText;
      throw new Error(`State-V Request '${path}' fehlgeschlagen (${res.status}): ${detail}`);
    }

    const mapped = map(body);
    writeCache(path, mapped);
    return mapped;
  } catch (err) {
    // Netzwerkfehler o. Ä.: auf lokalen Stand zurückfallen, falls vorhanden.
    if (cached) {
      console.warn(`State-V Request fehlgeschlagen, nutze lokalen Cache für '${path}'.`, err);
      return cached.data;
    }
    if (err instanceof StateVNotConfiguredError) {
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

// ── Cache-TTLs pro Datenart (in Millisekunden) ─────────────────────────
// Stammdaten (Fabriken) ändern sich selten → lange TTL.
// Markt-Angebote/Logs ändern sich häufig → kurze TTL.
const TTL_FACTORIES = 10 * 60 * 1000; // 10 Minuten
const TTL_INVENTORY = 2 * 60 * 1000; // 2 Minuten
const TTL_MARKET = 60 * 1000; // 1 Minute
const TTL_LOG = 60 * 1000; // 1 Minute

export const statevApi = {
  getFactories(): Promise<Factory[]> {
    return requestWithCache("/req/factory/list/", (d) => asArray(d).map(mapFactory), [] as Factory[], TTL_FACTORIES);
  },
  // TODO: Die folgenden Endpunkte sind noch geraten (altes Schema) und
  // müssen an das echte Pfadschema der State-V-API angepasst werden,
  // sobald die genauen Pfade bekannt sind (analog zu /req/factory/list/).
  getFactoryInventory(id: string): Promise<Inventory> {
    return requestWithCache(`/inventory/${encodeURIComponent(id)}`, mapInventory, EMPTY_INV, TTL_INVENTORY);
  },
  getFactoryMachines(id: string): Promise<Inventory> {
    return requestWithCache(`/machines/${encodeURIComponent(id)}`, mapInventory, EMPTY_INV, TTL_INVENTORY);
  },
  getFactoryCounter(id: string): Promise<Inventory> {
    return requestWithCache(`/counter/${encodeURIComponent(id)}`, mapInventory, EMPTY_INV, TTL_INVENTORY);
  },
  getFactoryMarketSellOffers(id: string): Promise<SellOffer[]> {
    return requestWithCache(
      `/market/sell/${encodeURIComponent(id)}`,
      (d) => asArray(d).map(mapSell),
      [] as SellOffer[],
      TTL_MARKET,
    );
  },
  getFactoryMarketBuyOffers(id: string): Promise<BuyOffer[]> {
    return requestWithCache(
      `/market/buy/${encodeURIComponent(id)}`,
      (d) => asArray(d).map(mapBuy),
      [] as BuyOffer[],
      TTL_MARKET,
    );
  },
  getFactoryBuyLog(id: string, limit = 50, skip = 0): Promise<PurchaseLog[]> {
    const qs = new URLSearchParams({ limit: String(limit), skip: String(skip) });
    return requestWithCache(
      `/buy-log/${encodeURIComponent(id)}?${qs.toString()}`,
      (d) => asArray(d).map(mapLog),
      [] as PurchaseLog[],
      TTL_LOG,
    );
  },
};


// ############################################################################
// # TEIL 2 / 2 -- SERVER-PROXY (Supabase Edge Function, Deno)
// # Pfad: supabase/functions/make-server-d632b7fe/statev-proxy.ts
// ############################################################################

// supabase/functions/make-server-d632b7fe/statev-proxy.ts
//
// Dünner Server-Proxy zwischen Browser und State-V-API.
// - Löst das CORS-Problem: der Browser spricht nur mit dieser Function
//   (bzw. deiner Supabase-Domain), diese Function spricht Server-zu-Server
//   mit api.statev.de (dort gibt es kein CORS, weil kein Browser beteiligt ist).
// - Hält API-Key/Secret-Key geheim: sie werden hier aus den Environment-
//   Variablen gelesen und NIE an den Client zurückgegeben.
//
// Environment-Variablen in Supabase setzen (Project Settings → Edge Functions
// → Secrets, oder `supabase secrets set`):
//   STATEV_API_KEY=QE5362BXWBQGS89EE7
//   STATEV_SECRET_KEY=fd46295715a3b222ad75ea34daecf050e69b1c753dd8dd54

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const STATEV_BASE = "https://api.statev.de";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*", // ggf. auf eure konkrete Domain einschränken
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

serve(async (req) => {
  // Preflight-Request beantworten
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS_HEADERS });
  }

  try {
    const url = new URL(req.url);
    // Alles nach /statev-proxy wird 1:1 an State-V weitergereicht,
    // z. B. /statev-proxy/req/factory/list/ -> /req/factory/list/
    const upstreamPath = url.pathname.replace(/^.*\/statev-proxy/, "");
    const upstreamUrl = `${STATEV_BASE}${upstreamPath}${url.search}`;

    const apiKey = Deno.env.get("STATEV_API_KEY");
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "STATEV_API_KEY ist serverseitig nicht konfiguriert." }),
        { status: 500, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } },
      );
    }

    const upstreamRes = await fetch(upstreamUrl, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });

    const body = await upstreamRes.text();
    return new Response(body, {
      status: upstreamRes.status,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: `Proxy-Fehler: ${err instanceof Error ? err.message : String(err)}` }),
      { status: 502, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } },
    );
  }
});
