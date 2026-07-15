import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from './ui/dialog';
import {
  ShoppingCart, Plus, Trash2, Users, Package, CheckCircle, Archive as ArchiveIcon,
} from 'lucide-react';
import { useOrderStore, Order, OrderItem, OrderStatus } from '../store/orderStore';
import { StatusIndicator } from './StatusIndicator';
import { CustomerManager } from './CustomerManager';
import { ItemManager } from './ItemManager';
import { toast } from 'sonner';

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(amount);

const calcTotal = (order: Pick<Order, 'items' | 'taxRate' | 'taxSign'>) => {
  const subtotal = (order.items || []).reduce((sum, item) => {
    const t = (item.price || 0) * (item.qty || 0);
    return sum + (t - t * ((item.disc || 0) / 100));
  }, 0);
  const tax = subtotal * ((order.taxRate || 0) / 100);
  return order.taxSign === 'plus' ? subtotal + tax : Math.max(0, subtotal - tax);
};

export default function OrderManager() {
  const {
    ordersOpen, ordersDone, customers, items, addOrder, updateOrder, moveToArchive,
  } = useOrderStore();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [customerId, setCustomerId] = useState('');
  const [lineItems, setLineItems] = useState<OrderItem[]>([]);
  const [taxRate, setTaxRate] = useState('19');
  const [ref, setRef] = useState('');

  const resetForm = () => {
    setCustomerId('');
    setLineItems([]);
    setTaxRate('19');
    setRef('');
  };

  const addLine = () => {
    const first = items[0];
    setLineItems((prev) => [
      ...prev,
      { name: first?.name || 'Artikel', price: first?.price || 0, qty: 1, disc: 0 },
    ]);
  };

  const updateLine = (idx: number, patch: Partial<OrderItem>) => {
    setLineItems((prev) => prev.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
  };

  const removeLine = (idx: number) => setLineItems((prev) => prev.filter((_, i) => i !== idx));

  const handleCreate = () => {
    const customer = customers.find((c) => c.id === customerId);
    if (!customer || lineItems.length === 0) {
      toast.error('Bitte Kunde und mindestens einen Artikel wählen');
      return;
    }
    addOrder({
      ref: ref || undefined,
      customerName: customer.name,
      customerEmail: customer.email,
      customerPhone: customer.phone,
      items: lineItems,
      taxRate: parseFloat(taxRate) || 0,
      taxSign: 'plus',
    });
    toast.success('Auftrag erstellt', { description: `Für ${customer.name}` });
    resetForm();
    setDialogOpen(false);
  };

  const draftTotal = calcTotal({ items: lineItems, taxRate: parseFloat(taxRate) || 0, taxSign: 'plus' });

  const renderOrderCard = (order: Order, done: boolean) => (
    <div key={order.id} className="border rounded-lg p-4 hover:border-primary/30 transition-colors bg-card/50">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <h3 className="font-medium">{order.number}</h3>
            {order.ref && <Badge variant="outline" className="text-xs">{order.ref}</Badge>}
            <StatusIndicator orderId={order.id} status={order.status} />
          </div>
          <p className="text-sm text-muted-foreground">{order.customerName} • {order.customerEmail}</p>
          <p className="text-xs text-muted-foreground mt-1">
            {order.items.length} Artikel • {new Date(order.createdAt).toLocaleDateString('de-DE')}
          </p>
        </div>
        <div className="text-right shrink-0">
          <div className="font-semibold text-primary">{formatCurrency(calcTotal(order))}</div>
          <div className="mt-2 flex flex-col gap-2 items-end">
            {!done ? (
              <Select value={order.status} onValueChange={(v) => updateOrder(order.id, { status: v as OrderStatus })}>
                <SelectTrigger className="h-8 w-44 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Ausstehend">Ausstehend</SelectItem>
                  <SelectItem value="In Bearbeitung">In Bearbeitung</SelectItem>
                  <SelectItem value="Warten auf Zahlung">Warten auf Zahlung</SelectItem>
                  <SelectItem value="Gezahlt">Gezahlt</SelectItem>
                  <SelectItem value="Abgeschlossen">Abgeschlossen</SelectItem>
                </SelectContent>
              </Select>
            ) : (
              <div className="flex gap-2">
                {order.status !== 'Abgeschlossen' && (
                  <Button size="sm" variant="outline" className="gap-1"
                    onClick={() => { updateOrder(order.id, { status: 'Abgeschlossen' }); toast.success('Auftrag abgeschlossen'); }}>
                    <CheckCircle className="h-3 w-3" /> Abschließen
                  </Button>
                )}
                <Button size="sm" variant="outline" className="gap-1"
                  onClick={() => { moveToArchive(order.id); toast.success('Auftrag archiviert'); }}>
                  <ArchiveIcon className="h-3 w-3" /> Archivieren
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <Card className="bg-card border border-primary/20 shadow-lg shadow-primary/5">
        <CardHeader className="flex flex-row items-center justify-between border-b border-primary/20">
          <div>
            <CardTitle className="flex items-center gap-2">
              <div className="p-1.5 bg-primary/90 rounded-md shadow-md shadow-primary/10">
                <ShoppingCart className="h-4 w-4 text-primary-foreground" />
              </div>
              <span className="text-black dark:text-white">Aufträge</span>
            </CardTitle>
            <CardDescription className="mt-1">Kundenaufträge verwalten und Status verfolgen</CardDescription>
          </div>
          <Button onClick={() => setDialogOpen(true)} className="gap-2">
            <Plus className="h-4 w-4" /> Neuer Auftrag
          </Button>
        </CardHeader>
      </Card>

      <Tabs defaultValue="open" className="w-full">
        <TabsList>
          <TabsTrigger value="open" className="gap-2"><ShoppingCart className="h-4 w-4" />Offen ({ordersOpen.length})</TabsTrigger>
          <TabsTrigger value="done" className="gap-2"><CheckCircle className="h-4 w-4" />Erledigt ({ordersDone.length})</TabsTrigger>
          <TabsTrigger value="customers" className="gap-2"><Users className="h-4 w-4" />Kunden</TabsTrigger>
          <TabsTrigger value="items" className="gap-2"><Package className="h-4 w-4" />Artikel</TabsTrigger>
        </TabsList>

        <TabsContent value="open" className="mt-4 space-y-3">
          {ordersOpen.length > 0 ? ordersOpen.map((o) => renderOrderCard(o, false)) : (
            <div className="text-center py-12 text-muted-foreground">
              <ShoppingCart className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Keine offenen Aufträge</p>
            </div>
          )}
        </TabsContent>

        <TabsContent value="done" className="mt-4 space-y-3">
          {ordersDone.length > 0 ? ordersDone.map((o) => renderOrderCard(o, true)) : (
            <div className="text-center py-12 text-muted-foreground">
              <CheckCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Keine erledigten Aufträge</p>
            </div>
          )}
        </TabsContent>

        <TabsContent value="customers" className="mt-4"><CustomerManager /></TabsContent>
        <TabsContent value="items" className="mt-4"><ItemManager /></TabsContent>
      </Tabs>

      {/* Create Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) resetForm(); }}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Plus className="h-5 w-5 text-primary" />Neuer Auftrag</DialogTitle>
            <DialogDescription>Kunde und Artikel auswählen, Mengen und Rabatte festlegen.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Kunde</Label>
                <Select value={customerId} onValueChange={setCustomerId}>
                  <SelectTrigger><SelectValue placeholder="Kunde wählen" /></SelectTrigger>
                  <SelectContent>
                    {customers.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Referenz (optional)</Label>
                <Input value={ref} onChange={(e) => setRef(e.target.value)} placeholder="REF-..." />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Artikel</Label>
                <Button size="sm" variant="outline" onClick={addLine} className="gap-1"><Plus className="h-3 w-3" />Position</Button>
              </div>
              {lineItems.length === 0 && <p className="text-sm text-muted-foreground">Noch keine Positionen.</p>}
              {lineItems.map((line, idx) => (
                <div key={idx} className="grid grid-cols-12 gap-2 items-end border rounded-md p-2">
                  <div className="col-span-5 space-y-1">
                    <Label className="text-xs">Artikel</Label>
                    <Select
                      value={line.name}
                      onValueChange={(v) => {
                        const it = items.find((i) => i.name === v);
                        updateLine(idx, { name: v, price: it?.price ?? line.price });
                      }}
                    >
                      <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {items.map((i) => <SelectItem key={i.id} value={i.name}>{i.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-2 space-y-1">
                    <Label className="text-xs">Menge</Label>
                    <Input type="number" min={1} value={line.qty} onChange={(e) => updateLine(idx, { qty: parseInt(e.target.value) || 0 })} className="h-9" />
                  </div>
                  <div className="col-span-2 space-y-1">
                    <Label className="text-xs">Preis</Label>
                    <Input type="number" value={line.price} onChange={(e) => updateLine(idx, { price: parseFloat(e.target.value) || 0 })} className="h-9" />
                  </div>
                  <div className="col-span-2 space-y-1">
                    <Label className="text-xs">Rabatt %</Label>
                    <Input type="number" min={0} max={100} value={line.disc} onChange={(e) => updateLine(idx, { disc: parseFloat(e.target.value) || 0 })} className="h-9" />
                  </div>
                  <div className="col-span-1">
                    <Button size="icon" variant="ghost" onClick={() => removeLine(idx)}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-4 items-end">
              <div className="space-y-2">
                <Label>Steuersatz %</Label>
                <Input type="number" value={taxRate} onChange={(e) => setTaxRate(e.target.value)} />
              </div>
              <div className="text-right">
                <div className="text-sm text-muted-foreground">Gesamtsumme</div>
                <div className="text-xl font-semibold text-primary">{formatCurrency(draftTotal)}</div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setDialogOpen(false); resetForm(); }}>Abbrechen</Button>
            <Button onClick={handleCreate}>Auftrag erstellen</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
