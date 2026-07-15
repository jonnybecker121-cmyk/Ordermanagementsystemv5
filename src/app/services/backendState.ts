// Generischer App-State-Sync gegen den Supabase-KV-Store.
// Jeder persistierte Store wird über seinen persistKey in Supabase gespiegelt,
// sodass die gesamte App geräteübergreifend synchron bleibt. localStorage
// dient weiterhin als schneller Offline-Cache.

import { projectId, publicAnonKey } from "/utils/supabase/info";

const BASE = `https://${projectId}.supabase.co/functions/v1/make-server-d632b7fe/state`;

const headers = {
  "Content-Type": "application/json",
  Authorization: `Bearer ${publicAnonKey}`,
};

/**
 * Lädt den gespeicherten State für einen Schlüssel aus Supabase.
 * Gibt bei Fehlern oder fehlenden Daten `null` zurück (nie werfen), damit die
 * App auch ohne erreichbares Backend startet.
 */
export async function loadBackendState<T = unknown>(key: string): Promise<T | null> {
  try {
    const res = await fetch(`${BASE}/${encodeURIComponent(key)}`, { headers });
    if (!res.ok) {
      console.error(`❌ [backendState] Laden von '${key}' fehlgeschlagen: HTTP ${res.status}`);
      return null;
    }
    const body = await res.json();
    return (body?.value ?? null) as T | null;
  } catch (err) {
    console.error(`❌ [backendState] Netzwerkfehler beim Laden von '${key}':`, err);
    return null;
  }
}

/**
 * Speichert den State für einen Schlüssel in Supabase (best effort, wirft nie).
 */
export async function saveBackendState(key: string, value: unknown): Promise<void> {
  try {
    const res = await fetch(`${BASE}/${encodeURIComponent(key)}`, {
      method: "PUT",
      headers,
      body: JSON.stringify({ value }),
    });
    if (!res.ok) {
      console.error(`❌ [backendState] Speichern von '${key}' fehlgeschlagen: HTTP ${res.status}`);
    }
  } catch (err) {
    console.error(`❌ [backendState] Netzwerkfehler beim Speichern von '${key}':`, err);
  }
}
