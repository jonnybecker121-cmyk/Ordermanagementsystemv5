import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Input } from './ui/input';
import { Separator } from './ui/separator';
import { 
  Archive,
  Search,
  Trash2,
  Calendar,
  DollarSign,
  Package,
  AlertTriangle,
  FileText,
  Download,
  RotateCcw
} from 'lucide-react';
import { useOrderStore, Order } from './store/orderStore';

interface ArchiveManagerProps {
  syncTrigger?: number;
}

export default function ArchiveManager({ syncTrigger = 0 }: ArchiveManagerProps = {}) {
  const { ordersArchive, ordersDone, restoreFromArchive, deleteFromArchive, moveToArchive, autoArchiveCompleted } = useOrderStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'date' | 'customer' | 'amount'>('date');
  
  // 🔥 Live-Sync: Reload bei Tab-Wechsel
  useEffect(() => {
    if (syncTrigger > 0) {
      console.log('🔄 [ArchiveManager] Live-Sync triggered');
    }
  }, [syncTrigger]);

  // Calculate order total
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

  // Filter and sort archived orders
  const filteredOrders = ordersArchive
    .filter(order => {
      if (!searchTerm) return true;
      const searchLower = searchTerm.toLowerCase();
      return (
        (order.customerName?.toLowerCase() || '').includes(searchLower) ||
        (order.number?.toLowerCase() || '').includes(searchLower) ||
        (order.ref?.toLowerCase() || '').includes(searchLower) ||
        (order.customerEmail?.toLowerCase() || '').includes(searchLower)
      );
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'customer':
          return (a.customerName || '').localeCompare(b.customerName || '');
        case 'amount':
          return calculateOrderTotal(b) - calculateOrderTotal(a);
        case 'date':
        default:
          return new Date(b.finishedAt || b.createdAt).getTime() - 
                 new Date(a.finishedAt || a.createdAt).getTime();
      }
    });

  const completedOrdersCount = ordersDone.filter(o => o.status === 'Abgeschlossen').length;
  const totalArchivedValue = filteredOrders.reduce((sum, order) => sum + calculateOrderTotal(order), 0);

  const handleRestore = (orderId: string) => {
    restoreFromArchive(orderId);
    
    // Show success message
    if (typeof window !== 'undefined') {
      import('sonner').then(({ toast }) => {
        toast.success('Auftrag wiederhergestellt!', {
          description: 'Der Auftrag wurde aus dem Archiv in die abgeschlossenen Aufträge verschoben.',
        });
      }).catch(() => {
        console.log('Toast notification not available');
      });
    }
  };

  const handleDelete = (orderId: string) => {
    if (confirm('Sind Sie sicher, dass Sie diesen Auftrag permanent löschen möchten? Diese Aktion kann nicht rückgängig gemacht werden.')) {
      deleteFromArchive(orderId);
      
      // Show success message
      if (typeof window !== 'undefined') {
        import('sonner').then(({ toast }) => {
          toast.success('Auftrag gelöscht!', {
            description: 'Der Auftrag wurde permanent aus dem Archiv entfernt.',
          });
        }).catch(() => {
          console.log('Toast notification not available');
        });
      }
    }
  };

  const handleAutoArchive = () => {
    autoArchiveCompleted();
  };

  const exportArchiveData = () => {
    const csvData = filteredOrders.map(order => ({
      'Auftragsnummer': order.number,
      'Referenz': order.ref || '',
      'Kunde': order.customerName,
      'E-Mail': order.customerEmail,
      'Telefon': order.customerPhone || '',
      'Status': order.status,
      'Gesamtbetrag': calculateOrderTotal(order).toFixed(2),
      'Erstellt': new Date(order.createdAt).toLocaleDateString('de-DE'),
      'Abgeschlossen': order.finishedAt ? new Date(order.finishedAt).toLocaleDateString('de-DE') : '',
      'Artikel': order.items?.map(item => `${item.name} (${item.qty}x)`).join('; ') || ''
    }));

    const headers = Object.keys(csvData[0] || {});
    const csvContent = [
      headers.join(','),
      ...csvData.map(row => headers.map(header => `"${row[header as keyof typeof row] || ''}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `archiv_export_${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header with Statistics */}
      <Card className="bg-card border border-primary/20 shadow-lg shadow-primary/5">
        <CardHeader className="border-b border-primary/20 bg-card">
          <CardTitle className="flex items-center gap-2">
            <div className="p-1.5 bg-primary/90 rounded-md shadow-md shadow-primary/10">
              <Archive className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="text-black dark:text-white">Archiv</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="flex items-center gap-3 p-3 border rounded-lg">
              <div className="p-2 bg-blue-100 rounded-md">
                <Archive className="h-4 w-4 text-blue-600" />
              </div>
              <div>
                <div className="font-medium">{ordersArchive.length}</div>
                <div className="text-sm text-muted-foreground">Archivierte Aufträge</div>
              </div>
            </div>
            
            <div className="flex items-center gap-3 p-3 border rounded-lg">
              <div className="p-2 bg-green-100 rounded-md">
                <DollarSign className="h-4 w-4 text-green-600" />
              </div>
              <div>
                <div className="font-medium">${totalArchivedValue.toLocaleString('de-DE', { minimumFractionDigits: 2 })}</div>
                <div className="text-sm text-muted-foreground">Archiv-Gesamtwert</div>
              </div>
            </div>
            
            <div className="flex items-center gap-3 p-3 border rounded-lg">
              <div className="p-2 bg-yellow-100 rounded-md">
                <Package className="h-4 w-4 text-yellow-600" />
              </div>
              <div>
                <div className="font-medium">{completedOrdersCount}</div>
                <div className="text-sm text-muted-foreground">Bereit zum Archivieren</div>
              </div>
            </div>
            
            <div className="flex items-center gap-3 p-3 border rounded-lg">
              <div className="p-2 bg-gray-100 rounded-md">
                <Calendar className="h-4 w-4 text-gray-600" />
              </div>
              <div>
                <div className="font-medium">
                  {ordersArchive.length > 0 
                    ? new Date(Math.max(...ordersArchive.map(o => new Date(o.finishedAt || o.createdAt).getTime())))
                        .toLocaleDateString('de-DE')
                    : 'Keine'
                  }
                </div>
                <div className="text-sm text-muted-foreground">Letztes Archiv</div>
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
            <div className="flex gap-2">
              <Button 
                onClick={handleAutoArchive}
                disabled={completedOrdersCount === 0}
                className="flex items-center gap-2"
              >
                <Archive className="h-4 w-4" />
                Alle Abgeschlossenen archivieren ({completedOrdersCount})
              </Button>
              
              {filteredOrders.length > 0 && (
                <Button 
                  variant="outline"
                  onClick={exportArchiveData}
                  className="flex items-center gap-2"
                >
                  <Download className="h-4 w-4" />
                  CSV Export
                </Button>
              )}
            </div>
            
            <div className="flex gap-2 w-full sm:w-auto">
              <div className="relative flex-1 sm:w-64">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Suchen..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
              
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as 'date' | 'customer' | 'amount')}
                className="px-3 py-2 border border-input bg-background rounded-md text-sm"
              >
                <option value="date">Nach Datum</option>
                <option value="customer">Nach Kunde</option>
                <option value="amount">Nach Betrag</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Archive List */}
      <Card className="bg-card border border-primary/20 shadow-lg shadow-primary/5">
        <CardHeader className="border-b border-primary/20 bg-card">
          <CardTitle className="flex items-center gap-2">
            <div className="p-1.5 bg-primary/90 rounded-md shadow-md shadow-primary/10">
              <FileText className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="text-black dark:text-white">Archivierte Aufträge ({filteredOrders.length})</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {filteredOrders.length > 0 ? (
            <div className="space-y-4">
              {filteredOrders.map((order) => {
                const orderTotal = calculateOrderTotal(order);
                const finishedDate = order.finishedAt ? new Date(order.finishedAt) : new Date(order.createdAt);
                
                return (
                  <div key={order.id} className="border rounded-lg p-4 hover:bg-accent/50 transition-colors">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-medium">{order.number}</h3>
                          {order.ref && (
                            <Badge variant="outline" className="text-xs">
                              {order.ref}
                            </Badge>
                          )}
                          <Badge variant="secondary">
                            {order.status}
                          </Badge>
                        </div>
                        
                        <div className="text-sm text-muted-foreground mb-2">
                          <div><strong>{order.customerName}</strong></div>
                          <div>{order.customerEmail}</div>
                          {order.customerPhone && <div>{order.customerPhone}</div>}
                        </div>
                        
                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            Archiviert: {finishedDate.toLocaleDateString('de-DE')}
                          </span>
                          <span className="flex items-center gap-1">
                            <DollarSign className="h-3 w-3" />
                            ${orderTotal.toLocaleString('de-DE', { minimumFractionDigits: 2 })}
                          </span>
                          <span className="flex items-center gap-1">
                            <Package className="h-3 w-3" />
                            {order.items?.length || 0} Artikel
                          </span>
                        </div>
                      </div>
                      
                      <div className="flex gap-2 ml-4">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleRestore(order.id)}
                          className="flex items-center gap-1"
                          title="Auftrag wiederherstellen"
                        >
                          <RotateCcw className="h-3 w-3" />
                          Wiederherstellen
                        </Button>
                        
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDelete(order.id)}
                          className="flex items-center gap-1 text-red-600 hover:text-red-700"
                          title="Auftrag permanent löschen"
                        >
                          <Trash2 className="h-3 w-3" />
                          Löschen
                        </Button>
                      </div>
                    </div>
                    
                    {order.items && order.items.length > 0 && (
                      <>
                        <Separator className="my-3" />
                        <div className="space-y-1">
                          <div className="text-xs font-medium text-muted-foreground mb-2">Artikel:</div>
                          {order.items.slice(0, 3).map((item, index) => (
                            <div key={index} className="text-xs text-muted-foreground flex justify-between">
                              <span>{item.name} (x{item.qty})</span>
                              <span>${((item.price * item.qty) * (1 - item.disc / 100)).toFixed(2)}</span>
                            </div>
                          ))}
                          {order.items.length > 3 && (
                            <div className="text-xs text-muted-foreground italic">
                              ... und {order.items.length - 3} weitere Artikel
                            </div>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-12">
              <Archive className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
              <h3 className="font-medium mb-2">Kein Archiv vorhanden</h3>
              <p className="text-sm text-muted-foreground mb-4">
                {searchTerm 
                  ? 'Keine Aufträge entsprechen Ihren Suchkriterien.'
                  : 'Noch keine Aufträge wurden archiviert.'
                }
              </p>
              {completedOrdersCount > 0 && (
                <Button onClick={handleAutoArchive} className="flex items-center gap-2 mx-auto">
                  <Archive className="h-4 w-4" />
                  {completedOrdersCount} abgeschlossene Aufträge archivieren
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {completedOrdersCount > 0 && (
        <Card className="border-yellow-200 bg-yellow-50">
          <CardContent className="pt-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5" />
              <div className="flex-1">
                <h4 className="font-medium text-yellow-800 mb-1">
                  Aufträge bereit zum Archivieren
                </h4>
                <p className="text-sm text-yellow-700 mb-3">
                  Sie haben {completedOrdersCount} abgeschlossene Aufträge, die archiviert werden können. 
                  Archivierte Aufträge werden aus der aktiven Liste entfernt, bleiben aber für Berichte verfügbar.
                </p>
                <Button 
                  onClick={handleAutoArchive}
                  size="sm"
                  className="bg-yellow-600 hover:bg-yellow-700 text-white"
                >
                  <Archive className="h-4 w-4 mr-2" />
                  Jetzt archivieren
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}