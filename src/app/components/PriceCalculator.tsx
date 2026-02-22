import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Separator } from '../ui/separator';
import { 
  Calculator, 
  Boxes, 
  Trash2, 
  Plus, 
  ShoppingCart, 
  Cylinder,
  Save,
  Target,
  Cloud,
} from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { toast } from 'sonner';
import { useCalculatorStore, MaterialUsage } from '../store/calculatorStore';

interface PriceCalculatorProps {
  syncTrigger?: number;
}

export default function PriceCalculator({ syncTrigger = 0 }: PriceCalculatorProps = {}) {
  // Store Hooks
  const { 
    materials, 
    endProducts, 
    addMaterial, 
    deleteMaterial, 
    addEndProduct, 
    deleteEndProduct,
  } = useCalculatorStore();

  // Local State
  const [activeTab, setActiveTab] = useState('calculator');
  
  // -- CALCULATOR STATE --
  const [calcName, setCalcName] = useState('');
  const [calcIngredients, setCalcIngredients] = useState<MaterialUsage[]>([]);
  const [currentIngId, setCurrentIngId] = useState('');
  const [currentIngQty, setCurrentIngQty] = useState('1');
  const [margin, setMargin] = useState('20');
  
  // -- QUICK ADD MATERIALS STATE --
  const [quickRawName, setQuickRawName] = useState('');
  const [quickRawPrice, setQuickRawPrice] = useState('');

  // Helper: Format Currency - Updated to Dollar ($)
  const fmtMoney = (val: number) => new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'USD' }).format(val);

  // --- ACTIONS ---

  // Quick Add Raw Material
  const handleAddRaw = () => {
    if (!quickRawName || !quickRawPrice) return toast.error('Name und Preis erforderlich');
    addMaterial({
      name: quickRawName,
      ekPrice: parseFloat(quickRawPrice),
      unit: 'Stück',
      category: 'raw'
    });
    setQuickRawName('');
    setQuickRawPrice('');
    toast.success('Rohstoff hinzugefügt');
  };

  // Add Ingredient to Calculator
  const addIngredientToCalc = () => {
    if (!currentIngId) return;
    const qty = parseFloat(currentIngQty);
    if (qty <= 0) return;

    setCalcIngredients(prev => [...prev, { materialId: currentIngId, quantity: qty }]);
    setCurrentIngId('');
    setCurrentIngQty('1');
  };

  // Remove Ingredient
  const removeIngredient = (idx: number) => {
    setCalcIngredients(prev => prev.filter((_, i) => i !== idx));
  };

  // Calculate Totals
  const calculateTotals = () => {
    const cost = calcIngredients.reduce((sum, ing) => {
      const mat = materials.find(m => m.id === ing.materialId);
      return sum + ((mat?.ekPrice || 0) * ing.quantity);
    }, 0);
    
    const marginPercent = parseFloat(margin) || 0;
    const profit = cost * (marginPercent / 100);
    const final = cost + profit;

    return { cost, profit, final };
  };

  const totals = calculateTotals();

  // Save Calculator Result as End Product
  const saveCalculatorResult = () => {
    if (!calcName) return toast.error('Bitte Namen eingeben');
    if (calcIngredients.length === 0) return toast.error('Keine Materialien gewählt');

    addEndProduct({
      name: calcName,
      materials: calcIngredients,
      productionTime: 0,
      productionCost: 0,
      markup: parseFloat(margin) || 0,
      markupType: 'percent',
      vkPrice: totals.final,
      category: 'part'
    });

    toast.success(`Produkt "${calcName}" gespeichert!`);
    setCalcIngredients([]);
    setCalcName('');
  };

  // --- RENDER HELPERS ---
  const rawMaterials = materials.filter(m => m.category === 'raw' || !m.category); // Legacy support
  
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-primary/90 rounded-lg shadow-lg shadow-primary/20">
            <Calculator className="h-6 w-6 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">Kalkulator Suite</h1>
            <p className="text-muted-foreground text-sm">Produktkalkulation & Rohstoffe</p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-sm text-green-600 bg-green-50 px-3 py-1 rounded-full border border-green-200">
            <Cloud className="h-4 w-4" />
            <span>Ready</span>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={(v: any) => setActiveTab(v)}>
        <TabsList className="grid w-full max-w-2xl grid-cols-3">
          <TabsTrigger value="calculator" className="gap-2">
            <Calculator className="h-4 w-4" />
            Produktkalkulator
          </TabsTrigger>
          <TabsTrigger value="products" className="gap-2">
            <ShoppingCart className="h-4 w-4" />
            Gespeicherte Produkte
            <Badge variant="secondary" className="ml-2">{endProducts.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="target" className="gap-2">
            <Target className="h-4 w-4" />
            Zielpreis
          </TabsTrigger>
        </TabsList>

        {/* --- CALCULATOR TAB --- */}
        <TabsContent value="calculator" className="space-y-6 animate-in fade-in-50 duration-300">
          <div className="grid grid-cols-1 xl:grid-cols-[350px_1fr] gap-6">
            
            {/* LEFT COLUMN: RESOURCES */}
            <div className="space-y-6">
              {/* Raw Materials Quick Add */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-bold uppercase text-muted-foreground flex items-center gap-2">
                    <Cylinder className="h-4 w-4" /> Rohstoffe
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex gap-2">
                    <Input 
                      placeholder="Name (z.B. Eisen)" 
                      value={quickRawName} 
                      onChange={e => setQuickRawName(e.target.value)} 
                      className="h-9"
                    />
                    <Input 
                      type="number" 
                      placeholder="$" 
                      value={quickRawPrice} 
                      onChange={e => setQuickRawPrice(e.target.value)} 
                      className="w-20 h-9" 
                    />
                    <Button size="icon" className="h-9 w-9 shrink-0" onClick={handleAddRaw}>
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="space-y-2 max-h-[200px] overflow-y-auto pr-2">
                    {rawMaterials.length === 0 && <p className="text-xs text-muted-foreground text-center py-2">Keine Rohstoffe</p>}
                    {rawMaterials.map(m => (
                      <div key={m.id} className="flex items-center justify-between text-sm p-2 bg-muted/50 rounded-md group">
                        <span>{m.name}</span>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-medium">{fmtMoney(m.ekPrice)}</span>
                          <button onClick={() => deleteMaterial(m.id)} className="text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity">
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* RIGHT COLUMN: MAIN CALCULATOR */}
            <Card className="flex flex-col h-full border-2 border-primary/10">
              <CardHeader className="border-b bg-muted/10">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <CardTitle>Produktkalkulator</CardTitle>
                    <CardDescription>Berechne Preise für Produkte und Bauteile</CardDescription>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="flex-1 flex flex-col p-6 space-y-6">
                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase text-muted-foreground/80">Produktbezeichnung</Label>
                  <Input 
                    placeholder="z.B. Verstärkte Stahlplatte" 
                    value={calcName} 
                    onChange={e => setCalcName(e.target.value)}
                    className="font-medium text-lg h-12 bg-background border-border/50 focus:border-[#ff8000]"
                  />
                </div>

                {/* Ingredients Selection */}
                <div className="space-y-4 pt-4">
                  <Label className="text-xs font-bold uppercase text-muted-foreground/80">Zutat hinzufügen</Label>
                  <div className="flex items-end gap-3">
                    <div className="flex-1 space-y-2">
                      <Select value={currentIngId} onValueChange={setCurrentIngId}>
                        <SelectTrigger className="h-11 bg-background border-border/50">
                          <SelectValue placeholder="Material wählen..." />
                        </SelectTrigger>
                        <SelectContent>
                          {rawMaterials.length > 0 && (
                            <>
                              <SelectItem value="header_1" disabled className="font-bold opacity-100 text-[#ff8000] text-[10px] uppercase py-2">-- Rohstoffe --</SelectItem>
                              {rawMaterials.map(m => (
                                <SelectItem key={m.id} value={m.id}>{m.name} ({fmtMoney(m.ekPrice)})</SelectItem>
                              ))}
                            </>
                          )}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="w-24 space-y-2">
                      <Label className="text-[10px] uppercase font-bold text-muted-foreground/60 text-center block w-full">Menge</Label>
                      <Input 
                        type="number" 
                        value={currentIngQty} 
                        onChange={e => setCurrentIngQty(e.target.value)} 
                        min="0.1"
                        className="h-11 text-center bg-background border-border/50"
                      />
                    </div>
                    <Button 
                      onClick={addIngredientToCalc} 
                      className="h-11 px-8 bg-[#ff8000] hover:bg-[#e67300] text-white font-bold uppercase tracking-wider shadow-lg shadow-[#ff8000]/20 transition-all hover:scale-[1.02]"
                    >
                      Hinzufügen
                    </Button>
                  </div>

                  {/* Table */}
                  <div className="border border-border/40 rounded-xl overflow-hidden min-h-[150px] shadow-sm bg-card/30">
                    <Table>
                      <TableHeader className="bg-muted/50">
                        <TableRow className="hover:bg-transparent border-b border-border/40">
                          <TableHead className="text-[10px] uppercase font-bold tracking-widest py-4">Inhalt</TableHead>
                          <TableHead className="text-right text-[10px] uppercase font-bold tracking-widest py-4">Menge</TableHead>
                          <TableHead className="text-right text-[10px] uppercase font-bold tracking-widest py-4">Kosten</TableHead>
                          <TableHead className="w-[50px]"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {calcIngredients.map((ing, idx) => {
                          const mat = materials.find(m => m.id === ing.materialId);
                          return (
                            <TableRow key={idx}>
                              <TableCell className="font-medium">{mat?.name || 'Unbekannt'}</TableCell>
                              <TableCell className="text-right">{ing.quantity}</TableCell>
                              <TableCell className="text-right">{fmtMoney((mat?.ekPrice || 0) * ing.quantity)}</TableCell>
                              <TableCell>
                                <Button size="sm" variant="ghost" onClick={() => removeIngredient(idx)} className="h-8 w-8 text-destructive">
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                        {calcIngredients.length === 0 && (
                          <TableRow>
                            <TableCell colSpan={4} className="text-center text-muted-foreground h-32">
                              Keine Materialien hinzugefügt
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </div>

                {/* Footer Totals */}
                <div className="mt-auto pt-6 space-y-4 border-t">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-muted-foreground">Materialkosten (EK)</span>
                    <span className="font-medium">{fmtMoney(totals.cost)}</span>
                  </div>
                  
                  <div className="flex items-center justify-between">
                     <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">Gewünschte Marge (%)</span>
                        <Input 
                          type="number" 
                          value={margin} 
                          onChange={e => setMargin(e.target.value)} 
                          className="w-20 h-8 text-center"
                        />
                     </div>
                     <div className="text-right">
                        <span className="text-xs text-green-600 font-medium block">Gewinn</span>
                        <span className="font-bold text-green-600">{fmtMoney(totals.profit)}</span>
                     </div>
                  </div>

                  <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 flex justify-between items-center">
                    <span className="font-bold text-foreground">Verkaufspreis</span>
                    <span className="text-2xl font-bold text-primary">{fmtMoney(totals.final)}</span>
                  </div>

                  <Button size="lg" className="w-full" onClick={saveCalculatorResult}>
                    <Save className="h-4 w-4 mr-2" />
                    Als Produkt speichern
                  </Button>
                </div>

              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* --- PRODUCTS TAB --- */}
        <TabsContent value="products">
          <Card>
            <CardHeader>
              <CardTitle>Gespeicherte Produkte</CardTitle>
              <CardDescription>Alle kalkulierten Produkte</CardDescription>
            </CardHeader>
            <CardContent>
              {endProducts.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">Keine Produkte gespeichert</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Typ</TableHead>
                      <TableHead className="text-right">EK</TableHead>
                      <TableHead className="text-right">VK</TableHead>
                      <TableHead className="text-right">Marge</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {endProducts.map(p => {
                       // Recalculate cost for display
                       const cost = p.materials.reduce((acc, use) => {
                          const m = materials.find(mat => mat.id === use.materialId);
                          return acc + ((m?.ekPrice || 0) * use.quantity);
                       }, 0);
                       const profit = (p.vkPrice || 0) - cost;
                       
                       return (
                        <TableRow key={p.id}>
                          <TableCell className="font-medium">{p.name}</TableCell>
                          <TableCell>
                            <Badge variant={p.category === 'vehicle' ? 'default' : 'secondary'} className={p.category === 'vehicle' ? 'bg-orange-500 hover:bg-orange-600' : ''}>
                              {p.category === 'vehicle' ? 'Fahrzeug (Legacy)' : 'Produkt'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right font-mono text-muted-foreground">{fmtMoney(cost)}</TableCell>
                          <TableCell className="text-right font-bold font-mono">{fmtMoney(p.vkPrice || 0)}</TableCell>
                          <TableCell className="text-right text-green-600 font-medium">+{fmtMoney(profit)}</TableCell>
                          <TableCell className="text-right">
                            <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => deleteEndProduct(p.id)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                       );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* --- TARGET PRICE TAB --- */}
        <TabsContent value="target">
           <Card>
             <CardHeader>
               <CardTitle>Zielpreis Rechner</CardTitle>
               <CardDescription>Rückwärtskalkulation (Coming Soon)</CardDescription>
             </CardHeader>
             <CardContent>
               <p className="text-muted-foreground">Diese Funktion wird derzeit überarbeitet.</p>
             </CardContent>
           </Card>
        </TabsContent>

      </Tabs>
    </div>
  );
}
