import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Input } from './ui/input';
import { Gavel, Clock, TrendingUp } from 'lucide-react';
import { toast } from 'sonner';

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(amount);

interface Auction {
  id: string;
  item: string;
  currentBid: number;
  topBidder: string;
  endsAt: number;
  bids: number;
}

const initialAuctions: Auction[] = [];

function useCountdown(endsAt: number) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const ms = Math.max(0, endsAt - now);
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  const s = Math.floor((ms % 60_000) / 1000);
  return { ended: ms === 0, label: `${h}h ${m}m ${s}s` };
}

function AuctionCard({ auction, onBid }: { auction: Auction; onBid: (id: string, amount: number) => void }) {
  const { ended, label } = useCountdown(auction.endsAt);
  const [bid, setBid] = useState('');

  return (
    <Card className="bg-card border border-primary/20">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between text-base">
          <span className="text-black dark:text-white">{auction.item}</span>
          <Badge variant={ended ? 'secondary' : 'outline'} className={ended ? '' : 'border-green-500/50 text-green-600'}>
            <Clock className="h-3 w-3 mr-1" />{ended ? 'Beendet' : label}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs text-muted-foreground">Höchstgebot</div>
            <div className="text-xl font-bold text-primary">{formatCurrency(auction.currentBid)}</div>
          </div>
          <div className="text-right">
            <div className="text-xs text-muted-foreground">Höchstbietender</div>
            <div className="font-medium">{auction.topBidder}</div>
          </div>
        </div>
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <TrendingUp className="h-3 w-3" />{auction.bids} Gebote
        </div>
        {!ended && (
          <div className="flex gap-2">
            <Input
              type="number"
              placeholder={`Min. ${auction.currentBid + 1000}`}
              value={bid}
              onChange={(e) => setBid(e.target.value)}
            />
            <Button
              onClick={() => {
                const amount = parseFloat(bid);
                if (!amount || amount <= auction.currentBid) {
                  toast.error('Gebot muss höher als das aktuelle Höchstgebot sein');
                  return;
                }
                onBid(auction.id, amount);
                setBid('');
              }}
            >
              Bieten
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function AuctionManager() {
  const [auctions, setAuctions] = useState<Auction[]>(initialAuctions);

  const handleBid = (id: string, amount: number) => {
    setAuctions((prev) => prev.map((a) => (a.id === id ? { ...a, currentBid: amount, topBidder: 'Schmelzdepot (Sie)', bids: a.bids + 1 } : a)));
    toast.success('Gebot abgegeben', { description: formatCurrency(amount) });
  };

  return (
    <div className="space-y-6">
      <Card className="bg-card border border-primary/20 shadow-lg shadow-primary/5">
        <CardHeader className="border-b border-primary/20">
          <CardTitle className="flex items-center gap-2">
            <div className="p-1.5 bg-primary/90 rounded-md shadow-md shadow-primary/10">
              <Gavel className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="text-black dark:text-white">Auktionen</span>
          </CardTitle>
          <CardDescription>Laufende Auktionen – jetzt mitbieten</CardDescription>
        </CardHeader>
      </Card>

      {auctions.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {auctions.map((a) => <AuctionCard key={a.id} auction={a} onBid={handleBid} />)}
        </div>
      ) : (
        <Card className="bg-card border border-primary/20">
          <CardContent className="text-center py-16 text-muted-foreground">
            <Gavel className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Keine laufenden Auktionen</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
