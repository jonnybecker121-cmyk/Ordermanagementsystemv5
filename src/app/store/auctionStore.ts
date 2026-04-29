import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface ImportAuction {
  item: string;
  bidAmount: number;
  isLastBidderMe: boolean;
  auctionEnd: Date | string;
  icon?: string;
}

export interface ExportAuction {
  item: string;
  bidAmount: number;
  isLastBidderMe: boolean;
  auctionEnd: Date | string;
  amount: number;
  singleWeight: number;
  totalWeight: number;
  icon?: string;
}

interface AuctionState {
  importAuctions: ImportAuction[];
  exportAuctions: ExportAuction[];
  isLoading: boolean;
  lastFetch: string | null;

  // Actions
  setImportAuctions: (auctions: ImportAuction[]) => void;
  setExportAuctions: (auctions: ExportAuction[]) => void;
  setLoading: (loading: boolean) => void;
  setLastFetch: (timestamp: string) => void;
  clearAll: () => void;
}

export const useAuctionStore = create<AuctionState>()(
  persist(
    (set) => ({
      importAuctions: [],
      exportAuctions: [],
      isLoading: false,
      lastFetch: null,

      setImportAuctions: (auctions) =>
        set({ importAuctions: auctions }),

      setExportAuctions: (auctions) =>
        set({ exportAuctions: auctions }),

      setLoading: (loading) =>
        set({ isLoading: loading }),

      setLastFetch: (timestamp) =>
        set({ lastFetch: timestamp }),

      clearAll: () =>
        set({
          importAuctions: [],
          exportAuctions: [],
          lastFetch: null,
        }),
    }),
    {
      name: 'schmelzdepot-auction-store',
    }
  )
);