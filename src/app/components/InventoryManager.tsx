import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { Alert, AlertDescription } from '../ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';

import { 
  Loader2, 
  Package, 
  RefreshCw, 
  Search, 
  AlertCircle, 
  History, 
  TrendingUp, 
  TrendingDown, 
  BarChart3, 
  Download, 
  Trash2, 
  Settings, 
  ArrowDownToLine, 
  ArrowUpFromLine, 
  FileText 
} from 'lucide-react';
import { statevApi, type Inventory } from '../services/statevApi';
import { toast } from 'sonner';
import { useInventoryStore, type InventoryLogEntry } from '../store/inventoryStore';

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

interface ApiSnapshot {
  timestamp: string;
  inventory: InventoryItem[];
  machines: InventoryItem[];
}

const LOGS_KEY = 'schmelzdepot-inventory-logs';
const SNAPSHOT_KEY = 'statev_api_snapshot';

export default function InventoryManager({ syncTrigger = 0 }: InventoryManagerProps) {
  const { logs, lastSnapshot, addLog, clearLogs: clearStoreLogs, updateSnapshot, setLogs } = useInventoryStore();
  
  // 🔥 State-V API Integration
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // State-V API Data
  const [inventory, setInventory] = useState<Inventory | null>(null);
  const [machines, setMachines] = useState<Inventory | null>(null);
  
  // Current inventory items (from State-V API)
  const [currentItems, setCurrentItems] = useState<InventoryItem[]>([]);
  const [previousItems, setPreviousItems] = useState<InventoryItem[]>([]);
  
  // Search
  const [searchQuery, setSearchQuery] = useState('');
  
  // 📊 Bewegungs-Log & Statistiken
  const [stats, setStats] = useState<InventoryStats | null>(null);
  
  // Active Tab state
  const [activeTab, setActiveTab] = useState('lager');
  const [activeMainTab, setActiveMainTab] = useState('inventory');
  
  // Log filter states
  const [logSearchQuery, setLogSearchQuery] = useState('');
  const [logFilterType, setLogFilterType] = useState<'all' | 'increase' | 'decrease'>('all');
  const [logFilterCategory, setLogFilterCategory] = useState<'all' | 'lager' | 'maschine'>('all');
  const [statsDayRange, setStatsDayRange] = useState('7');

  // Track if this is the first load
  const isFirstLoad = useRef(true);
  const lastSyncTrigger = useRef(0);

  // 📊 Load logs from LocalStorage
  const loadLogs = () => {
    try {
      const saved = localStorage.getItem(LOGS_KEY);
      if (saved) {
        const entries: InventoryLogEntry[] = JSON.parse(saved);
        setLogs(entries);
        console.log(`✅ [InventoryManager] ${entries.length} Log-Einträge geladen`);
      }
    } catch (error) {
      console.warn('❌ [InventoryManager] Error loading logs:', error);
    }
  };

  // 📊 Save logs to LocalStorage
  const saveLogs = (entries: InventoryLogEntry[]) => {
    try {
      // Keep only last 1000 entries to prevent storage overflow
      const limitedEntries = entries.slice(-1000);
      const jsonString = JSON.stringify(limitedEntries);
      localStorage.setItem(LOGS_KEY, jsonString);
      setLogs(limitedEntries);
      console.log(`✅ [InventoryManager] ${limitedEntries.length} Log-Einträge gespeichert (${jsonString.length} bytes)`);
      
      // Verify storage
      const verification = localStorage.getItem(LOGS_KEY);
      if (!verification) {
        console.error('❌ [InventoryManager] Storage verification failed!');
      } else {
        console.log('✅ [InventoryManager] Storage verification successful');
      }
    } catch (error) {
      console.error('❌ [InventoryManager] Error saving logs:', error);
      toast.error('Fehler beim Speichern der Bewegung');
    }
  };

  // 📊 Clear all logs and reset snapshot
  const handleClearLogs = () => {
    if (!confirm('Wirklich ALLE Bewegungen löschen und Snapshot zurücksetzen?')) {
      return;
    }
    
    clearStoreLogs();
    toast.success('✅ Logs & Snapshot zurückgesetzt');
  };

  // 📊 State-V API Änderungen erkennen und automatisch loggen (SNAPSHOT-BASIERT)
  const detectApiChanges = (inventoryData: Inventory, machinesData: Inventory) => {
    try {
      const previousSnapshot = lastSnapshot;
      
      if (!previousSnapshot) {
        const newSnapshot = {
          timestamp: new Date().toISOString(),
          gold: [],
          silver: [],
          items: inventoryData.items.map(item => ({ name: item.item, quantity: item.amount })),
          machines: machinesData.items.map(item => ({ name: item.item, quantity: item.amount })),
        };
        updateSnapshot(newSnapshot);
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

  // 📊 Calculate statistics
  const calculateStats = (dayRange: number): InventoryStats => {
    const cutoffTime = Date.now() - (dayRange * 24 * 60 * 60 * 1000);
    const recentLogs = logs.filter(log => new Date(log.timestamp).getTime() >= cutoffTime);
    
    const eingangLogs = recentLogs.filter(log => log.change > 0);
    const ausgangLogs = recentLogs.filter(log => log.change < 0);
    
    // Group by item
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
      .map(([key, data]) => ({
        item: key.split('-')[0],
        amount: data.total,
        category: data.category
      }));
    
    const topAusgang = Array.from(ausgangMap.entries())
      .sort((a, b) => b[1].total - a[1].total)
      .slice(0, 5)
      .map(([key, data]) => ({
        item: key.split('-')[0],
        amount: data.total,
        category: data.category
      }));
    
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

  // 🔥 State-V API Sync mit Auto-Tracking bei jedem Call
  const syncFromStateV = async (isTabSwitch = false) => {
    try {
      setLoading(true);
      setError(null);
      
      const syncSource = isTabSwitch ? 'Tab-Wechsel' : 'Initial Load';
      console.log(`🔄 [InventoryManager] State-V API Sync (${syncSource})...`);
      
      // Store current items for change detection BEFORE loading new data
      const itemsBeforeSync = [...currentItems];
      
      const [inventoryData, machinesData] = await Promise.all([
        statevApi.getFactoryInventory(),
        statevApi.getFactoryMachines()
      ]);
      
      setInventory(inventoryData);
      setMachines(machinesData);
      
      // Convert to internal format
      const newItems: InventoryItem[] = [];
      
      // Add inventory items
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
      
      // Add machine items
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
      setPreviousItems(newItems); // Update previous for next sync
      
      // 🔄 AUTO-TRACKING: Bei jedem API Call (auch beim ersten Load für Snapshot)
      detectApiChanges(inventoryData, machinesData);
      
      if (isFirstLoad.current) {
        isFirstLoad.current = false;
        console.log('✅ [InventoryManager] Erster Load abgeschlossen - Auto-Tracking aktiviert');
        toast.success(`✅ ${newItems.length} Artikel geladen`, {
          description: 'Auto-Tracking bei jedem API Call aktiv'
        });
      } else if (isTabSwitch) {
        console.log(`✅ [InventoryManager] Tab-Wechsel Sync abgeschlossen - ${newItems.length} Artikel`);
      }
      
      // Recalculate stats
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

  // Initial load on mount
  useEffect(() => {
    loadLogs();
    syncFromStateV(); // Initial load
  }, []);
  
  // 🔄 AUTO-RELOAD alle 5 Minuten
  useEffect(() => {
    const intervalId = setInterval(() => {
      console.log('⏱️ [InventoryManager] Auto-Reload (5 Min)');
      syncFromStateV(false); // false = nicht Tab-Wechsel
      loadLogs();
    }, 300000); // 5 Minuten = 300.000ms
    
    return () => clearInterval(intervalId);
  }, []);

  // Recalculate stats when logs or day range changes
  useEffect(() => {
    if (logs.length > 0) {
      const newStats = calculateStats(parseInt(statsDayRange));
      setStats(newStats);
    }
  }, [logs, statsDayRange]);

  // Handle syncTrigger from parent (Tab-Wechsel) - LIVE TRACKING
  useEffect(() => {
    if (syncTrigger > 0 && syncTrigger !== lastSyncTrigger.current) {
      console.log(`🔄 [InventoryManager] Tab-Wechsel erkannt (Trigger: ${lastSyncTrigger.current} → ${syncTrigger})`);
      lastSyncTrigger.current = syncTrigger;
      syncFromStateV(true); // true = isTabSwitch
    }
  }, [syncTrigger]);

  // Helper functions for formatting
  const formatTimestamp = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatRelativeTime = (timestamp: number) => {
    const now = Date.now();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Gerade eben';
    if (minutes < 60) return `vor ${minutes} Min`;
    if (hours < 24) return `vor ${hours} Std`;
    return `vor ${days} Tag${days > 1 ? 'en' : ''}`;
  };

  const formatWeight = (weight: number) => {
    if (weight >= 1000) {
      return `${(weight / 1000).toFixed(1)}t`;
    }
    return `${weight.toFixed(1)}kg`;
  };

  // Filter items
  const filteredItems = currentItems.filter(item => {
    if (activeTab !== 'all' && item.category !== activeTab) return false;
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return item.name.toLowerCase().includes(query);
    }
    return true;
  });

  // Calculate totals
  const totalWeight = filteredItems.reduce((sum, item) => sum + item.totalWeight, 0);
  const totalItems = filteredItems.reduce((sum, item) => sum + item.amount, 0);

  // Filter logs
  const filteredLogs = logs.filter(log => {
    if (logFilterType === 'increase' && log.change <= 0) return false;
    if (logFilterType === 'decrease' && log.change >= 0) return false;
    if (logFilterCategory !== 'all' && log.category !== logFilterCategory) return false;
    if (logSearchQuery) {
      const query = logSearchQuery.toLowerCase();
      return log.item.toLowerCase().includes(query);
    }
    return true;
  }).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

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

          </div>
        </CardHeader>
      </Card>

      {/* Main Tabs */}
      <Tabs value={activeMainTab} onValueChange={setActiveMainTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="inventory" className="flex items-center gap-2">
            <Package className="h-4 w-4" />
            Bestand
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
          {/* Search */}
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

          {/* Category Tabs */}
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

        {/* Movement Log Tab */}
        <TabsContent value="log" className="space-y-6 mt-6">
          {/* Log Filters */}
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

                <Button 
                  variant="destructive" 
                  onClick={handleClearLogs}
                  className="gap-2"
                >
                  <Trash2 className="h-4 w-4" />
                  Logs löschen
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Log Table */}
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
                    <Badge 
                      variant="outline" 
                      className="border-green-500/50 bg-green-500/10 text-green-600 dark:text-green-400 text-[10px]"
                    >
                      AUTO 5 Min
                    </Badge>
                  </div>
                </div>
                
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mr-2">
                    <div className="flex items-center gap-1">
                      <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse"></div>
                      <span>Auto-Reload 5 Min</span>
                    </div>
                    <div className="h-3 w-px bg-border"></div>
                    <div className="flex items-center gap-1">
                      <div className="h-2 w-2 rounded-full bg-blue-500"></div>
                      <span>Snapshot-Tracking</span>
                    </div>
                  </div>
                  
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      console.log('🔄 [InventoryManager] Manueller Reload gestartet');
                      syncFromStateV(false);
                      loadLogs();
                    }}
                    disabled={loading}
                    className="gap-2"
                  >
                    <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                    Laden
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-6">
              {/* Info Alert */}
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
                    🔄 Vollautomatisch: Alle 5 Minuten via State-V API<br/>
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
                        <TableHead>Typ</TableHead>
                        <TableHead className="text-right">Menge</TableHead>
                        <TableHead>Grund</TableHead>
                        <TableHead>Notizen</TableHead>
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
            <Select value={statsDayRange} onValueChange={(value) => {
              setStatsDayRange(value);
            }}>
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
              {/* Stats Overview */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <Card className="bg-card border border-primary/20">
                  <CardHeader>
                    <CardTitle className="text-sm text-muted-foreground">Gesamt-Bewegungen</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold text-primary">{stats.totalMovements}</div>
                    <div className="text-sm text-muted-foreground mt-1">
                      Erfasste Bewegungen
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-card border border-primary/20">
                  <CardHeader>
                    <CardTitle className="text-sm text-muted-foreground">Betroffene Artikel</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold text-primary">{stats.affectedItems}</div>
                    <div className="text-sm text-muted-foreground mt-1">
                      Verschiedene Artikel
                    </div>
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

              {/* Top Eingänge */}
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

              {/* Top Ausgänge */}
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