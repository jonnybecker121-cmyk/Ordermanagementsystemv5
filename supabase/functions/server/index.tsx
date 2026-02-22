import { Hono } from "npm:hono";
import { cors } from "npm:hono/cors";
import { logger } from "npm:hono/logger";
import { createClient } from "npm:@supabase/supabase-js@2";
import * as kv from "./kv_store.tsx";

const app = new Hono();

// Enable logger
app.use('*', logger(console.log));

// Enable CORS
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

// Health check
app.get("/make-server-b50ee5dd/health", (c) => {
  return c.json({ status: "ok" });
});

// SHARED Data Store Endpoints (No Auth)

// Get Shared Data
app.get("/make-server-b50ee5dd/store/:key", async (c) => {
  const key = c.req.param('key');
  // Use a shared global key for all users
  const storeKey = `shared:store:${key}`;
  
  try {
    const value = await kv.get(storeKey);
    return c.json({ data: value });
  } catch (err) {
    console.error("KV Get error:", err);
    return c.json({ error: "Failed to fetch data" }, 500);
  }
});

// Save Shared Data
app.post("/make-server-b50ee5dd/store/:key", async (c) => {
  const key = c.req.param('key');
  // Use a shared global key for all users
  const storeKey = `shared:store:${key}`;
  
  try {
    const body = await c.req.json();
    await kv.set(storeKey, body);
    return c.json({ success: true });
  } catch (err) {
    console.error("KV Set error:", err);
    return c.json({ error: "Failed to save data" }, 500);
  }
});

Deno.serve(app.fetch);
