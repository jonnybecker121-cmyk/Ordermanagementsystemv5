import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { useAuctionStore } from '../store/auctionStore';
import { RefreshCw, Package, PackageOpen, Timer, Coins, Weight } from 'lucide-react';
const STATEV_BASE = 'https://api.statev.de/req';
const STATEV_API_KEY = 'IPIMSTJVSLFMK3JM1P';

export default function AuctionManager() {
  const {
    importAuctions,
    exportAuctions,
    isLoading,
    lastFetch,
    setImportAuctions,
    setExportAuctions,
    setLoading,
    setLastFetch,
  } = useAuctionStore();

  const [error, setError] = useState<string | null>(null);

  const fetchAuctions = async () => {
    setLoading(true);
    setError(null);

    try {
      // Fetch Import Auctions
      const importResponse = await fetch(
        `${STATEV_BASE}/market/my/auctions/import`,
        {
          headers: {
            Authorization: `Bearer ${STATEV_API_KEY}`,
          },
        }
      );

      if (!importResponse.ok) {
        throw new Error(`Import auctions fetch failed: ${importResponse.status} ${importResponse.statusText}`);
      }

      const importData = await importResponse.json();
      const importAuctionsWithDates = importData.map((auction: any) => ({
        ...auction,
        auctionEnd: new Date(auction.auctionEnd),
      }));
      setImportAuctions(importAuctionsWithDates);

      // Fetch Export Auctions
      const exportResponse = await fetch(
        `${STATEV_BASE}/market/my/auctions/export`,
        {
          headers: {
            Authorization: `Bearer ${STATEV_API_KEY}`,
          },
        }
      );

      if (!exportResponse.ok) {
        throw new Error(`Export auctions fetch failed: ${exportResponse.status} ${exportResponse.statusText}`);
      }

      const exportData = await exportResponse.json();
      const exportAuctionsWithDates = exportData.map((auction: any) => ({
        ...auction,
        auctionEnd: new Date(auction.auctionEnd),
      }));
      setExportAuctions(exportAuctionsWithDates);

      setLastFetch(new Date().toISOString());
    } catch (err) {
      console.error('Error fetching auctions:', err);
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Auto-fetch on mount if no data or data is old
    if (!lastFetch || Date.now() - new Date(lastFetch).getTime() > 60000) {
      fetchAuctions();
    }
  }, []);

  const getTimeRemaining = (endDate: Date | string) => {
    if (!endDate) return 'Ungültig';
    
    const now = new Date();
    const end = typeof endDate === 'string' ? new Date(endDate) : endDate;
    
    // Check if conversion was successful
    if (isNaN(end.getTime())) return 'Ungültig';
    
    const diff = end.getTime() - now.getTime();

    if (diff <= 0) return 'Abgelaufen';

    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    if (hours > 24) {
      const days = Math.floor(hours / 24);
      return `${days}T ${hours % 24}h`;
    }
    return `${hours}h ${minutes}m`;
  };

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(amount);

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <CardTitle>Auktions-Manager</CardTitle>
          <div className="flex items-center gap-4">
            {lastFetch && (
              <span className="text-sm text-muted-foreground uppercase tracking-widest">
                Aktualisiert: {new Date(lastFetch).toLocaleTimeString('de-DE')}
              </span>
            )}
            <Button
              onClick={fetchAuctions}
              disabled={isLoading}
              size="sm"
              className="h-9"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              Aktualisieren
            </Button>
          </div>
        </CardHeader>
      </Card>

      {/* Error Display */}
      {error && (
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <p className="text-destructive text-sm">{error}</p>
          </CardContent>
        </Card>
      )}

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Import Auctions (Buying) */}
        <Card className="border-primary/20">
          <CardHeader className="bg-muted/50">
            <CardTitle className="flex items-center gap-2 uppercase tracking-widest text-sm">
              <PackageOpen className="h-5 w-5 text-primary" />
              Import-Auktionen
              <span className="ml-auto text-muted-foreground font-normal">
                {importAuctions.length}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="space-y-2">
              {importAuctions.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm uppercase tracking-widest">
                  Keine Import-Auktionen
                </div>
              ) : (
                importAuctions.map((auction, idx) => (
                  <div
                    key={`import-${idx}`}
                    className={`p-4 bg-muted/50 border rounded-lg space-y-2 ${
                      auction.isLastBidderMe
                        ? 'border-primary/50 bg-primary/5'
                        : 'border-primary/10'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3">
                        {auction.icon && (
                          <div className="text-2xl">{auction.icon}</div>
                        )}
                        <div>
                          <h4 className="font-semibold uppercase tracking-widest text-sm">
                            {auction.item}
                          </h4>
                          <p className="text-xs text-muted-foreground mt-1 uppercase tracking-wider">
                            <Timer className="h-3 w-3 inline mr-1" />
                            {getTimeRemaining(auction.auctionEnd)}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-bold text-primary">
                          {formatCurrency(auction.bidAmount)}
                        </div>
                        {auction.isLastBidderMe && (
                          <div className="text-xs text-primary uppercase tracking-wider mt-1">
                            ✓ Höchstgebot
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        {/* Export Auctions (Selling) */}
        <Card className="border-primary/20">
          <CardHeader className="bg-muted/50">
            <CardTitle className="flex items-center gap-2 uppercase tracking-widest text-sm">
              <Package className="h-5 w-5 text-primary" />
              Export-Auktionen
              <span className="ml-auto text-muted-foreground font-normal">
                {exportAuctions.length}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="space-y-2">
              {exportAuctions.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm uppercase tracking-widest">
                  Keine Export-Auktionen
                </div>
              ) : (
                exportAuctions.map((auction, idx) => (
                  <div
                    key={`export-${idx}`}
                    className={`p-4 bg-muted/50 border rounded-lg space-y-2 ${
                      auction.isLastBidderMe
                        ? 'border-primary/50 bg-primary/5'
                        : 'border-primary/10'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3">
                        {auction.icon && (
                          <div className="text-2xl">{auction.icon}</div>
                        )}
                        <div>
                          <h4 className="font-semibold uppercase tracking-widest text-sm">
                            {auction.item}
                          </h4>
                          <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground uppercase tracking-wider">
                            <span>
                              <Coins className="h-3 w-3 inline mr-1" />
                              {auction.amount}x
                            </span>
                            <span>
                              <Weight className="h-3 w-3 inline mr-1" />
                              {auction.singleWeight}kg / {auction.totalWeight}kg
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1 uppercase tracking-wider">
                            <Timer className="h-3 w-3 inline mr-1" />
                            {getTimeRemaining(auction.auctionEnd)}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-bold text-primary">
                          {formatCurrency(auction.bidAmount)}
                        </div>
                        {auction.isLastBidderMe && (
                          <div className="text-xs text-primary uppercase tracking-wider mt-1">
                            ✓ Höchstgebot
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}