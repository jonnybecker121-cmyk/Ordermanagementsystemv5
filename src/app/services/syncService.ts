/**
 * SyncService – Echtzeit Multi-Device-Synchronisation für Schmelzdepot
 *
 * Ablauf pro Poll-Zyklus (alle 8 Sek.):
 * 1. GET /sync/status → ein Request mit allen Server-Timestamps
 * 2. Vergleiche mit lokalen _lastSavedAt Timestamps
 * 3. Nur wenn Server neuer → loadFromBackend() für den jeweiligen Store
 * 4. Toast-Benachrichtigung bei Änderungen anderer Geräte
 *
 * Bei lokalen Änderungen:
 * - saveToBackend() setzt neuen Timestamp und aktualisiert _lastSavedAt
 * - Nächster Poll-Zyklus erkennt: "Server = lokal" → kein Override
 *
 * Fehler-Strategie (exponentielles Backoff):
 * - 1–3 Fehler  → Status "error",  normale Poll-Rate (8 s)
 * - ab 3 Fehler → Status "offline", Polling stoppt
 * - Reconnect-Versuch alle 30 s (verdoppelt sich bis max. 120 s)
 * - Erster erfolgreicher Reconnect → normales Polling wieder aktiv
 */

import { projectId, publicAnonKey } from '../../../utils/supabase/info';
import { useOrderStore } from '../store/orderStore';
import { useInventoryStore } from '../store/inventoryStore';
import { useInvoiceStore } from '../store/invoiceStore';
import { useSyncStore } from '../store/syncStore';

const BASE_URL = `https://${projectId}.supabase.co/functions/v1/make-server-b50ee5dd`;
const POLL_INTERVAL_MS = 8_000;
const RECONNECT_BASE_MS = 30_000;
const RECONNECT_MAX_MS = 120_000;

const AUTH_HEADERS = {
  'Authorization': `Bearer ${publicAnonKey}`,
  'Content-Type': 'application/json',
};

interface SyncStatusResponse {
  full_data: { _savedAt: number };
  inventory_data: { _savedAt: number };
  invoice_data: { _savedAt: number };
  serverTime: number;
}

class SyncService {
  private pollIntervalId: ReturnType<typeof setInterval> | null = null;
  private reconnectTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private isRunning = false;
  private isOffline = false;
  private consecutiveErrors = 0;
  private reconnectDelayMs = RECONNECT_BASE_MS;
  private readonly MAX_ERRORS_BEFORE_OFFLINE = 3;

  /** Gibt true zurück wenn der Service aktuell offline ist – nutzbar von Stores */
  get offline(): boolean {
    return this.isOffline;
  }

  /** Stores können pending saves registrieren – werden beim Reconnect ausgeführt */
  private pendingSaves: Set<() => Promise<void>> = new Set();
  registerPendingSave(fn: () => Promise<void>) {
    this.pendingSaves.add(fn);
  }

  // ─── Public API ─────────────────────────────────────────────────────────────

  start() {
    if (this.isRunning) return;
    this.isRunning = true;
    this.consecutiveErrors = 0;
    this.isOffline = false;
    this.reconnectDelayMs = RECONNECT_BASE_MS;

    console.log('[SyncService] Gestartet – Poll-Intervall:', POLL_INTERVAL_MS, 'ms');

    // Initialer Sync sofort
    this.poll(true);
    this.startPolling();
  }

  stop() {
    this.clearPolling();
    this.clearReconnect();
    this.isRunning = false;
    console.log('[SyncService] Gestoppt');
  }

  async manualSync(): Promise<{ updated: boolean; message: string }> {
    console.log('[SyncService] Manueller Sync');
    const result = await this.poll(false);
    // Falls wir offline waren und manuell erfolgreich → normales Polling wieder starten
    if (!this.isOffline) {
      this.clearReconnect();
      this.startPolling();
    }
    return result;
  }

  // ─── Interval Management ────────────────────────────────────────────────────

  private startPolling() {
    this.clearPolling();
    this.pollIntervalId = setInterval(() => this.poll(false), POLL_INTERVAL_MS);
  }

  private clearPolling() {
    if (this.pollIntervalId !== null) {
      clearInterval(this.pollIntervalId);
      this.pollIntervalId = null;
    }
  }

  private clearReconnect() {
    if (this.reconnectTimeoutId !== null) {
      clearTimeout(this.reconnectTimeoutId);
      this.reconnectTimeoutId = null;
    }
  }

  private scheduleReconnect() {
    this.clearReconnect();
    console.log(`[SyncService] Reconnect-Versuch in ${this.reconnectDelayMs / 1000}s…`);
    this.reconnectTimeoutId = setTimeout(async () => {
      if (!this.isRunning) return;
      console.log('[SyncService] Reconnect-Versuch…');
      const result = await this.poll(false);
      if (!this.isOffline) {
        // Verbindung wieder da → normales Polling starten
        this.reconnectDelayMs = RECONNECT_BASE_MS;
        this.startPolling();
      } else {
        // Immer noch offline → Backoff verdoppeln (max. RECONNECT_MAX_MS)
        this.reconnectDelayMs = Math.min(this.reconnectDelayMs * 2, RECONNECT_MAX_MS);
        this.scheduleReconnect();
      }
      return result;
    }, this.reconnectDelayMs);
  }

  // ─── Core Poll ──────────────────────────────────────────────────────────────

  private async poll(isInitial: boolean): Promise<{ updated: boolean; message: string }> {
    const { setStatus, setLastSyncedAt } = useSyncStore.getState();
    setStatus('syncing');

    try {
      const statusRes = await fetch(`${BASE_URL}/sync/status`, {
        headers: AUTH_HEADERS,
        signal: AbortSignal.timeout(10_000), // 10 s Timeout
      });

      if (!statusRes.ok) {
        throw new Error(`Server antwortete mit Status ${statusRes.status}`);
      }

      const serverStatus: SyncStatusResponse = await statusRes.json();

      // Lokale Timestamps
      const localOrderTs = useOrderStore.getState()._lastSavedAt;
      const localInventoryTs = useInventoryStore.getState()._lastSavedAt;
      const localInvoiceTs = useInvoiceStore.getState()._lastSavedAt;

      // Selektiv nur veraltete Stores laden
      const toUpdate: Array<{ name: string; load: () => Promise<boolean> }> = [];
      if (serverStatus.full_data._savedAt > localOrderTs)
        toUpdate.push({ name: 'Aufträge', load: () => useOrderStore.getState().loadFromBackend() });
      if (serverStatus.inventory_data._savedAt > localInventoryTs)
        toUpdate.push({ name: 'Lager', load: () => useInventoryStore.getState().loadFromBackend() });
      if (serverStatus.invoice_data._savedAt > localInvoiceTs)
        toUpdate.push({ name: 'Rechnungen', load: () => useInvoiceStore.getState().loadFromBackend() });

      const results = await Promise.all(toUpdate.map((s) => s.load()));
      const actuallyUpdated = results.some(Boolean);
      const updatedNames = toUpdate.filter((_, i) => results[i]).map((s) => s.name);

      // Erfolg → Fehler-State zurücksetzen
      const wasOffline = this.isOffline;
      this.consecutiveErrors = 0;
      this.isOffline = false;
      setStatus('online');
      setLastSyncedAt(Date.now());

      if (wasOffline) {
        console.log('[SyncService] Verbindung wiederhergestellt');
        // Aufgeschobene Saves nachholen
        if (this.pendingSaves.size > 0) {
          console.log(`[SyncService] Führe ${this.pendingSaves.size} aufgeschobene Saves aus…`);
          const fns = [...this.pendingSaves];
          this.pendingSaves.clear();
          await Promise.allSettled(fns.map((fn) => fn()));
        }
        import('sonner').then(({ toast }) => {
          toast.success('Verbindung wiederhergestellt', {
            description: 'Sync läuft wieder normal.',
            duration: 4000,
          });
        }).catch(() => {});
      }

      if (!isInitial && updatedNames.length > 0) {
        import('sonner').then(({ toast }) => {
          toast.info('🔄 Daten synchronisiert', {
            description: `${updatedNames.join(', ')} wurden von einem anderen Gerät aktualisiert.`,
            duration: 4000,
          });
        }).catch(() => {});
      }

      if (isInitial) {
        console.log(
          '[SyncService] Initial-Sync abgeschlossen:',
          updatedNames.length > 0 ? `${updatedNames.join(', ')} aktualisiert` : 'Bereits aktuell',
        );
      }

      return {
        updated: actuallyUpdated,
        message: updatedNames.length > 0 ? `${updatedNames.join(', ')} aktualisiert` : 'Bereits aktuell',
      };

    } catch (error) {
      // Zähler nur hochzählen wenn wir noch NICHT offline sind
      // (Reconnect-Versuche sollen keinen Spam erzeugen)
      if (!this.isOffline) {
        this.consecutiveErrors++;
        const errMsg = error instanceof Error ? error.message : String(error);
        console.debug(`[SyncService] Poll-Fehler (${this.consecutiveErrors}/${this.MAX_ERRORS_BEFORE_OFFLINE}): ${errMsg}`);

        if (this.consecutiveErrors < this.MAX_ERRORS_BEFORE_OFFLINE) {
          setStatus('error');
        } else if (this.consecutiveErrors === this.MAX_ERRORS_BEFORE_OFFLINE) {
          // Genau jetzt offline gehen
          this.isOffline = true;
          setStatus('offline');
          console.warn('[SyncService] Offline – reguläres Polling pausiert, starte Reconnect-Backoff');
          this.clearPolling();
          this.scheduleReconnect();

          import('sonner').then(({ toast }) => {
            toast.error('Verbindung unterbrochen', {
              description: 'Änderungen werden lokal gespeichert und beim nächsten Verbindungsaufbau synchronisiert.',
              duration: 6000,
            });
          }).catch(() => {});
        }
      } else {
        // Wir sind bereits offline → Reconnect-Versuch ist fehlgeschlagen → nur leise loggen
        const errMsg = error instanceof Error ? error.message : String(error);
        console.debug(`[SyncService] Reconnect-Versuch fehlgeschlagen: ${errMsg}`);
        setStatus('offline');
      }

      return { updated: false, message: `Sync-Fehler: ${error instanceof Error ? error.message : String(error)}` };
    }
  }
}

// Singleton-Export
export const syncService = new SyncService();