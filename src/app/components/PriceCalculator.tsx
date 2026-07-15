import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Calculator, Plus, Trash2, Flame } from 'lucide-react';
import { useOrderStore } from '../store/orderStore';
import SmeltingCalculator from './SmeltingCalculator';

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(amount);

interface Line { name: string; price: number; qty: number; disc: number; }

export default function PriceCalculator({ syncTrigger = 0 }: { syncTrigger?: number } = {}) {
  const { items } = useOrderStore();
  const [lines, setLines] = useState<Line[]>([]);
  const [taxRate, setTaxRate] = useState('19');
  const [taxSign, setTaxSign] = useState<'plus' | 'minus'>('plus');

  const addLine = () => {
    const first = items[0];
    setLines((p) => [...p, { name: first?.name || 'Artikel', price: first?.price || 0, qty: 1, disc: 0 }]);
  };
  const update = (i: number, patch: Partial<Line>) => setLines((p) => p.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  const remove = (i: number) => setLines((p) => p.filter((_, idx) => idx !== i));

  const subtotal = lines.reduce((s, l) => { const t = l.price * l.qty; return s + (t - t * (l.disc / 100)); }, 0);
  const tax = subtotal * ((parseFloat(taxRate) || 0) / 100);
  const total = taxSign === 'plus' ? subtotal + tax : Math.max(0, subtotal - tax);

  return (
    <Tabs defaultValue="price" className="space-y-6">
      <TabsList>
        <TabsTrigger value="price" className="gap-1.5"><Calculator className="h-4 w-4" />Preis</TabsTrigger>
        <TabsTrigger value="smelt" className="gap-1.5"><Flame className="h-4 w-4" />Schmelze</TabsTrigger>
      </TabsList>

      <TabsContent value="price">
      <Card className="bg-card border border-primary/20 shadow-lg shadow-primary/5">
        <CardHeader className="border-b border-primary/20">
          <CardTitle className="flex items-center gap-2">
            <div className="p-1.5 bg-primary/90 rounded-md shadow-md shadow-primary/10">
              <Calculator className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="text-black dark:text-white">Preis-Kalkulator</span>
          </CardTitle>
          <CardDescription>Positionen kombinieren und den Gesamtpreis live berechnen</CardDescription>
        </CardHeader>
        <CardContent className="pt-6 space-y-4">
          <div className="flex items-center justify-between">
            <Label>Positionen</Label>
            <Button size="sm" variant="outline" onClick={addLine} className="gap-1"><Plus className="h-3 w-3" />Position</Button>
          </div>

          {lines.length > 0 ? (
            <div className="overflow-x-auto border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow className="bg-primary/5">
                    <TableHead>Artikel</TableHead>
                    <TableHead>Menge</TableHead>
                    <TableHead>Preis</TableHead>
                    <TableHead>Rabatt %</TableHead>
                    <TableHead className="text-right">Summe</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lines.map((l, i) => {
                    const t = l.price * l.qty;
                    const sub = t - t * (l.disc / 100);
                    return (
                      <TableRow key={i}>
                        <TableCell className="min-w-40">
                          <Select value={l.name} onValueChange={(v) => { const it = items.find((x) => x.name === v); update(i, { name: v, price: it?.price ?? l.price }); }}>
                            <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                            <SelectContent>{items.map((x) => <SelectItem key={x.id} value={x.name}>{x.name}</SelectItem>)}</SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell><Input type="number" min={1} value={l.qty} onChange={(e) => update(i, { qty: parseInt(e.target.value) || 0 })} className="h-9 w-20" /></TableCell>
                        <TableCell><Input type="number" value={l.price} onChange={(e) => update(i, { price: parseFloat(e.target.value) || 0 })} className="h-9 w-24" /></TableCell>
                        <TableCell><Input type="number" min={0} max={100} value={l.disc} onChange={(e) => update(i, { disc: parseFloat(e.target.value) || 0 })} className="h-9 w-20" /></TableCell>
                        <TableCell className="text-right font-medium">{formatCurrency(sub)}</TableCell>
                        <TableCell><Button size="icon" variant="ghost" onClick={() => remove(i)}><Trash2 className="h-4 w-4" /></Button></TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Füge Positionen hinzu, um die Kalkulation zu starten.</p>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
            <div className="flex gap-3 items-end">
              <div className="space-y-2 flex-1">
                <Label>Steuersatz %</Label>
                <Input type="number" value={taxRate} onChange={(e) => setTaxRate(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Vorzeichen</Label>
                <Select value={taxSign} onValueChange={(v) => setTaxSign(v as 'plus' | 'minus')}>
                  <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="plus">+ (Aufschlag)</SelectItem>
                    <SelectItem value="minus">− (Abzug)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2 p-4 bg-muted/50 rounded-lg">
              <div className="flex justify-between text-sm"><span className="text-muted-foreground">Zwischensumme</span><span>{formatCurrency(subtotal)}</span></div>
              <div className="flex justify-between text-sm"><span className="text-muted-foreground">Steuer ({taxSign === 'plus' ? '+' : '−'}{taxRate}%)</span><span>{formatCurrency(tax)}</span></div>
              <div className="flex justify-between pt-2 border-t border-border"><span className="font-semibold">Gesamt</span><span className="font-semibold text-primary text-lg">{formatCurrency(total)}</span></div>
            </div>
          </div>
        </CardContent>
      </Card>
      </TabsContent>

      <TabsContent value="smelt">
        <Card className="bg-card border border-primary/20 shadow-lg shadow-primary/5">
          <CardHeader className="border-b border-primary/20">
            <CardTitle className="flex items-center gap-2">
              <div className="p-1.5 bg-primary/90 rounded-md shadow-md shadow-primary/10">
                <Flame className="h-4 w-4 text-primary-foreground" />
              </div>
              <span className="text-black dark:text-white">Schmelz-Kalkulator</span>
            </CardTitle>
            <CardDescription>Benötigte Materialien pro Produktion berechnen</CardDescription>
          </CardHeader>
          <SmeltingCalculator />
        </Card>
      </TabsContent>
    </Tabs>
  );
}
