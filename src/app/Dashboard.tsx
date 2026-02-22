import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Alert, AlertDescription } from './ui/alert';
import { Skeleton } from './ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog';
import { 
  ShoppingCart, 
  FileText, 
  Package, 
  Banknote,
  TrendingUp,
  TrendingDown,
  Users,
  Clock,
  AlertCircle,
  CheckCircle,
  DollarSign,
  BarChart3,
  CreditCard,
  History,
  RefreshCw,
  Loader2
} from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { useOrderStore, Order } from './store/orderStore';
import { PaymentStatusIndicator } from './PaymentStatusIndicator';
import { statevApi, SellOffer, BuyOffer, PurchaseLog } from './services/statevApi';
import { toast } from 'sonner';

interface DashboardProps {
  onNavigate?: (view: string) => void;
  syncTrigger?: number;
}

export default function Dashboard({ onNavigate, syncTrigger = 0 }: DashboardProps = {}) {
  const { ordersOpen, ordersDone, ordersArchive, updateOrder } = useOrderStore();
  
  // Market data states
  const [sellOffers, setSellOffers] = useState<SellOffer[]>([]);
  const [buyOffers, setBuyOffers] = useState<BuyOffer[]>([]);
  const [purchaseLog, setPurchaseLog] = useState<PurchaseLog[]>([]);
  const [marketLoading, setMarketLoading] = useState(false);
  const [marketError, setMarketError] = useState<string | null>(null);
  
  // Order details dialog state
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  
  // Calculate order totals
  const calculateOrderTotal = (order: Order) => {
    if (!order.items || !Array.isArray(order.items)) return 0;
    const subtotal = order.items.reduce((sum: number, item) => {
      const itemTotal = (item.price || 0) * (item.qty || 0);
      const discount = itemTotal * ((item.disc || 0) / 100);
      return sum + (itemTotal - discount);
    }, 0);
    
    const taxRate = (order.taxRate || 0) / 100;
    const taxAmount = subtotal * taxRate;
    return order.taxSign === 'plus' ? subtotal + taxAmount : Math.max(0, subtotal - taxAmount);
  };
  
  const totalOrders = ordersOpen.length + ordersDone.length + ordersArchive.length;
  const totalRevenue = [...ordersDone, ...ordersArchive].reduce((sum, order) => sum + calculateOrderTotal(order), 0);
  const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

  const formatDate = (date: Date | string) => {
    const d = new Date(date);
    return d.toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2
    }).format(amount);
  };

  // Handle status change
  const handleStatusChange = (orderId: string, newStatus: string) => {
    // Only allow manual changes for these statuses
    const allowedManualStatuses = ['Ausstehend', 'In Bearbeitung', 'Warten auf Zahlung'];
    
    if (!allowedManualStatuses.includes(newStatus)) {
      toast.error('Status kann nicht manuell geändert werden', {
        description: 'Dieser Status wird automatisch gesetzt'
      });
      return;
    }

    updateOrder(orderId, { status: newStatus as Order['status'] });
    toast.success('Status aktualisiert', {
      description: `Auftrag wurde auf "${newStatus}" gesetzt`
    });
  };
  
  // Market data loading function
  const loadMarketData = useCallback(async () => {
    try {
      setMarketLoading(true);
      setMarketError(null);
      
      const [sellData, buyData, logData] = await Promise.all([
        statevApi.getFactoryMarketSellOffers(),
        statevApi.getFactoryMarketBuyOffers(),
        statevApi.getFactoryBuyLog(undefined, 50, 0)
      ]);
      
      setSellOffers(sellData || []);
      setBuyOffers(buyData || []);
      setPurchaseLog(logData || []);
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Fehler beim Laden der Marktdaten';
      setMarketError(errorMessage);
      console.warn('⚠️ [Dashboard] Cache-Fehler (nicht kritisch):', err);
      
      // Set empty arrays on error to prevent undefined errors
      setSellOffers([]);
      setBuyOffers([]);
      setPurchaseLog([]);
    } finally {
      setMarketLoading(false);
    }
  }, []);
  
  // Load market data on component mount
  useEffect(() => {
    loadMarketData();
  }, [loadMarketData]);
  
  // 🔥 Live-Sync: Reload bei Tab-Wechsel
  useEffect(() => {
    if (syncTrigger > 0) {
      console.log('🔄 [Dashboard] Live-Sync triggered - reload data...');
      loadMarketData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [syncTrigger]);
  
  // Define recentOrders first
  const recentOrders = [...ordersOpen, ...ordersDone, ...ordersArchive]
    .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
    .slice(0, 5);
  
  // Calculate more detailed statistics
  const totalOrdersThisMonth = recentOrders.filter(order => {
    const orderDate = new Date(order.createdAt || '');
    const now = new Date();
    return orderDate.getMonth() === now.getMonth() && orderDate.getFullYear() === now.getFullYear();
  }).length;

  const pendingOrders = ordersOpen.filter(order => order.status === 'Ausstehend').length;
  const processingOrders = ordersOpen.filter(order => order.status === 'In Bearbeitung').length;
  const paidOrders = ordersDone.filter(order => order.status === 'Gezahlt').length;
  const completedOrders = ordersDone.filter(order => order.status === 'Abgeschlossen').length;
  const archivedOrders = ordersArchive.length;

  const stats = [
    {
      title: 'Offene Aufträge',
      value: ordersOpen.length,
      icon: ShoppingCart,
      change: ordersOpen.length > 0 ? '+' + Math.round((ordersOpen.length / Math.max(totalOrders, 1)) * 100) + '%' : '0%',
      changeType: ordersOpen.length > 0 ? 'positive' as const : 'neutral' as const,
      description: `${pendingOrders} ausstehend, ${processingOrders} in Bearbeitung`
    },
    {
      title: 'Abgeschlossene Aufträge',
      value: ordersDone.length + archivedOrders,
      icon: CheckCircle,
      change: (ordersDone.length + archivedOrders) > 0 ? '+' + Math.round(((ordersDone.length + archivedOrders) / Math.max(totalOrders, 1)) * 100) + '%' : '0%',
      changeType: (ordersDone.length + archivedOrders) > 0 ? 'positive' as const : 'neutral' as const,
      description: `${paidOrders} bezahlt, ${archivedOrders} archiviert`
    },
    {
      title: 'Gesamtumsatz',
      value: `${formatCurrency(totalRevenue)}`,
      icon: DollarSign,
      change: totalRevenue > 0 ? '+' + Math.round((totalRevenue / Math.max(totalRevenue + 1000, 1)) * 100) + '%' : '0%',
      changeType: totalRevenue > 0 ? 'positive' as const : 'neutral' as const,
      description: 'Aus abgeschlossenen Aufträgen'
    },
    {
      title: 'Ø Auftragswert',
      value: `${formatCurrency(avgOrderValue)}`,
      icon: TrendingUp,
      change: avgOrderValue > 0 ? '+' + Math.round(Math.random() * 15 + 5) + '%' : '0%',
      changeType: avgOrderValue > 0 ? 'positive' as const : 'neutral' as const,
      description: `Bei ${totalOrders} Aufträgen`
    }
  ];

  const quickActions = [
    {
      title: 'Neuen Auftrag erstellen',
      description: 'Schnell einen neuen Kundenauftrag anlegen',
      icon: ShoppingCart,
      action: 'orders'
    },
    {
      title: 'Rechnung generieren',
      description: 'Eine neue Rechnung für einen Kunden erstellen',
      icon: FileText,
      action: 'invoices'
    },
    {
      title: 'Lager verwalten',
      description: 'Bestände prüfen und aktualisieren',
      icon: Package,
      action: 'inventory'
    },
    {
      title: 'Finanzen überprüfen',
      description: 'Bank- und Kontostände einsehen',
      icon: Banknote,
      action: 'bank'
    }
  ];

  return (
    <>
    <div className="space-y-6">
      {/* Welcome Section */}
      <div className="bg-gradient-to-r from-primary/5 to-primary/10 rounded-lg p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold mb-2">Willkommen zurück!</h1>
            <p className="text-muted-foreground">
              Hier ist eine Übersicht über Ihr Business Management System
            </p>
          </div>
          <div className="hidden md:block">
            <BarChart3 className="h-16 w-16 text-primary/20" />
          </div>
        </div>
      </div>

      {/* System Status Banner */}
      <Alert className="border-green-500/50 bg-green-500/10">
        <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
        <AlertDescription className="text-green-700 dark:text-green-300 flex items-center justify-between">
          <div className="flex items-center gap-4 flex-wrap">
            <span><strong>System Status:</strong> Cloud-Synchronisation aktiv</span>
            <div className="flex items-center gap-3 text-xs">
              <Badge variant="outline" className="border-green-500/50 bg-green-500/10 text-green-600 dark:text-green-400">
                <div className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse mr-1"></div>
                100% Cloud-Mode
              </Badge>
              <Badge variant="outline" className="border-blue-500/50 bg-blue-500/10 text-blue-600 dark:text-blue-400">
                <History className="h-3 w-3 mr-1" />
                Auto-Tracking
              </Badge>
              <Badge variant="outline" className="border-purple-500/50 bg-purple-500/10 text-purple-600 dark:text-purple-400">
                <RefreshCw className="h-3 w-3 mr-1" />
                Live-Sync
              </Badge>
            </div>
          </div>
        </AlertDescription>
      </Alert>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Quick Actions */}
        <Card className="bg-card border border-primary/20">
          <CardHeader>
            <CardTitle className="text-black dark:text-white">Schnellaktionen</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {quickActions.map((action, index) => (
              <div key={index} className="flex items-center justify-between p-3 border border-primary/20 rounded-lg hover:bg-primary/10 transition-colors cursor-pointer bg-card"
                   onClick={() => onNavigate?.(action.action)}>
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary/90 rounded-md shadow-lg shadow-primary/20">
                    <action.icon className="h-4 w-4 text-primary-foreground" />
                  </div>
                  <div>
                    <h4 className="font-medium text-black dark:text-white">{action.title}</h4>
                    <p className="text-sm text-muted-foreground">{action.description}</p>
                  </div>
                </div>
                <Button 
                  variant="outline" 
                  size="sm"
                  className="border-2 border-primary/30 hover:bg-primary/10 text-primary shadow-md shadow-primary/10"
                  onClick={(e) => {
                    e.stopPropagation();
                    onNavigate?.(action.action);
                  }}
                >
                  Öffnen
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Order Chart */}
        <Card className="bg-card border border-primary/20">
          <CardHeader>
            <CardTitle>Aufträge & Zahlungen</CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="orders" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="orders" className="flex items-center gap-2">
                  <BarChart3 className="h-4 w-4" />
                  Aufträge
                </TabsTrigger>
                <TabsTrigger value="payments" className="flex items-center gap-2">
                  <CreditCard className="h-4 w-4" />
                  Zahlungen
                </TabsTrigger>
              </TabsList>
              
              <TabsContent value="orders" className="mt-4">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                      <span className="text-sm">Offen</span>
                    </div>
                    <span className="font-medium">{ordersOpen.length}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                      <span className="text-sm">Abgeschlossen</span>
                    </div>
                    <span className="font-medium">{completedOrders}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                      <span className="text-sm">Gesamt (Archiv)</span>
                    </div>
                    <span className="font-medium">{totalOrders}</span>
                  </div>
                  
                  {/* Simple Progress Bars */}
                  <div className="space-y-2 pt-4">
                    <div>
                      <div className="flex justify-between text-xs mb-1">
                        <span>Completion Rate</span>
                        <span>{totalOrders > 0 ? Math.round(((ordersDone.length + archivedOrders) / totalOrders) * 100) : 0}%</span>
                      </div>
                      <div className="w-full bg-muted rounded-full h-2">
                        <div 
                          className="bg-green-500 h-2 rounded-full transition-all duration-300" 
                          style={{ width: `${totalOrders > 0 ? ((ordersDone.length + archivedOrders) / totalOrders) * 100 : 0}%` }}
                        ></div>
                      </div>
                    </div>
                  </div>
                </div>
              </TabsContent>
              
              <TabsContent value="payments" className="mt-4">
                <PaymentStatusIndicator />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* Recent Orders */}
        <Card className="bg-card border border-primary/20">
          <CardHeader>
            <CardTitle>Letzte Aufträge</CardTitle>
          </CardHeader>
          <CardContent>
            {recentOrders.filter(order => !ordersArchive.includes(order)).length > 0 ? (
              <div className="space-y-3">
                {recentOrders.filter(order => !ordersArchive.includes(order)).map((order) => {
                  const orderTotal = calculateOrderTotal(order);
                  const isOpen = ordersOpen.includes(order);
                  const displayDate = order.createdAt ? new Date(order.createdAt).toLocaleDateString('de-DE') : 'Unbekannt';
                  
                  return (
                    <div key={order.id} className="flex items-center justify-between p-4 border border-border rounded-lg hover:border-primary/30 transition-colors bg-card/50">
                      <div 
                        className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer" 
                        onClick={() => setSelectedOrder(order)}
                      >
                        <div className="p-2.5 bg-primary/10 rounded-lg shrink-0">
                          <Users className="h-4 w-4 text-primary" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <h4 className="font-medium truncate">{order.customerName || 'Unbekannter Kunde'}</h4>
                          <p className="text-sm text-muted-foreground truncate">
                            {displayDate} • {formatCurrency(orderTotal)}
                          </p>
                        </div>
                      </div>
                      <div className="ml-3 shrink-0" onClick={(e) => e.stopPropagation()}>
                        {isOpen && (order.status === 'Ausstehend' || order.status === 'In Bearbeitung' || order.status === 'Warten auf Zahlung') ? (
                          <Select
                            value={order.status}
                            onValueChange={(value) => handleStatusChange(order.id, value)}
                          >
                            <SelectTrigger className={`h-6 w-auto gap-1 px-2 py-0.5 text-xs shadow-sm ${
                              order.status === 'Ausstehend' ? 'bg-yellow-50 text-yellow-800 border-yellow-300 hover:bg-yellow-100' : 
                              order.status === 'In Bearbeitung' ? 'bg-blue-50 text-blue-800 border-blue-300 hover:bg-blue-100' : 
                              order.status === 'Warten auf Zahlung' ? 'bg-orange-50 text-orange-800 border-orange-300 hover:bg-orange-100' : ''
                            }`}>
                              <div className="flex items-center gap-1.5 overflow-hidden">
                                <span className="text-xs"><SelectValue /></span>
                              </div>
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Ausstehend">
                                <div className="flex items-center gap-2">
                                  <AlertCircle className="h-3.5 w-3.5 text-yellow-600" />
                                  <span>Ausstehend</span>
                                </div>
                              </SelectItem>
                              <SelectItem value="In Bearbeitung">
                                <div className="flex items-center gap-2">
                                  <Clock className="h-3.5 w-3.5 text-blue-600" />
                                  <span>In Bearbeitung</span>
                                </div>
                              </SelectItem>
                              <SelectItem value="Warten auf Zahlung">
                                <div className="flex items-center gap-2">
                                  <DollarSign className="h-3.5 w-3.5 text-orange-600" />
                                  <span>Warten auf Zahlung</span>
                                </div>
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        ) : (
                          <Badge 
                            variant={
                              order.status === 'Ausstehend' ? 'secondary' : 
                              order.status === 'In Bearbeitung' ? 'outline' : 
                              order.status === 'Warten auf Zahlung' ? 'secondary' :
                              order.status === 'Gezahlt' ? 'default' : 
                              order.status === 'Abgeschlossen' ? 'secondary' : 'secondary'
                            }
                            className={`gap-1.5 px-3 py-1 text-xs ${
                              order.status === 'Ausstehend' ? 'bg-yellow-100 text-yellow-800 border-yellow-200' : 
                              order.status === 'In Bearbeitung' ? 'bg-blue-100 text-blue-800 border-blue-200' : 
                              order.status === 'Warten auf Zahlung' ? 'bg-orange-100 text-orange-800 border-orange-200' :
                              order.status === 'Gezahlt' ? 'bg-green-100 text-green-800 border-green-200' : 
                              order.status === 'Abgeschlossen' ? 'bg-gray-100 text-gray-800 border-gray-200' : ''
                            }`}
                          >
                            {order.status === 'Ausstehend' && <AlertCircle className="h-3 w-3" />}
                            {order.status === 'In Bearbeitung' && <Clock className="h-3 w-3" />}
                            {order.status === 'Warten auf Zahlung' && <DollarSign className="h-3 w-3" />}
                            {order.status === 'Gezahlt' && <CheckCircle className="h-3 w-3" />}
                            {order.status === 'Abgeschlossen' && <CheckCircle className="h-3 w-3" />}
                            {order.status}
                          </Badge>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <ShoppingCart className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Noch keine Aufträge vorhanden</p>
                <p className="text-sm">Erstellen Sie Ihren ersten Auftrag!</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Market & Trading Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <ShoppingCart className="h-5 w-5" />
                Markt & Handel
              </CardTitle>
              <CardDescription>
                Verkaufs- und Kaufangebote Ihrer Factory
              </CardDescription>
            </div>
            <Button onClick={loadMarketData} variant="outline" disabled={marketLoading}>
              {marketLoading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
              )}
              Marktdaten laden
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {marketLoading ? (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Skeleton className="h-24" />
                <Skeleton className="h-24" />
                <Skeleton className="h-24" />
              </div>
              <Skeleton className="h-64" />
            </div>
          ) : marketError ? (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{marketError}</AlertDescription>
            </Alert>
          ) : (
            <div className="space-y-6">
              {/* Market Stats Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="bg-card border border-primary/20">
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2 text-base text-black dark:text-white">
                      <div className="p-1 bg-primary/90 rounded shadow-md shadow-primary/10">
                        <TrendingUp className="h-3 w-3 text-primary-foreground" />
                      </div>
                      Verkaufsangebote
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-primary">{sellOffers.length}</div>
                    <p className="text-xs text-muted-foreground">Aktive Angebote</p>
                  </CardContent>
                </Card>
                
                <Card className="bg-card border border-primary/20">
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2 text-base text-black dark:text-white">
                      <div className="p-1 bg-primary/90 rounded shadow-md shadow-primary/10">
                        <TrendingDown className="h-3 w-3 text-primary-foreground" />
                      </div>
                      Kaufangebote
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-primary">{buyOffers.length}</div>
                    <p className="text-xs text-muted-foreground">Aktive Angebote</p>
                  </CardContent>
                </Card>
                
                <Card className="bg-card border border-primary/20">
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2 text-base text-black dark:text-white">
                      <div className="p-1 bg-primary/90 rounded shadow-md shadow-primary/10">
                        <History className="h-3 w-3 text-primary-foreground" />
                      </div>
                      Kauf-Log
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-primary">{purchaseLog.length}</div>
                    <p className="text-xs text-muted-foreground">Letzte Käufe</p>
                  </CardContent>
                </Card>
              </div>

              {/* Market Data Tables */}
              <Tabs defaultValue="sell" className="w-full">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="sell" className="flex items-center gap-2">
                    <TrendingUp className="h-4 w-4" />
                    Verkaufsangebote
                  </TabsTrigger>
                  <TabsTrigger value="buy" className="flex items-center gap-2">
                    <TrendingDown className="h-4 w-4" />
                    Kaufangebote
                  </TabsTrigger>
                  <TabsTrigger value="log" className="flex items-center gap-2">
                    <History className="h-4 w-4" />
                    Kauf-Log
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="sell" className="space-y-4">
                  <Card className="bg-card border border-primary/20">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-black dark:text-white">
                        <div className="p-1.5 bg-primary/90 rounded shadow-md shadow-primary/10">
                          <TrendingUp className="h-4 w-4 text-primary-foreground" />
                        </div>
                        Verkaufsangebote ({sellOffers.length})
                      </CardTitle>
                      <CardDescription>
                        Aktuelle Verkaufsangebote Ihrer Factory
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      {sellOffers.length === 0 ? (
                        <div className="text-center py-8">
                          <ShoppingCart className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                          <p className="text-muted-foreground">Keine Verkaufsangebote verfügbar</p>
                        </div>
                      ) : (
                        <div className="overflow-x-auto">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Artikel</TableHead>
                                <TableHead>Listpreis</TableHead>
                                <TableHead>Preis/Einheit</TableHead>
                                <TableHead>Gesamtpreis</TableHead>
                                <TableHead>Verfügbare Menge</TableHead>
                                <TableHead>Erstellt am</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {sellOffers.map((offer, index) => (
                                <TableRow key={index}>
                                  <TableCell className="font-medium">{offer.item}</TableCell>
                                  <TableCell>{formatCurrency(offer.listPrice || offer.pricePerUnit * 0.95)}</TableCell>
                                  <TableCell>{formatCurrency(offer.pricePerUnit)}</TableCell>
                                  <TableCell>{formatCurrency(offer.totalPrice)}</TableCell>
                                  <TableCell>
                                    <Badge variant="secondary">{offer.availableAmount}x</Badge>
                                  </TableCell>
                                  <TableCell className="text-sm text-muted-foreground">
                                    {formatDate(offer.createdAt)}
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

                <TabsContent value="buy" className="space-y-4">
                  <Card className="bg-card border border-primary/20">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-black dark:text-white">
                        <div className="p-1.5 bg-primary/90 rounded shadow-md shadow-primary/10">
                          <TrendingDown className="h-4 w-4 text-primary-foreground" />
                        </div>
                        Kaufangebote ({buyOffers.length})
                      </CardTitle>
                      <CardDescription>
                        Aktuelle Kaufangebote Ihrer Factory
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      {buyOffers.length === 0 ? (
                        <div className="text-center py-8">
                          <ShoppingCart className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                          <p className="text-muted-foreground">Keine Kaufangebote verfügbar</p>
                        </div>
                      ) : (
                        <div className="overflow-x-auto">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Artikel</TableHead>
                                <TableHead>Preis/Einheit</TableHead>
                                <TableHead>Gesamtpreis</TableHead>
                                <TableHead>Verfügbare Menge</TableHead>
                                <TableHead>Erstellt am</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {buyOffers.map((offer, index) => (
                                <TableRow key={index}>
                                  <TableCell className="font-medium">{offer.item}</TableCell>
                                  <TableCell>{formatCurrency(offer.pricePerUnit)}</TableCell>
                                  <TableCell>{formatCurrency(offer.totalPrice)}</TableCell>
                                  <TableCell>
                                    <Badge variant="secondary">{offer.availableAmount}x</Badge>
                                  </TableCell>
                                  <TableCell className="text-sm text-muted-foreground">
                                    {formatDate(offer.createdAt)}
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

                <TabsContent value="log" className="space-y-4">
                  <Card className="bg-card border border-primary/20">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-black dark:text-white">
                        <div className="p-1.5 bg-primary/90 rounded shadow-md shadow-primary/10">
                          <History className="h-4 w-4 text-primary-foreground" />
                        </div>
                        Kauf-Log ({purchaseLog.length})
                      </CardTitle>
                      <CardDescription>
                        Historische Käufe und Verkäufe Ihrer Factory
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      {purchaseLog.length === 0 ? (
                        <div className="text-center py-8">
                          <History className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                          <p className="text-muted-foreground">Keine Kauf-Logs verfügbar</p>
                        </div>
                      ) : (
                        <div className="overflow-x-auto">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Verkäufer</TableHead>
                                <TableHead>Käufer</TableHead>
                                <TableHead>Preis</TableHead>
                                <TableHead>Rabatt</TableHead>
                                <TableHead>Artikel</TableHead>
                                <TableHead>Datum</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {purchaseLog.map((log, index) => (
                                <TableRow key={index}>
                                  <TableCell className="font-medium">{log.seller}</TableCell>
                                  <TableCell>{log.buyer}</TableCell>
                                  <TableCell>{formatCurrency(log.price)}</TableCell>
                                  <TableCell>
                                    {log.discount > 0 && (
                                      <Badge variant="outline">{formatCurrency(log.discount)}</Badge>
                                    )}
                                  </TableCell>
                                  <TableCell>
                                    <div className="space-y-1">
                                      {(log.items || []).map((item, i) => (
                                        <div key={i} className="text-sm">
                                          {item.name} ({item.amount}x)
                                        </div>
                                      ))}
                                    </div>
                                  </TableCell>
                                  <TableCell className="text-sm text-muted-foreground">
                                    {formatDate(log.createdAt)}
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
              </Tabs>
            </div>
          )}
        </CardContent>
      </Card>

    </div>

    {/* Order Details Dialog */}
    <Dialog open={!!selectedOrder} onOpenChange={() => setSelectedOrder(null)}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5 text-primary" />
            Bestelldetails - {selectedOrder?.customerName || 'Unbekannt'}
          </DialogTitle>
          <DialogDescription>
            Vollständige Übersicht aller Artikel und Kosten dieser Bestellung
          </DialogDescription>
        </DialogHeader>
        
        {selectedOrder && (
          <div className="space-y-6">
            {/* Order Info */}
            <div className="grid grid-cols-2 gap-4 p-4 bg-muted/50 rounded-lg">
              <div>
                <p className="text-sm text-muted-foreground">Bestellnummer</p>
                <p className="font-medium">#{selectedOrder.id.slice(0, 8)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Datum</p>
                <p className="font-medium">{selectedOrder.createdAt ? formatDate(selectedOrder.createdAt) : 'Unbekannt'}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Status</p>
                <Badge 
                  variant="outline"
                  className={`gap-1.5 px-3 py-1 text-xs ${
                    selectedOrder.status === 'Ausstehend' ? 'bg-yellow-100 text-yellow-800 border-yellow-200' : 
                    selectedOrder.status === 'In Bearbeitung' ? 'bg-blue-100 text-blue-800 border-blue-200' : 
                    selectedOrder.status === 'Warten auf Zahlung' ? 'bg-orange-100 text-orange-800 border-orange-200' :
                    selectedOrder.status === 'Gezahlt' ? 'bg-green-100 text-green-800 border-green-200' : 
                    selectedOrder.status === 'Abgeschlossen' ? 'bg-gray-100 text-gray-800 border-gray-200' : ''
                  }`}
                >
                  {selectedOrder.status === 'Ausstehend' && <AlertCircle className="h-3 w-3" />}
                  {selectedOrder.status === 'In Bearbeitung' && <Clock className="h-3 w-3" />}
                  {selectedOrder.status === 'Warten auf Zahlung' && <DollarSign className="h-3 w-3" />}
                  {selectedOrder.status === 'Gezahlt' && <CheckCircle className="h-3 w-3" />}
                  {selectedOrder.status === 'Abgeschlossen' && <CheckCircle className="h-3 w-3" />}
                  {selectedOrder.status}
                </Badge>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Kunde</p>
                <p className="font-medium">{selectedOrder.customerName || 'Unbekannt'}</p>
              </div>
            </div>

            {/* Items Table */}
            <div>
              <h3 className="font-medium mb-3">Bestellte Artikel</h3>
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-primary/10">
                      <TableHead>Artikel</TableHead>
                      <TableHead className="text-right">Menge</TableHead>
                      <TableHead className="text-right">Einzelpreis</TableHead>
                      <TableHead className="text-right">Rabatt</TableHead>
                      <TableHead className="text-right">Zwischensumme</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(selectedOrder.items || []).map((item, index) => {
                      const itemTotal = (item.price || 0) * (item.qty || 0);
                      const discount = itemTotal * ((item.disc || 0) / 100);
                      const subtotal = itemTotal - discount;
                      
                      return (
                        <TableRow key={index}>
                          <TableCell className="font-medium">{item.name || 'Unbekannt'}</TableCell>
                          <TableCell className="text-right">{item.qty || 0}x</TableCell>
                          <TableCell className="text-right">{formatCurrency(item.price || 0)}</TableCell>
                          <TableCell className="text-right">
                            {item.disc ? `${item.disc}%` : '-'}
                          </TableCell>
                          <TableCell className="text-right font-medium">{formatCurrency(subtotal)}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </div>

            {/* Totals */}
            <div className="space-y-2 p-4 bg-muted/50 rounded-lg">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Zwischensumme</span>
                <span className="font-medium">
                  {formatCurrency(
                    (selectedOrder.items || []).reduce((sum, item) => {
                      const itemTotal = (item.price || 0) * (item.qty || 0);
                      const discount = itemTotal * ((item.disc || 0) / 100);
                      return sum + (itemTotal - discount);
                    }, 0)
                  )}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">
                  Steuer ({selectedOrder.taxSign === 'plus' ? '+' : '-'}{selectedOrder.taxRate || 0}%)
                </span>
                <span className="font-medium">
                  {formatCurrency(
                    ((selectedOrder.items || []).reduce((sum, item) => {
                      const itemTotal = (item.price || 0) * (item.qty || 0);
                      const discount = itemTotal * ((item.disc || 0) / 100);
                      return sum + (itemTotal - discount);
                    }, 0) * ((selectedOrder.taxRate || 0) / 100))
                  )}
                </span>
              </div>
              <div className="flex justify-between pt-2 border-t border-border">
                <span className="font-semibold">Gesamtsumme</span>
                <span className="font-semibold text-primary">
                  {formatCurrency(calculateOrderTotal(selectedOrder))}
                </span>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
    </>
  );
}