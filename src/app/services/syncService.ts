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
 */

import { projectId, publicAnonKey } from '../../../utils/supabase/info';
import { useOrderStore } from '../store/orderStore';
import { useInventoryStore } from '../store/inventoryStore';
import { useInvoiceStore } from '../store/invoiceStore';
import { useSyncStore } from '../store/syncStore';

const BASE_URL = `https://${projectId}.supabase.co/functions/v1/make-server-b50ee5dd`;
const POLL_INTERVAL_MS = 8000;

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
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private isRunning = false;
  private consecutiveErrors = 0;
  private readonly MAX_ERRORS_BEFORE_OFFLINE = 3;

  /** Startet das Polling (idempotent) */
  start() {
    if (this.isRunning) return;
    this.isRunning = true;
    this.consecutiveErrors = 0;

    console.log('[SyncService] Gestartet – Poll-Intervall:', POLL_INTERVAL_MS, 'ms');

    // Initialer Sync sofort beim Start
    this.poll(true);

    this.intervalId = setInterval(() => {
      this.poll(false);
    }, POLL_INTERVAL_MS);
  }

  /** Stoppt das Polling */
  stop() {
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isRunning = false;
    console.log('[SyncService] Gestoppt');
  }

  /** Manueller Sync-Trigger (z.B. Refresh-Button) */
  async manualSync(): Promise<{ updated: boolean; message: string }> {
    console.log('[SyncService] Manueller Sync');
    return this.poll(false);
  }

  private async poll(isInitial: boolean): Promise<{ updated: boolean; message: string }> {
    const { setStatus, setLastSyncedAt } = useSyncStore.getState();
    setStatus('syncing');

    try {
      // Schritt 1: Leichtgewichtiger Status-Check (ein Request für alle Stores)
      const statusRes = await fetch(`${BASE_URL}/sync/status`, {
        headers: AUTH_HEADERS,
      });

      if (!statusRes.ok) {
        throw new Error(`Server antwortete mit Status ${statusRes.status}`);
      }

      const serverStatus: SyncStatusResponse = await statusRes.json();

      // Schritt 2: Lokale Timestamps aus den Stores
      const localOrderTs = useOrderStore.getState()._lastSavedAt;
      const localInventoryTs = useInventoryStore.getState()._lastSavedAt;
      const localInvoiceTs = useInvoiceStore.getState()._lastSavedAt;

      // Schritt 3: Selektiv nur Stores aktualisieren die veraltet sind
      const toUpdate: Array<{ name: string; load: () => Promise<boolean> }> = [];

      if (serverStatus.full_data._savedAt > localOrderTs) {
        toUpdate.push({ name: 'Aufträge', load: () => useOrderStore.getState().loadFromBackend() });
      }
      if (serverStatus.inventory_data._savedAt > localInventoryTs) {
        toUpdate.push({ name: 'Lager', load: () => useInventoryStore.getState().loadFromBackend() });
      }
      if (serverStatus.invoice_data._savedAt > localInvoiceTs) {
        toUpdate.push({ name: 'Rechnungen', load: () => useInvoiceStore.getState().loadFromBackend() });
      }

      // Schritt 4: Veraltete Stores laden
      const results = await Promise.all(toUpdate.map((s) => s.load()));
      const actuallyUpdated = results.some(Boolean);
      const updatedNames = toUpdate.filter((_, i) => results[i]).map((s) => s.name);

      // Schritt 5: Status aktualisieren
      this.consecutiveErrors = 0;
      setStatus('online');
      setLastSyncedAt(Date.now());

      // Schritt 6: Toast bei Änderungen von anderen Geräten
      if (!isInitial && updatedNames.length > 0) {
        import('sonner').then(({ toast }) => {
          toast.info('🔄 Daten synchronisiert', {
            description: `${updatedNames.join(', ')} wurden von einem anderen Gerät aktualisiert.`,
            duration: 4000,
          });
        }).catch(() => {});
      }

      if (isInitial) {
        console.log('[SyncService] Initial-Sync abgeschlossen:', updatedNames.length > 0 ? `${updatedNames.join(', ')} aktualisiert` : 'Bereits aktuell');
      }

      return {
        updated: actuallyUpdated,
        message: updatedNames.length > 0 ? `${updatedNames.join(', ')} aktualisiert` : 'Bereits aktuell',
      };

    } catch (error) {
      this.consecutiveErrors++;
      const errMsg = error instanceof Error ? error.message : String(error);
      console.error(`[SyncService] Poll-Fehler (${this.consecutiveErrors}/${this.MAX_ERRORS_BEFORE_OFFLINE}): ${errMsg}`);

      if (this.consecutiveErrors >= this.MAX_ERRORS_BEFORE_OFFLINE) {
        setStatus('offline');
        if (this.consecutiveErrors === this.MAX_ERRORS_BEFORE_OFFLINE) {
          import('sonner').then(({ toast }) => {
            toast.error('Verbindung unterbrochen', {
              description: 'Änderungen werden lokal gespeichert und beim nächsten Verbindungsaufbau synchronisiert.',
              duration: 6000,
            });
          }).catch(() => {});
        }
      } else {
        setStatus('error');
      }

      return { updated: false, message: `Sync-Fehler: ${errMsg}` };
    }
  }
}

// Singleton-Export
export const syncService = new SyncService();
