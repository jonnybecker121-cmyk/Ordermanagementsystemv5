import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Pin, PinOff, Search, RefreshCw, Factory } from 'lucide-react';
import { Input } from './ui/input';
import { Switch } from './ui/switch';
import { Button } from './ui/button';
import { ImageWithFallback } from './figma/ImageWithFallback';
import { statevApi, FACTORY_ID, type Production } from '../services/statevApi';

const ICON_BASE = 'https://static.statev.de/items/';

const FILTERS: { id: string; label: string; match: (name: string) => boolean }[] = [
  {
    id: 'gems',
    label: 'Edelsteine',
    match: (n) =>
      /diamant|rubin|smaragd|saphir|musgravit|bergkristall|edelstein/i.test(n),
  },
  {
    id: 'colors',
    label: 'Farben',
    match: (n) => /farbstoff|lack|haarfarbe|tattoofarbe/i.test(n),
  },
  {
    id: 'sirup',
    label: 'Sirup',
    match: (n) => /sirup/i.test(n),
  },
  {
    id: 'packaged',
    label: 'Verpacktes',
    match: (n) => /^verpackt|^karton|^dose|^flasche|^tube|^sack|^platte/i.test(n),
  },
];

const PIN_KEY = 'schmelzdepot-depot-pins';
const loadPins = (): string[] => {
  try {
    const raw = localStorage.getItem(PIN_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

const fmt = (n: number) =>
  new Intl.NumberFormat('de-DE').format(n);

const iconUrl = (icon?: string) => {
  if (!icon) return '';
  if (icon.startsWith('http')) return icon;
  return `${ICON_BASE}${icon}`;
};

export default function DepotView() {
  const [productions, setProductions] = useState<Production[]>([]);
  const [zlStock, setZlStock] = useState<Record<string, number>>({});
  const [machineStock, setMachineStock] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [activeFilters, setActiveFilters] = useState<Record<string, boolean>>({});
  const [pins, setPins] = useState<string[]>(() => loadPins());
  const [amounts, setAmounts] = useState<Record<string, number>>({});

  const persistPins = (next: string[]) => {
    setPins(next);
    localStorage.setItem(PIN_KEY, JSON.stringify(next));
  };

  const togglePin = (name: string) => {
    persistPins(pins.includes(name) ? pins.filter((n) => n !== name) : [...pins, name]);
  };

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [prods, inv, mach] = await Promise.all([
        statevApi.getFactoryProductions(FACTORY_ID),
        statevApi.getFactoryInventory(FACTORY_ID),
        statevApi.getFactoryMachines(FACTORY_ID).catch(() => ({ items: [] } as any)),
      ]);
      const prodsArr: Production[] = Array.isArray(prods)
        ? prods
        : Array.isArray((prods as any)?.productions)
        ? (prods as any).productions
        : Array.isArray((prods as any)?.items)
        ? (prods as any).items
        : [];
      const normalized = prodsArr
        .map((p: any) => ({
          item: p.item ?? p.name ?? p.title ?? '',
          icon: p.icon ?? p.image ?? '',
          neededItems: Array.isArray(p.neededItems)
            ? p.neededItems
            : Array.isArray(p.ingredients)
            ? p.ingredients
            : [],
        }))
        .filter((p: Production) => !!p.item);
      setProductions(normalized);
      const zl: Record<string, number> = {};
      inv.items.forEach((it) => (zl[it.item] = it.amount));
      setZlStock(zl);
      const m: Record<string, number> = {};
      (mach.items ?? []).forEach((it: any) => (m[it.item] = it.amount));
      setMachineStock(m);
    } catch (err: any) {
      setError(String(err?.message || err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    const activeIds = Object.entries(activeFilters)
      .filter(([, v]) => v)
      .map(([k]) => k);
    const term = search.trim().toLowerCase();

    return productions
      .filter((p) => {
        const name = p.item ?? '';
        if (!name) return false;
        if (activeIds.length > 0) {
          const matchesAny = activeIds.some((id) => {
            const f = FILTERS.find((f) => f.id === id);
            return f?.match(name);
          });
          if (!matchesAny) return false;
        }
        if (term) {
          const inName = name.toLowerCase().includes(term);
          const inIngredients = (p.neededItems ?? []).some((n) =>
            (n?.name ?? '').toLowerCase().includes(term)
          );
          if (!inName && !inIngredients) return false;
        }
        return true;
      })
      .sort((a, b) => {
        const an = a.item ?? '';
        const bn = b.item ?? '';
        const ap = pins.includes(an) ? 0 : 1;
        const bp = pins.includes(bn) ? 0 : 1;
        if (ap !== bp) return ap - bp;
        return an.localeCompare(bn, 'de');
      });
  }, [productions, search, activeFilters, pins]);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <a
          href="#"
          onClick={(e) => e.preventDefault()}
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mb-3"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Zurück zur Lager-Übersicht
        </a>

        <div
          className="rounded-2xl border p-6 mb-1"
          style={{
            background:
              'linear-gradient(120deg, color-mix(in srgb, var(--primary) 6%, transparent) 0%, var(--card) 70%)',
            borderColor: 'color-mix(in srgb, var(--primary) 30%, transparent)',
          }}
        >
          <div className="flex justify-between items-start gap-4 flex-wrap">
            <div>
              <div className="text-[11px] tracking-[0.2em] uppercase text-muted-foreground font-semibold mb-1">
                Firma
              </div>
              <h1 className="text-3xl font-bold m-0 flex items-center gap-2">
                <Factory className="h-7 w-7 text-primary" />
                Schmelzdepot
              </h1>
              <div className="flex gap-3.5 mt-2.5 text-xs text-muted-foreground flex-wrap">
                <span>
                  <strong className="text-foreground/80">Typ: </strong>
                  Fabrik
                </span>
                <span>Little Seoul West 121</span>
                <span className="font-mono opacity-60">{FACTORY_ID.slice(-8)}</span>
              </div>
            </div>
            <Button onClick={load} variant="outline" size="sm" disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Aktualisieren
            </Button>
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Filter Bar */}
      <div className="flex items-center gap-4 flex-wrap p-3 bg-muted/50 border rounded-lg">
        <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">
          Zutaten-Filter
        </span>
        {FILTERS.map((f) => (
          <label
            key={f.id}
            className="inline-flex items-center gap-2 cursor-pointer select-none"
          >
            <Switch
              checked={!!activeFilters[f.id]}
              onCheckedChange={(v) =>
                setActiveFilters((prev) => ({ ...prev, [f.id]: v }))
              }
            />
            <span
              className={`text-xs font-medium ${
                activeFilters[f.id] ? 'text-foreground' : 'text-muted-foreground'
              }`}
            >
              {f.label}
            </span>
          </label>
        ))}
      </div>

      {/* Search */}
      <div>
        <div className="relative">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <Input
            type="search"
            placeholder="Suchen – Produkt oder Zutat …"
            className="h-11 pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="text-xs text-muted-foreground mt-1.5">
          {fmt(filtered.length)} von {fmt(productions.length)} Rezepten
        </div>
      </div>

      {/* Recipe Grid */}
      {loading && productions.length === 0 ? (
        <div className="flex justify-center py-12">
          <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">
          Keine Rezepte gefunden.
        </div>
      ) : (
        <div className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(280px,1fr))]">
          {filtered.map((p) => {
            const pinned = pins.includes(p.item);
            const qty = amounts[p.item] ?? 1;
            return (
              <div
                key={p.item}
                className={`bg-muted/40 border rounded-xl overflow-hidden flex flex-col transition-colors ${
                  pinned ? 'border-primary/60' : 'hover:border-primary/40'
                }`}
              >
                <div className="flex items-center gap-2.5 px-3.5 py-3 bg-card border-b">
                  <div className="flex-1 text-sm font-bold min-w-0 break-words leading-tight">
                    {p.item}
                  </div>
                  <div className="w-11 h-11 rounded-md bg-muted flex items-center justify-center p-1 flex-shrink-0">
                    {p.icon && (
                      <ImageWithFallback
                        src={iconUrl(p.icon)}
                        alt=""
                        className="max-w-full max-h-full object-contain"
                      />
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => togglePin(p.item)}
                    className={`w-7 h-7 rounded-md border flex items-center justify-center flex-shrink-0 transition-colors ${
                      pinned
                        ? 'bg-primary/15 border-primary/50 text-primary'
                        : 'bg-transparent border-border text-muted-foreground hover:text-foreground hover:border-foreground/40'
                    }`}
                    title={pinned ? 'Lösen' : 'Anheften'}
                  >
                    {pinned ? (
                      <Pin className="h-3.5 w-3.5 fill-current" />
                    ) : (
                      <PinOff className="h-3.5 w-3.5" />
                    )}
                  </button>
                </div>

                <div className="px-3.5 py-2 border-b flex items-center gap-2.5 text-xs text-muted-foreground">
                  <label
                    htmlFor={`amt-${p.item}`}
                    className="flex-shrink-0 text-[10px] uppercase tracking-widest font-bold"
                  >
                    Menge ×
                  </label>
                  <Input
                    id={`amt-${p.item}`}
                    type="number"
                    min={1}
                    className="h-7 w-20 font-mono text-xs px-2"
                    value={qty}
                    onChange={(e) =>
                      setAmounts({
                        ...amounts,
                        [p.item]: Math.max(1, parseInt(e.target.value) || 1),
                      })
                    }
                  />
                </div>

                <div className="grid gap-0.5 p-2.5">
                  {(p.neededItems ?? []).map((ing) => {
                    const total = ing.amount * qty;
                    const zl = zlStock[ing.name] ?? 0;
                    const m = machineStock[ing.name] ?? 0;
                    const sufficient = zl + m >= total;
                    return (
                      <div
                        key={ing.name}
                        className="flex items-start gap-2.5 p-1.5 rounded-md min-h-[32px]"
                      >
                        <div className="w-6 h-6 rounded-md bg-muted flex items-center justify-center p-0.5 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="text-xs text-foreground/85 break-words leading-snug">
                            {ing.name}
                          </div>
                          <div className="text-[10px] text-muted-foreground mt-0.5 flex gap-2.5 flex-wrap font-mono">
                            <span>
                              ZL:{' '}
                              <span
                                className={
                                  zl > 0 ? 'text-foreground/80' : 'text-muted-foreground'
                                }
                              >
                                {fmt(zl)}
                              </span>
                            </span>
                            <span>
                              Maschine:{' '}
                              <span
                                className={
                                  m > 0 ? 'text-foreground/80' : 'text-muted-foreground'
                                }
                              >
                                {fmt(m)}
                              </span>
                            </span>
                          </div>
                        </div>
                        <div
                          className={`text-xs font-bold font-mono flex-shrink-0 ml-2 text-right min-w-[60px] ${
                            sufficient ? 'text-primary' : 'text-destructive'
                          }`}
                        >
                          × {fmt(total)}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
