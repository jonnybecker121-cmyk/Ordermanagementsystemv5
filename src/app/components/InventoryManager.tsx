import { useState, useEffect, useRef, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Alert, AlertDescription } from './ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';

import {
  Loader2,
  Package,
  RefreshCw,
  Search,
  AlertCircle,
  History,
  BarChart3,
  Trash2,
  ArrowDownToLine,
  ArrowUpFromLine,
  FileText,
  Factory,
  Flame
} from 'lucide-react';
import { statevApi, type Inventory } from '../services/statevApi';
import { toast } from 'sonner';
import { useInventoryStore, type InventoryLogEntry } from '../store/inventoryStore';
import { PRODUCTS, RECIPES, producibleFor, maxProducibleDeep } from '../data/recipes';
import { Switch } from './ui/switch';

// Feste Firma, die ausgelesen wird. Es wird bewusst keine andere Firma angeboten.
const FACTORY_ID = '65ce2e98e3a3ab88426f2794';

interface InventoryItem {
  id: string;
  name: string;
  amount: number;
  singleWeight: number;
  totalWeight: number;
  category: 'lager' | 'maschine';
}

interface InventoryStats {
  totalMovements: number;
  totalEingang: number;
  totalAusgang: number;
  topEingang: Array<{ item: string; amount: number; category: string }>;
  topAusgang: Array<{ item: string; amount: number; category: string }>;
  affectedItems: number;
}

interface InventoryManagerProps {
  syncTrigger?: number;
}

export default function InventoryManager({ syncTrigger = 0 }: InventoryManagerProps) {
  const { logs, lastSnapshot, addLog, clearLogs: clearStoreLogs, updateSnapshot } = useInventoryStore();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [, setInventory] = useState<Inventory | null>(null);
  const [, setMachines] = useState<Inventory | null>(null);

  const [currentItems, setCurrentItems] = useState<InventoryItem[]>([]);

  const [searchQuery, setSearchQuery] = useState('');
  const [stats, setStats] = useState<InventoryStats | null>(null);

  const [activeTab, setActiveTab] = useState('lager');
  const [activeMainTab, setActiveMainTab] = useState('inventory');
  const [produceDeep, setProduceDeep] = useState(false);

  const [logSearchQuery, setLogSearchQuery] = useState('');
  const [logFilterType, setLogFilterType] = useState<'all' | 'increase' | 'decrease'>('all');
  const [logFilterCategory, setLogFilterCategory] = useState<'all' | 'lager' | 'maschine'>('all');
  const [statsDayRange, setStatsDayRange] = useState('7');

  const isFirstLoad = useRef(true);
  const lastSyncTrigger = useRef(0);

  const handleClearLogs = () => {
    if (!confirm('Wirklich ALLE Bewegungen löschen und Snapshot zurücksetzen?')) {
      return;
    }
    clearStoreLogs();
    toast.success('✅ Logs & Snapshot zurückgesetzt');
  };

  // Snapshot-basiertes Auto-Tracking
  const detectApiChanges = (inventoryData: Inventory, machinesData: Inventory) => {
    try {
      const previousSnapshot = lastSnapshot;

      if (!previousSnapshot) {
        updateSnapshot({
          timestamp: new Date().toISOString(),
          gold: [],
          silver: [],
          items: inventoryData.items.map(item => ({ name: item.item, quantity: item.amount })),
          machines: machinesData.items.map(item => ({ name: item.item, quantity: item.amount })),
        });
        return;
      }

      inventoryData.items.forEach(currentItem => {
        const prev = previousSnapshot.items.find(i => i.name === currentItem.item);
        const diff = currentItem.amount - (prev?.quantity || 0);
        if (diff !== 0) {
          addLog({
            type: 'movement_detected',
            category: 'item',
            item: currentItem.item,
            change: diff,
            previousQuantity: prev?.quantity || 0,
            newQuantity: currentItem.amount,
            details: `Auto-Tracking: ${(prev?.quantity || 0)} → ${currentItem.amount}`
          });
        }
      });

      machinesData.items.forEach(currentItem => {
        const prev = previousSnapshot.machines.find(i => i.name === currentItem.item);
        const diff = currentItem.amount - (prev?.quantity || 0);
        if (diff !== 0) {
          addLog({
            type: 'movement_detected',
            category: 'maschine',
            item: currentItem.item,
            change: diff,
            previousQuantity: prev?.quantity || 0,
            newQuantity: currentItem.amount,
            details: `Auto-Tracking: ${(prev?.quantity || 0)} → ${currentItem.amount}`
          });
        }
      });

      updateSnapshot({
        timestamp: new Date().toISOString(),
        gold: [],
        silver: [],
        items: inventoryData.items.map(item => ({ name: item.item, quantity: item.amount })),
        machines: machinesData.items.map(item => ({ name: item.item, quantity: item.amount })),
      });
    } catch (err) {
      console.error('Snapshot error', err);
    }
  };

  const calculateStats = (dayRange: number): InventoryStats => {
    const cutoffTime = Date.now() - (dayRange * 24 * 60 * 60 * 1000);
    const recentLogs = logs.filter(log => new Date(log.timestamp).getTime() >= cutoffTime);

    const eingangLogs = recentLogs.filter(log => log.change > 0);
    const ausgangLogs = recentLogs.filter(log => log.change < 0);

    const eingangMap = new Map<string, { total: number; category: string }>();
    const ausgangMap = new Map<string, { total: number; category: string }>();

    eingangLogs.forEach(log => {
      const key = `${log.item}-${log.category}`;
      const existing = eingangMap.get(key) || { total: 0, category: log.category };
      existing.total += Math.abs(log.change);
      eingangMap.set(key, existing);
    });

    ausgangLogs.forEach(log => {
      const key = `${log.item}-${log.category}`;
      const existing = ausgangMap.get(key) || { total: 0, category: log.category };
      existing.total += Math.abs(log.change);
      ausgangMap.set(key, existing);
    });

    const topEingang = Array.from(eingangMap.entries())
      .sort((a, b) => b[1].total - a[1].total)
      .slice(0, 5)
      .map(([key, data]) => ({ item: key.split('-')[0], amount: data.total, category: data.category }));

    const topAusgang = Array.from(ausgangMap.entries())
      .sort((a, b) => b[1].total - a[1].total)
      .slice(0, 5)
      .map(([key, data]) => ({ item: key.split('-')[0], amount: data.total, category: data.category }));

    const allItems = new Set([...eingangMap.keys(), ...ausgangMap.keys()]);

    return {
      totalMovements: recentLogs.length,
      totalEingang: eingangLogs.length,
      totalAusgang: ausgangLogs.length,
      topEingang,
      topAusgang,
      affectedItems: allItems.size
    };
  };

  const syncFromStateV = async (isTabSwitch = false) => {
    try {
      setLoading(true);
      setError(null);

      const [inventoryData, machinesData] = await Promise.all([
        statevApi.getFactoryInventory(FACTORY_ID),
        statevApi.getFactoryMachines(FACTORY_ID)
      ]);

      setInventory(inventoryData);
      setMachines(machinesData);

      const newItems: InventoryItem[] = [];

      inventoryData.items.forEach((item, index) => {
        newItems.push({
          id: `lager-${item.item}-${index}`,
          name: item.item,
          amount: item.amount,
          singleWeight: item.singleWeight,
          totalWeight: item.totalWeight,
          category: 'lager'
        });
      });

      machinesData.items.forEach((item, index) => {
        newItems.push({
          id: `maschine-${item.item}-${index}`,
          name: item.item,
          amount: item.amount,
          singleWeight: item.singleWeight,
          totalWeight: item.totalWeight,
          category: 'maschine'
        });
      });

      setCurrentItems(newItems);

      detectApiChanges(inventoryData, machinesData);

      if (isFirstLoad.current) {
        isFirstLoad.current = false;
      }

      const newStats = calculateStats(parseInt(statsDayRange));
      setStats(newStats);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'State-V API nicht erreichbar';
      console.error('❌ [InventoryManager] State-V Sync fehlgeschlagen:', err);
      toast.error('StateV-API Fehler', { description: errorMessage });
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // Initial-Load beim Mount
  useEffect(() => {
    syncFromStateV(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-Reload alle 5 Minuten
  useEffect(() => {
    const intervalId = setInterval(() => {
      syncFromStateV(false);
    }, 300000);
    return () => clearInterval(intervalId);
  }, []);

  // Recalculate stats when logs or day range changes
  useEffect(() => {
    if (logs.length > 0) {
      setStats(calculateStats(parseInt(statsDayRange)));
    }
  }, [logs, statsDayRange]);

  // Handle syncTrigger from parent (Tab-Wechsel)
  useEffect(() => {
    if (syncTrigger > 0 && syncTrigger !== lastSyncTrigger.current) {
      lastSyncTrigger.current = syncTrigger;
      syncFromStateV(true);
    }
  }, [syncTrigger]);

  const formatWeight = (weight: number) => {
    if (weight >= 1000) {
      return `${(weight / 1000).toFixed(1)}t`;
    }
    return `${weight.toFixed(1)}kg`;
  };

  const filteredItems = useMemo(
    () =>
      currentItems.filter(item => {
        if (activeTab !== 'all' && item.category !== activeTab) return false;
        if (searchQuery) return item.name.toLowerCase().includes(searchQuery.toLowerCase());
        return true;
      }),
    [currentItems, activeTab, searchQuery],
  );

  const totalWeight = filteredItems.reduce((sum, item) => sum + item.totalWeight, 0);
  const totalItems = filteredItems.reduce((sum, item) => sum + item.amount, 0);

  const filteredLogs: InventoryLogEntry[] = useMemo(
    () =>
      logs
        .filter(log => {
          if (logFilterType === 'increase' && log.change <= 0) return false;
          if (logFilterType === 'decrease' && log.change >= 0) return false;
          if (logFilterCategory !== 'all' && log.category !== logFilterCategory) return false;
          if (logSearchQuery) return log.item.toLowerCase().includes(logSearchQuery.toLowerCase());
          return true;
        })
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()),
    [logs, logFilterType, logFilterCategory, logSearchQuery],
  );

  // Bestands-Map (Materialname → Gesamtmenge) über alle Kategorien.
  const stockMap = useMemo(() => {
    const map: Record<string, number> = {};
    currentItems.forEach((it) => {
      map[it.name] = (map[it.name] ?? 0) + it.amount;
    });
    return map;
  }, [currentItems]);

  // Für jedes Produkt: was ist aus dem aktuellen Bestand produzierbar?
  // deep = Rohstoffe werden zu Zwischenprodukten mitverarbeitet.
  const producibleList = useMemo(
    () =>
      PRODUCTS.map((p) => (produceDeep ? maxProducibleDeep(p, stockMap) : producibleFor(p, stockMap))).sort(
        (a, b) => b.producible - a.producible,
      ),
    [stockMap, produceDeep],
  );

  return (
    <div className="space-y-6">
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Header */}
      <Card className="bg-card border border-primary/20 shadow-lg shadow-primary/5">
        <CardHeader className="border-b border-primary/20 bg-card">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-1.5 bg-primary/90 rounded-md shadow-md shadow-primary/10">
                <Package className="h-4 w-4 text-primary-foreground" />
              </div>
              <div>
                <CardTitle className="flex items-center gap-2 flex-wrap">
                  <span className="text-foreground">Lager & Bewegungs-Log</span>
                  <Badge
                    variant="outline"
                    className="border-green-500/50 bg-green-500/10 text-green-600 dark:text-green-400 text-[10px] gap-1"
                  >
                    <div className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse"></div>
                    LIVE State-V
                  </Badge>
                  <Badge
                    variant="outline"
                    className="border-blue-500/50 bg-blue-500/10 text-blue-600 dark:text-blue-400 text-[10px] gap-1"
                  >
                    <RefreshCw className="h-3 w-3" />
                    AUTO 5 Min
                  </Badge>
                </CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  {currentItems.length} Artikel • {logs.length} Bewegungen • Auto-Reload alle 5 Min
                </p>
              </div>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => syncFromStateV(false)}
              disabled={loading}
              className="gap-2"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Laden
            </Button>
          </div>
        </CardHeader>
      </Card>

      {/* Main Tabs */}
      <Tabs value={activeMainTab} onValueChange={setActiveMainTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="inventory" className="flex items-center gap-2">
            <Package className="h-4 w-4" />
            Bestand
          </TabsTrigger>
          <TabsTrigger value="produce" className="flex items-center gap-2">
            <Factory className="h-4 w-4" />
            Produzierbar
          </TabsTrigger>
          <TabsTrigger value="log" className="flex items-center gap-2">
            <History className="h-4 w-4" />
            Bewegungs-Log
          </TabsTrigger>
          <TabsTrigger value="stats" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Statistiken
          </TabsTrigger>
        </TabsList>

        {/* Inventory Tab */}
        <TabsContent value="inventory" className="space-y-6 mt-6">
          <Card className="bg-card border border-primary/20">
            <CardContent className="pt-6">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Artikel suchen..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </CardContent>
          </Card>

          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="lager">
                Lager ({currentItems.filter(i => i.category === 'lager').length})
              </TabsTrigger>
              <TabsTrigger value="maschine">
                Maschinen ({currentItems.filter(i => i.category === 'maschine').length})
              </TabsTrigger>
              <TabsTrigger value="all">
                Alle ({currentItems.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value={activeTab} className="mt-6">
              <Card className="bg-card border border-primary/20">
                <CardContent className="pt-6">
                  {loading ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="h-6 w-6 animate-spin mr-2" />
                      <span>Lade Daten...</span>
                    </div>
                  ) : filteredItems.length === 0 ? (
                    <div className="text-center py-12">
                      <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                      <p className="text-muted-foreground">Keine Artikel gefunden</p>
                      <p className="text-sm text-muted-foreground mt-2">
                        State-V API liefert derzeit keine Bestandsdaten.
                      </p>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center gap-4 p-4 bg-primary/5 rounded-lg border border-primary/20 mb-4">
                        <div className="flex-1">
                          <div className="text-sm text-muted-foreground">Gesamtgewicht</div>
                          <div className="text-2xl font-bold text-primary">
                            {formatWeight(totalWeight)}
                          </div>
                        </div>
                        <div className="flex-1">
                          <div className="text-sm text-muted-foreground">Gesamt-Artikel</div>
                          <div className="text-2xl font-bold text-primary">
                            {totalItems.toLocaleString()}
                          </div>
                        </div>
                      </div>

                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Name</TableHead>
                              <TableHead className="text-right">Menge</TableHead>
                              <TableHead className="text-right">Einzelgewicht</TableHead>
                              <TableHead className="text-right">Gesamtgewicht</TableHead>
                              <TableHead>Kategorie</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {filteredItems.map((item) => (
                              <TableRow key={item.id}>
                                <TableCell className="font-medium">{item.name}</TableCell>
                                <TableCell className="text-right">{item.amount.toLocaleString()}</TableCell>
                                <TableCell className="text-right">{item.singleWeight.toFixed(3)}kg</TableCell>
                                <TableCell className="text-right">{item.totalWeight.toFixed(2)}kg</TableCell>
                                <TableCell>
                                  <Badge variant="outline">
                                    {item.category === 'lager' ? 'Lager' : 'Maschine'}
                                  </Badge>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </TabsContent>

        {/* Produzierbar Tab */}
        <TabsContent value="produce" className="space-y-6 mt-6">
          <Card className="bg-card border border-primary/20">
            <CardHeader className="border-b border-primary/20">
              <CardTitle className="flex items-center gap-2">
                <Factory className="h-5 w-5 text-primary" />
                Produzierbar aus aktuellem Bestand
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Gleicht den Live-Lagerbestand mit den Rezepten ab und zeigt, wie viel je Produkt
                direkt herstellbar ist. Zwischenprodukte (z. B. Barren) müssen dafür im Lager liegen.
              </p>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/40 px-4 py-3 mb-6">
                <Switch id="produce-deep" checked={produceDeep} onCheckedChange={setProduceDeep} />
                <div className="flex-1">
                  <label htmlFor="produce-deep" className="text-sm font-medium cursor-pointer">
                    Zwischenprodukte mitrechnen
                  </label>
                  <p className="text-xs text-muted-foreground">
                    Verarbeitet Rohstoffe (Erze, Sand …) zu Zwischenstufen und zeigt die maximal mögliche Endmenge.
                  </p>
                </div>
              </div>
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin mr-2" />
                  <span>Lade Daten...</span>
                </div>
              ) : currentItems.length === 0 ? (
                <div className="text-center py-12">
                  <Factory className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-30" />
                  <p className="text-muted-foreground">Kein Bestand geladen</p>
                  <p className="text-sm text-muted-foreground mt-2">
                    State-V API liefert derzeit keine Bestandsdaten.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Produkt</TableHead>
                        <TableHead className="text-right">Produzierbar</TableHead>
                        <TableHead className="text-right">Durchläufe</TableHead>
                        <TableHead>Rezept</TableHead>
                        <TableHead>Begrenzt durch</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {producibleList.map((r) => {
                        const recipe = RECIPES[r.product];
                        const recipeText = [
                          ...recipe.inputs.map((i) => `${i.item} ×${i.amount}`),
                          ...(recipe.fuel ? ['Brennstoff'] : []),
                        ].join(' + ');
                        return (
                          <TableRow key={r.product} className="hover:bg-primary/5">
                            <TableCell className="font-medium">{r.product}</TableCell>
                            <TableCell className="text-right">
                              <Badge
                                className={
                                  r.producible > 0
                                    ? 'bg-green-500/10 text-green-600 border-green-500/20'
                                    : 'bg-muted text-muted-foreground'
                                }
                              >
                                {r.producible.toLocaleString('de-DE')} Stück
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right tabular-nums text-muted-foreground">
                              {r.runs.toLocaleString('de-DE')} × {r.output}
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground max-w-[280px]">
                              <span className="flex items-center gap-1 flex-wrap">
                                {recipe.fuel && <Flame className="h-3 w-3 text-primary shrink-0" />}
                                {recipeText}
                              </span>
                            </TableCell>
                            <TableCell className="text-xs">
                              {r.producible === 0 ? (
                                <span className="text-red-500">
                                  {r.limiting.join(', ') || 'Material fehlt'}
                                </span>
                              ) : (
                                <span className="text-muted-foreground">{r.limiting.join(', ')}</span>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                  <p className="text-xs text-muted-foreground mt-4">
                    Brennstoff-Rezepte nutzen automatisch den verfügbaren Brennstoff mit der größten
                    Reichweite (Kohlebrocken / Holzbrett / Öl / Holzspäne).
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Movement Log Tab */}
        <TabsContent value="log" className="space-y-6 mt-6">
          <Card className="bg-card border border-primary/20">
            <CardContent className="pt-6">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Artikel suchen..."
                    value={logSearchQuery}
                    onChange={(e) => setLogSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>

                <Select value={logFilterType} onValueChange={(value: any) => setLogFilterType(value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Änderung" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Alle Bewegungen</SelectItem>
                    <SelectItem value="increase">Nur Eingänge</SelectItem>
                    <SelectItem value="decrease">Nur Ausgänge</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={logFilterCategory} onValueChange={(value: any) => setLogFilterCategory(value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Kategorie" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Alle Kategorien</SelectItem>
                    <SelectItem value="lager">Lager</SelectItem>
                    <SelectItem value="maschine">Maschinen</SelectItem>
                  </SelectContent>
                </Select>

                <Button variant="destructive" onClick={handleClearLogs} className="gap-2">
                  <Trash2 className="h-4 w-4" />
                  Logs löschen
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card border border-primary/20">
            <CardHeader className="border-b border-primary/20">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <CardTitle className="flex items-center gap-2">
                    <History className="h-5 w-5 text-primary" />
                    Bewegungs-Log ({filteredLogs.length})
                  </CardTitle>
                  <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                    Auto-Reload alle 5 Min + Vollautomatisches Snapshot-Tracking
                  </div>
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => syncFromStateV(false)}
                  disabled={loading}
                  className="gap-2"
                >
                  <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                  Laden
                </Button>
              </div>
            </CardHeader>
            <CardContent className="pt-6">
              <Alert className="mb-6 border-blue-500/50 bg-blue-500/10">
                <FileText className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                <AlertDescription className="text-blue-700 dark:text-blue-300">
                  <strong>Vollautomatisches Tracking:</strong> State-V API wird automatisch alle 5 Minuten geladen. Jeder Call wird mit dem letzten Snapshot verglichen und alle Änderungen werden automatisch geloggt.
                </AlertDescription>
              </Alert>

              {filteredLogs.length === 0 ? (
                <div className="text-center py-12">
                  <History className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-30" />
                  <p className="text-muted-foreground">Noch keine Bewegungen erfasst</p>
                  <p className="text-sm text-muted-foreground mt-2">
                    🔄 Vollautomatisch: Alle 5 Minuten via State-V API<br />
                    Alle Änderungen werden automatisch erkannt und geloggt
                  </p>
                </div>
              ) : (
                <div className="max-h-[600px] overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Zeit</TableHead>
                        <TableHead>Artikel</TableHead>
                        <TableHead className="text-right">Menge</TableHead>
                        <TableHead>Grund</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredLogs.map((log) => (
                        <TableRow key={log.id} className="hover:bg-primary/5">
                          <TableCell className="py-2">
                            <div className="text-xs">{new Date(log.timestamp).toLocaleString()}</div>
                          </TableCell>
                          <TableCell className="py-2 font-medium">
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className={`text-[10px] px-1 py-0 h-4 ${log.category === 'item' ? 'border-blue-500/30 text-blue-600' : 'border-purple-500/30 text-purple-600'}`}>
                                {log.category.toUpperCase()}
                              </Badge>
                              {log.item}
                            </div>
                          </TableCell>
                          <TableCell className="py-2 text-right">
                            <Badge className={log.change > 0 ? 'bg-green-500/10 text-green-600 border-green-500/20' : 'bg-red-500/10 text-red-600 border-red-500/20'}>
                              {log.change > 0 ? '+' : ''}{log.change}
                            </Badge>
                          </TableCell>
                          <TableCell className="py-2 text-sm text-muted-foreground">
                            {log.details || 'System Sync'}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Statistics Tab */}
        <TabsContent value="stats" className="space-y-6 mt-6">
          <div className="flex items-center gap-4 mb-4">
            <Select value={statsDayRange} onValueChange={setStatsDayRange}>
              <SelectTrigger className="w-[200px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">Letzte 24 Stunden</SelectItem>
                <SelectItem value="7">Letzte 7 Tage</SelectItem>
                <SelectItem value="30">Letzte 30 Tage</SelectItem>
                <SelectItem value="90">Letzte 90 Tage</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {stats ? (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <Card className="bg-card border border-primary/20">
                  <CardHeader>
                    <CardTitle className="text-sm text-muted-foreground">Gesamt-Bewegungen</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold text-primary">{stats.totalMovements}</div>
                    <div className="text-sm text-muted-foreground mt-1">Erfasste Bewegungen</div>
                  </CardContent>
                </Card>

                <Card className="bg-card border border-primary/20">
                  <CardHeader>
                    <CardTitle className="text-sm text-muted-foreground">Betroffene Artikel</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold text-primary">{stats.affectedItems}</div>
                    <div className="text-sm text-muted-foreground mt-1">Verschiedene Artikel</div>
                  </CardContent>
                </Card>

                <Card className="bg-card border border-primary/20">
                  <CardHeader>
                    <CardTitle className="text-sm text-muted-foreground">Ein-/Ausgang</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-4">
                      <div className="text-green-600">
                        <div className="text-2xl font-bold">{stats.totalEingang}</div>
                        <div className="text-xs">Eingang</div>
                      </div>
                      <div className="text-red-600">
                        <div className="text-2xl font-bold">{stats.totalAusgang}</div>
                        <div className="text-xs">Ausgang</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <Card className="bg-card border border-primary/20">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <ArrowDownToLine className="h-5 w-5 text-green-600" />
                    Top 5 Wareneingänge
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {stats.topEingang.length > 0 ? (
                    <div className="space-y-2">
                      {stats.topEingang.map((item, idx) => (
                        <div key={idx} className="flex items-center justify-between p-3 border border-border rounded-lg">
                          <div className="flex items-center gap-3">
                            <div className="text-2xl font-bold text-muted-foreground">#{idx + 1}</div>
                            <div>
                              <div className="font-medium">{item.item}</div>
                              <Badge variant="secondary" className="text-xs">
                                {item.category === 'lager' ? 'Lager' : 'Maschine'}
                              </Badge>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-lg font-bold text-green-600">
                              {item.amount.toLocaleString()}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-4 text-muted-foreground">Keine Daten</div>
                  )}
                </CardContent>
              </Card>

              <Card className="bg-card border border-primary/20">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <ArrowUpFromLine className="h-5 w-5 text-red-600" />
                    Top 5 Warenausgänge
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {stats.topAusgang.length > 0 ? (
                    <div className="space-y-2">
                      {stats.topAusgang.map((item, idx) => (
                        <div key={idx} className="flex items-center justify-between p-3 border border-border rounded-lg">
                          <div className="flex items-center gap-3">
                            <div className="text-2xl font-bold text-muted-foreground">#{idx + 1}</div>
                            <div>
                              <div className="font-medium">{item.item}</div>
                              <Badge variant="secondary" className="text-xs">
                                {item.category === 'lager' ? 'Lager' : 'Maschine'}
                              </Badge>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-lg font-bold text-red-600">
                              {item.amount.toLocaleString()}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-4 text-muted-foreground">Keine Daten</div>
                  )}
                </CardContent>
              </Card>
            </div>
          ) : (
            <div className="text-center py-12">
              <BarChart3 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">Keine Statistiken verfügbar</p>
              <p className="text-sm text-muted-foreground mt-2">
                Änderungen werden automatisch getrackt
              </p>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
