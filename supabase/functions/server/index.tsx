import { Hono } from "npm:hono";
import { cors } from "npm:hono/cors";
import { logger } from "npm:hono/logger";
import * as kv from "./kv_store.tsx";

const app = new Hono();

// Logger
app.use('*', logger(console.log));

// CORS
app.use(
  "/*",
  cors({
    origin: "*",
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    exposeHeaders: ["Content-Length"],
    maxAge: 600,
  }),
);

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
    const meta = await kv.get(metaKey);
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
    const value = await kv.get(storeKey);
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

    // Stelle sicher dass ein _savedAt Timestamp vorhanden ist
    if (!body._savedAt) {
      body._savedAt = Date.now();
    }

    // Speichere vollständige Daten
    await kv.set(storeKey, body);

    // Speichere Meta-Informationen separat (für schnelle Timestamp-Checks)
    await kv.set(metaKey, {
      _savedAt: body._savedAt,
      _savedAt_iso: new Date(body._savedAt).toISOString(),
    });

    return c.json({
      success: true,
      _savedAt: body._savedAt,
    });
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
    await kv.del(storeKey);
    await kv.del(metaKey);
    return c.json({ success: true });
  } catch (err) {
    console.error(`KV Delete error for key ${key}:`, err);
    return c.json({ error: "Failed to delete data" }, 500);
  }
});

// ─── Sync Status Endpoint ─────────────────────────────────────────────────────
// Gibt Timestamps aller Stores zurück – nützlich für schnellen Multi-Store-Check

app.get("/make-server-b50ee5dd/sync/status", async (c) => {
  try {
    const [orderMeta, inventoryMeta, invoiceMeta] = await Promise.all([
      kv.get("shared:store:full_data:meta"),
      kv.get("shared:store:inventory_data:meta"),
      kv.get("shared:store:invoice_data:meta"),
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

Deno.serve(app.fetch);
