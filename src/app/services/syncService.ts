/**
 * SyncService – Lokal-Modus (kein Backend-Sync)
 * Alle Daten werden ausschließlich im localStorage persistiert.
 */

class SyncService {
  /** Immer online im Lokal-Modus */
  get offline(): boolean {
    return false;
  }

  /** No-op im Lokal-Modus */
  registerPendingSave(_fn: () => Promise<void>) {}

  start() {}
  stop() {}

  async manualSync(): Promise<{ updated: boolean; message: string }> {
    return { updated: false, message: 'Lokal-Modus – kein Sync erforderlich' };
  }
}

export const syncService = new SyncService();
