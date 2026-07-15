import { useMemo, useState } from 'react';
import { CardContent } from './ui/card';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Switch } from './ui/switch';
import { Flame, Tag } from 'lucide-react';
import { RECIPES, FUEL_OPTIONS, PRODUCTS, ALL_MATERIALS } from '../data/recipes';
import { useMaterialPriceStore } from '../store/materialPriceStore';

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(amount);

/**
 * Berechnet die benötigten Materialien für eine gewünschte Zielmenge.
 * Bei `deep` werden Zwischenprodukte (z. B. Eisenbarren für Stahlbarren)
 * rekursiv bis auf Rohstoffe aufgelöst; sonst nur eine Ebene.
 */
function computeMaterials(
  product: string,
  desiredQty: number,
  fuelKey: string,
  deep: boolean,
): { totals: Record<string, number>; runs: number } {
  const totals: Record<string, number> = {};
  const add = (item: string, amount: number) => {
    totals[item] = (totals[item] ?? 0) + amount;
  };

  const rootRecipe = RECIPES[product];
  const rootRuns = Math.ceil(desiredQty / rootRecipe.output);

  const process = (name: string, runs: number) => {
    const recipe = RECIPES[name];
    if (!recipe) return; // Rohstoff → nichts weiter zu tun
    if (recipe.fuel) {
      const fuel = FUEL_OPTIONS[fuelKey];
      add(fuel.item, fuel.amount * runs);
    }
    for (const ing of recipe.inputs) {
      const totalNeeded = ing.amount * runs;
      if (deep && RECIPES[ing.item]) {
        const childRuns = Math.ceil(totalNeeded / RECIPES[ing.item].output);
        process(ing.item, childRuns);
      } else {
        add(ing.item, totalNeeded);
      }
    }
  };

  process(product, rootRuns);
  return { totals, runs: rootRuns };
}

export default function SmeltingCalculator() {
  const { prices, setPrice, sellPrices, setSellPrice } = useMaterialPriceStore();
  const [product, setProduct] = useState<string>(PRODUCTS[0]);
  const [qty, setQty] = useState('1');
  const [fuelKey, setFuelKey] = useState<string>('Kohlebrocken');
  const [deep, setDeep] = useState(false);
  const [showPrices, setShowPrices] = useState(false);

  const recipe = RECIPES[product];
  const desired = Math.max(0, parseInt(qty) || 0);

  const { totals, runs } = useMemo(
    () => computeMaterials(product, desired || 1, fuelKey, deep),
    [product, desired, fuelKey, deep],
  );

  const produced = runs * recipe.output;
  const rows = Object.entries(totals).sort((a, b) => a[0].localeCompare(b[0], 'de'));

  const totalCost = rows.reduce((sum, [item, amount]) => sum + amount * (prices[item] ?? 0), 0);
  const costPerUnit = produced > 0 ? totalCost / produced : 0;

  const sellPrice = sellPrices[product] ?? 0;
  const revenue = produced * sellPrice;
  const profit = revenue - totalCost;
  const profitPerUnit = sellPrice - costPerUnit;
  const margin = revenue > 0 ? (profit / revenue) * 100 : 0;

  return (
    <CardContent className="pt-6 space-y-5">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label>Produkt</Label>
          <Select value={product} onValueChange={setProduct}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {PRODUCTS.map((p) => (
                <SelectItem key={p} value={p}>{p}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">Ausbeute: {recipe.output} Stück pro Durchlauf</p>
        </div>

        <div className="space-y-2">
          <Label>Gewünschte Menge</Label>
          <Input type="number" min={1} value={qty} onChange={(e) => setQty(e.target.value)} />
          <p className="text-xs text-muted-foreground">
            {runs} Durchlauf{runs === 1 ? '' : 'e'} → {produced} Stück
          </p>
        </div>

        <div className="space-y-2">
          <Label>Brennstoff</Label>
          <Select value={fuelKey} onValueChange={setFuelKey} disabled={!recipe.fuel && !deep}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {Object.entries(FUEL_OPTIONS).map(([key, f]) => (
                <SelectItem key={key} value={key}>{f.item} × {f.amount}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            {recipe.fuel || deep ? 'Pro Durchlauf mit Brennstoff' : 'Dieses Rezept nutzt festen Koks'}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/40 px-4 py-3">
        <Switch id="deep" checked={deep} onCheckedChange={setDeep} />
        <div className="flex-1">
          <Label htmlFor="deep" className="cursor-pointer">Zwischenprodukte auflösen</Label>
          <p className="text-xs text-muted-foreground">
            Rechnet Barren/Zwischenstufen bis auf Rohstoffe (Erze) herunter.
          </p>
        </div>
      </div>

      <div className="overflow-x-auto border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow className="bg-primary/5">
              <TableHead>Material</TableHead>
              <TableHead className="text-right">Benötigte Menge</TableHead>
              <TableHead className="text-right">EK-Preis</TableHead>
              <TableHead className="text-right">Kosten</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map(([item, amount]) => {
              const price = prices[item] ?? 0;
              return (
                <TableRow key={item}>
                  <TableCell className="font-medium flex items-center gap-2">
                    {FUEL_OPTIONS[item] && <Flame className="h-3.5 w-3.5 text-primary" />}
                    {item}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{amount.toLocaleString('de-DE')}</TableCell>
                  <TableCell className="text-right">
                    <Input
                      type="number"
                      min={0}
                      step="0.01"
                      value={price || ''}
                      placeholder="0,00"
                      onChange={(e) => setPrice(item, parseFloat(e.target.value) || 0)}
                      className="h-8 w-24 ml-auto text-right"
                    />
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {price > 0 ? formatCurrency(amount * price) : '—'}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Kosten */}
        <div className="space-y-2 p-4 bg-muted/50 rounded-lg">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Materialkosten gesamt</span>
            <span className="font-medium">{formatCurrency(totalCost)}</span>
          </div>
          <div className="flex justify-between pt-2 border-t border-border">
            <span className="font-semibold">Kosten pro Stück</span>
            <span className="font-semibold text-primary text-lg">{formatCurrency(costPerUnit)}</span>
          </div>
        </div>

        {/* Verkauf */}
        <div className="space-y-2 p-4 bg-muted/50 rounded-lg">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Verkaufspreis pro Stück</Label>
            <Input
              type="number"
              min={0}
              step="0.01"
              value={sellPrice || ''}
              placeholder="0,00"
              onChange={(e) => setSellPrice(product, parseFloat(e.target.value) || 0)}
              className="h-9"
            />
          </div>
          <div className="flex justify-between text-sm pt-1">
            <span className="text-muted-foreground">Umsatz ({produced} Stück)</span>
            <span className="font-medium">{formatCurrency(revenue)}</span>
          </div>
        </div>

        {/* Gewinn / Marge */}
        <div className="space-y-2 p-4 rounded-lg border border-primary/30 bg-primary/5">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Gewinn pro Stück</span>
            <span className={`font-medium ${profitPerUnit >= 0 ? 'text-green-500' : 'text-destructive'}`}>
              {formatCurrency(profitPerUnit)}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Marge</span>
            <span className={`font-medium ${margin >= 0 ? 'text-green-500' : 'text-destructive'}`}>
              {revenue > 0 ? `${margin.toFixed(1)}%` : '—'}
            </span>
          </div>
          <div className="flex justify-between pt-2 border-t border-border">
            <span className="font-semibold">Gewinn gesamt</span>
            <span className={`font-semibold text-lg ${profit >= 0 ? 'text-green-500' : 'text-destructive'}`}>
              {formatCurrency(profit)}
            </span>
          </div>
        </div>
      </div>

      {/* EK-Preisliste für alle Materialien ------------------------------------ */}
      <div className="rounded-lg border border-border">
        <button
          type="button"
          onClick={() => setShowPrices((s) => !s)}
          className="w-full flex items-center gap-2 px-4 py-3 text-sm font-medium hover:bg-white/5 transition-colors"
        >
          <Tag className="h-4 w-4 text-primary" />
          EK-Preise aller Materialien
          <span className="ml-auto text-xs text-muted-foreground">{showPrices ? 'ausblenden' : 'anzeigen'}</span>
        </button>
        {showPrices && (
          <div className="border-t border-border p-4">
            <p className="text-xs text-muted-foreground mb-3">
              Hinterlege den Einkaufspreis je Einheit. Die Werte werden gespeichert und für die
              Kostenberechnung oben verwendet.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {ALL_MATERIALS.map((mat) => (
                <div key={mat} className="flex items-center gap-2">
                  <Label className="flex-1 text-sm flex items-center gap-1.5 truncate">
                    {FUEL_OPTIONS[mat] && <Flame className="h-3.5 w-3.5 text-primary shrink-0" />}
                    {mat}
                  </Label>
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    value={prices[mat] || ''}
                    placeholder="0,00"
                    onChange={(e) => setPrice(mat, parseFloat(e.target.value) || 0)}
                    className="h-8 w-24 text-right"
                  />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </CardContent>
  );
}
