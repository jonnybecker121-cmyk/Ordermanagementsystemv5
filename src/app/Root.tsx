import { Outlet, NavLink, useNavigate, useLocation } from "react-router";
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  FileText,
  Calculator,
  Archive,
  Wifi,
  WifiOff,
  RefreshCw,
  Loader2,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import { useEffect, useState, useCallback } from "react";
import { useOrderStore } from "./store/orderStore";
import { useInventoryStore } from "./store/inventoryStore";
import { useInvoiceStore } from "./store/invoiceStore";
import { useSyncStore, SyncStatus } from "./store/syncStore";
import { syncService } from "./services/syncService";

// --- Sync Status Indicator ---
function SyncIndicator() {
  const { status, lastSyncedAt, deviceId } = useSyncStore();
  const [manualSyncing, setManualSyncing] = useState(false);
  const [timeAgo, setTimeAgo] = useState<string>('');

  // Aktualisiere "vor X Sek." Anzeige
  useEffect(() => {
    const update = () => {
      if (!lastSyncedAt) return setTimeAgo('');
      const secs = Math.floor((Date.now() - lastSyncedAt) / 1000);
      if (secs < 5) setTimeAgo('gerade eben');
      else if (secs < 60) setTimeAgo(`vor ${secs}s`);
      else setTimeAgo(`vor ${Math.floor(secs / 60)}min`);
    };
    update();
    const interval = setInterval(update, 5000);
    return () => clearInterval(interval);
  }, [lastSyncedAt]);

  const handleManualSync = async () => {
    setManualSyncing(true);
    try {
      await syncService.manualSync();
    } finally {
      setManualSyncing(false);
    }
  };

  const statusConfig: Record<SyncStatus, { icon: React.ReactNode; label: string; color: string; dot: string }> = {
    idle: {
      icon: <Wifi className="h-3 w-3" />,
      label: 'Warte...',
      color: 'text-muted-foreground',
      dot: 'bg-muted-foreground',
    },
    syncing: {
      icon: <Loader2 className="h-3 w-3 animate-spin" />,
      label: 'Synchronisiere...',
      color: 'text-blue-500',
      dot: 'bg-blue-500 animate-pulse',
    },
    online: {
      icon: <CheckCircle2 className="h-3 w-3" />,
      label: timeAgo || 'Online',
      color: 'text-green-500',
      dot: 'bg-green-500',
    },
    offline: {
      icon: <WifiOff className="h-3 w-3" />,
      label: 'Offline',
      color: 'text-red-500',
      dot: 'bg-red-500',
    },
    error: {
      icon: <AlertTriangle className="h-3 w-3" />,
      label: 'Sync-Fehler',
      color: 'text-orange-500',
      dot: 'bg-orange-500 animate-pulse',
    },
  };

  const cfg = statusConfig[status];

  return (
    <div className="px-3 py-2 space-y-2">
      {/* Status Row */}
      <div className="flex items-center justify-between">
        <div className={`flex items-center gap-1.5 text-xs ${cfg.color}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
          {cfg.icon}
          <span>{cfg.label}</span>
        </div>
        <button
          onClick={handleManualSync}
          disabled={manualSyncing || status === 'syncing'}
          className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-40"
          title="Manuell synchronisieren"
        >
          <RefreshCw className={`h-3 w-3 ${manualSyncing ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Geräte-ID */}
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground/60">
        <span className="font-mono">{deviceId}</span>
      </div>
    </div>
  );
}

// --- Root Component ---
export default function Root() {
  const navigate = useNavigate();
  const location = useLocation();
  const [syncTrigger, setSyncTrigger] = useState(0);
  const { autoArchiveCompleted } = useOrderStore();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Sync-Service starten
  useEffect(() => {
    syncService.start();
    return () => syncService.stop();
  }, []);

  // Auto-archive completed orders older than 1 hour
  useEffect(() => {
    autoArchiveCompleted();
    const interval = setInterval(() => {
      autoArchiveCompleted();
    }, 60000);
    return () => clearInterval(interval);
  }, [autoArchiveCompleted]);

  // Trigger UI-refresh on location change
  useEffect(() => {
    setSyncTrigger((prev) => prev + 1);
    setMobileMenuOpen(false);
  }, [location.pathname]);

  const navItems = [
    { to: "/", icon: LayoutDashboard, label: "Dashboard", exact: true },
    { to: "/orders", icon: ShoppingCart, label: "Aufträge" },
    { to: "/inventory", icon: Package, label: "Lager" },
    { to: "/invoices", icon: FileText, label: "Rechnungen" },
    { to: "/calculator", icon: Calculator, label: "Kalkulator" },
    { to: "/archive", icon: Archive, label: "Archiv" },
  ];

  const handleNavigate = (path: string) => {
    const routeMap: Record<string, string> = {
      orders: "/orders",
      invoices: "/invoices",
      inventory: "/inventory",
    };
    navigate(routeMap[path] || path);
  };

  const SidebarContent = () => (
    <>
      {/* Logo */}
      <div className="p-6 border-b border-border">
        <h1 className="text-xl font-bold tracking-tight text-primary flex items-center gap-2">
          <span className="bg-primary text-primary-foreground p-1 rounded text-sm">SD</span>
          SCHMELZDEPOT
        </h1>
        <p className="text-xs text-muted-foreground mt-1">Business Management System</p>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.exact}
            className={({ isActive }) => `
              flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors
              ${isActive
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }
            `}
          >
            <item.icon className="h-4 w-4" />
            {item.label}
          </NavLink>
        ))}
      </nav>

      {/* Footer: User + Sync Status */}
      <div className="border-t border-border">
        <div className="flex items-center gap-3 px-3 py-3 mx-1">
          <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-xs shrink-0">
            SV
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium truncate">StateV Factory</p>
            <p className="text-xs text-muted-foreground truncate">Schmelzdepot</p>
          </div>
        </div>
        <div className="border-t border-border/50 mt-1">
          <SyncIndicator />
        </div>
      </div>
    </>
  );

  return (
    <div className="flex h-screen bg-background text-foreground font-sans antialiased overflow-hidden">
      {/* Desktop Sidebar */}
      <aside className="w-64 bg-card border-r border-border flex-col hidden md:flex">
        <SidebarContent />
      </aside>

      {/* Mobile Sidebar Overlay */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setMobileMenuOpen(false)}
          />
          <aside className="absolute left-0 top-0 h-full w-64 bg-card border-r border-border flex flex-col z-10">
            <SidebarContent />
          </aside>
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Mobile Header */}
        <header className="h-14 border-b border-border bg-card flex items-center justify-between px-4 md:hidden">
          <button
            onClick={() => setMobileMenuOpen(true)}
            className="p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted"
          >
            <div className="w-5 h-0.5 bg-current mb-1" />
            <div className="w-5 h-0.5 bg-current mb-1" />
            <div className="w-5 h-0.5 bg-current" />
          </button>
          <h1 className="font-bold text-primary text-sm">SCHMELZDEPOT</h1>
          {/* Mobile Sync Dot */}
          <MobileSyncDot />
        </header>

        <div
          className="flex-1 overflow-auto p-4 md:p-6 bg-background/50"
          style={{
            fontFamily: "'Inter', system-ui, sans-serif",
            WebkitFontSmoothing: 'antialiased',
            MozOsxFontSmoothing: 'grayscale',
            textRendering: 'optimizeLegibility',
            fontFeatureSettings: '"cv02", "cv03", "cv04", "cv11"',
          }}
        >
          <div className="max-w-7xl mx-auto">
            <Outlet context={{ onNavigate: handleNavigate, syncTrigger }} />
          </div>
        </div>
      </main>
    </div>
  );
}

function MobileSyncDot() {
  const { status } = useSyncStore();
  const dotColors: Record<SyncStatus, string> = {
    idle: 'bg-muted-foreground',
    syncing: 'bg-blue-500 animate-pulse',
    online: 'bg-green-500',
    offline: 'bg-red-500',
    error: 'bg-orange-500 animate-pulse',
  };
  return (
    <div className="p-2">
      <span className={`block h-2 w-2 rounded-full ${dotColors[status]}`} />
    </div>
  );
}