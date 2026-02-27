import { Hono } from "npm:hono";
import { cors } from "npm:hono/cors";
import { logger } from "npm:hono/logger";
import * as kv from "./kv_store.tsx";

const app = new Hono();

// ─── Retry Helper ─────────────────────────────────────────────────────────────
// Retries a KV operation up to `maxAttempts` times on transient network errors
// (e.g. connection reset, ECONNRESET, code 104).

async function withRetry<T>(
  fn: () => Promise<T>,
  label: string,
  maxAttempts = 3,
  baseDelayMs = 200,
): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      const msg = String(err);
      const isTransient =
        msg.includes("connection reset") ||
        msg.includes("ECONNRESET") ||
        msg.includes("connection error") ||
        msg.includes("SendRequest") ||
        msg.includes("error sending request");

      if (!isTransient || attempt === maxAttempts) {
        console.error(`[KV] ${label} failed after ${attempt} attempt(s):`, err);
        throw err;
      }
      const delay = baseDelayMs * Math.pow(2, attempt - 1);
      console.warn(`[KV] ${label} – transient error (attempt ${attempt}/${maxAttempts}), retrying in ${delay}ms…`);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw lastErr;
}

// ─── Health Check ────────────────────────────────────────────────────────────

app.get("/make-server-b50ee5dd/health", (c) => {
  return c.json({ status: "ok", timestamp: Date.now() });
});

// ─── Data Store Endpoints (Shared / Multi-Device) ────────────────────────────
//
// Alle Daten werden unter einem gemeinsamen Namespace gespeichert:
//   shared:store:<key>       → Vollständige Daten inkl. _savedAt Timestamp
//   shared:store:<key>:meta  → Nur { _savedAt } für leichtgewichtige Checks
//
// Der _savedAt Timestamp ermöglicht es Clients zu erkennen ob der Server
// neuere Daten hat als ihr lokaler Stand (Multi-Device Sync).

// GET /store/:key/meta – Leichtgewichtiger Timestamp-Check (kein volles Payload)
app.get("/make-server-b50ee5dd/store/:key/meta", async (c) => {
  const key = c.req.param('key');
  const metaKey = `shared:store:${key}:meta`;

  try {
    const meta = await withRetry(() => kv.get(metaKey), `get-meta:${key}`);
    return c.json({ meta: meta || { _savedAt: 0 } });
  } catch (err) {
    console.error(`KV Meta-Get error for key ${key}:`, err);
    return c.json({ error: "Failed to fetch meta" }, 500);
  }
});

// GET /store/:key – Vollständige Daten abrufen
app.get("/make-server-b50ee5dd/store/:key", async (c) => {
  const key = c.req.param('key');
  const storeKey = `shared:store:${key}`;

  try {
    const value = await withRetry(() => kv.get(storeKey), `get:${key}`);
    return c.json({ data: value });
  } catch (err) {
    console.error(`KV Get error for key ${key}:`, err);
    return c.json({ error: "Failed to fetch data" }, 500);
  }
});

// POST /store/:key – Daten speichern (mit automatischem _savedAt wenn nicht vorhanden)
app.post("/make-server-b50ee5dd/store/:key", async (c) => {
  const key = c.req.param('key');
  const storeKey = `shared:store:${key}`;
  const metaKey = `shared:store:${key}:meta`;

  try {
    const body = await c.req.json();

    if (!body._savedAt) {
      body._savedAt = Date.now();
    }

    await withRetry(() => kv.set(storeKey, body), `set:${key}`);
    await withRetry(
      () => kv.set(metaKey, {
        _savedAt: body._savedAt,
        _savedAt_iso: new Date(body._savedAt).toISOString(),
      }),
      `set-meta:${key}`,
    );

    return c.json({ success: true, _savedAt: body._savedAt });
  } catch (err) {
    console.error(`KV Set error for key ${key}:`, err);
    return c.json({ error: "Failed to save data" }, 500);
  }
});

// DELETE /store/:key – Daten löschen (Admin-Funktion)
app.delete("/make-server-b50ee5dd/store/:key", async (c) => {
  const key = c.req.param('key');
  const storeKey = `shared:store:${key}`;
  const metaKey = `shared:store:${key}:meta`;

  try {
    await withRetry(() => kv.del(storeKey), `del:${key}`);
    await withRetry(() => kv.del(metaKey), `del-meta:${key}`);
    return c.json({ success: true });
  } catch (err) {
    console.error(`KV Delete error for key ${key}:`, err);
    return c.json({ error: "Failed to delete data" }, 500);
  }
});

// ─── Sync Status Endpoint ─────────────────────────────────────────────────────

app.get("/make-server-b50ee5dd/sync/status", async (c) => {
  try {
    const [orderMeta, inventoryMeta, invoiceMeta] = await Promise.all([
      withRetry(() => kv.get("shared:store:full_data:meta"), "sync:full_data"),
      withRetry(() => kv.get("shared:store:inventory_data:meta"), "sync:inventory_data"),
      withRetry(() => kv.get("shared:store:invoice_data:meta"), "sync:invoice_data"),
    ]);

    return c.json({
      full_data: orderMeta || { _savedAt: 0 },
      inventory_data: inventoryMeta || { _savedAt: 0 },
      invoice_data: invoiceMeta || { _savedAt: 0 },
      serverTime: Date.now(),
    });
  } catch (err) {
    console.error("Sync status error:", err);
    return c.json({ error: "Failed to get sync status" }, 500);
  }
});

// ─── StateV API Proxy ─────────────────────────────────────────────────────────
// STATEV_API_KEY  → Bearer-Token für den Authorization-Header (API-Key)
// STATEV_API_SECRET → wird nur für POST-Body-Requests benötigt (API-Secret)

const STATEV_BASE = 'https://api.statev.de/req';

app.get("/make-server-b50ee5dd/statev/*", async (c) => {
  const apiKey = Deno.env.get('STATEV_API_KEY');
  if (!apiKey) {
    console.error('StateV Proxy: STATEV_API_KEY is not set');
    return c.json({ error: 'API key not configured' }, 500);
  }

  // Alles nach /statev/ als Pfad weitergeben
  const path = c.req.path.replace('/make-server-b50ee5dd/statev', '');
  const url = `${STATEV_BASE}${path}`;

  try {
    console.log(`[StateV Proxy] GET ${url}`);
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    });

    const text = await response.text();
    if (!response.ok) {
      console.error(`[StateV Proxy] Error ${response.status} for ${url}: ${text}`);
      return c.json({ error: `StateV API error: ${response.status}`, details: text }, response.status as any);
    }

    const data = JSON.parse(text);
    return c.json(data);
  } catch (err) {
    console.error(`[StateV Proxy] Fetch failed for ${url}:`, err);
    return c.json({ error: `Proxy fetch failed: ${err}` }, 500);
  }
});

app.post("/make-server-b50ee5dd/statev/*", async (c) => {
  const apiKey = Deno.env.get('STATEV_API_KEY');
  if (!apiKey) {
    console.error('StateV Proxy: STATEV_API_KEY is not set');
    return c.json({ error: 'API key not configured' }, 500);
  }

  const path = c.req.path.replace('/make-server-b50ee5dd/statev', '');
  const url = `${STATEV_BASE}${path}`;

  try {
    const body = await c.req.json();
    console.log(`[StateV Proxy] POST ${url}`);
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const text = await response.text();
    if (!response.ok) {
      console.error(`[StateV Proxy] Error ${response.status} for ${url}: ${text}`);
      return c.json({ error: `StateV API error: ${response.status}`, details: text }, response.status as any);
    }

    const data = JSON.parse(text);
    return c.json(data);
  } catch (err) {
    console.error(`[StateV Proxy] POST failed for ${url}:`, err);
    return c.json({ error: `Proxy fetch failed: ${err}` }, 500);
  }
});

Deno.serve(app.fetch);