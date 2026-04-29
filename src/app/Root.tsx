import { Outlet, NavLink, useNavigate, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  FileText,
  Calculator,
  Archive,
  HardDrive,
  Gavel,
  ArrowLeftRight,
  MessageSquare,
  Image as ImageIcon,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useOrderStore } from "./store/orderStore";
import { useSyncStore } from "./store/syncStore";

// ── Lokal-Status Anzeige ──────────────────────────────────────────────────────

function LocalIndicator() {
  const { deviceId } = useSyncStore();
  return (
    <div className="px-3 py-2 space-y-1.5">
      <div className="flex items-center gap-1.5 text-xs text-green-500">
        <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
        <HardDrive className="h-3 w-3" />
        <span>Lokal gespeichert</span>
      </div>
      <div className="text-xs text-muted-foreground/50 font-mono">{deviceId}</div>
    </div>
  );
}

// ── Root ──────────────────────────────────────────────────────────────────────

export default function Root() {
  const navigate = useNavigate();
  const location = useLocation();
  const [syncTrigger, setSyncTrigger] = useState(0);
  const { autoArchiveCompleted } = useOrderStore();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showAlternateApp, setShowAlternateApp] = useState(false);

  // Auto-archive completed orders older than 1 hour
  useEffect(() => {
    autoArchiveCompleted();
    const interval = setInterval(() => {
      autoArchiveCompleted();
    }, 60_000);
    return () => clearInterval(interval);
  }, [autoArchiveCompleted]);

  // Trigger UI-refresh on location change
  useEffect(() => {
    setSyncTrigger((prev) => prev + 1);
    setMobileMenuOpen(false);
  }, [location.pathname]);

  const navItems = [
    { to: "/",          icon: LayoutDashboard, label: "Dashboard", exact: true },
    { to: "/orders",    icon: ShoppingCart,    label: "Aufträge" },
    { to: "/inventory", icon: Package,         label: "Lager" },
    { to: "/invoices",  icon: FileText,        label: "Rechnungen" },
    { to: "/calculator",icon: Calculator,      label: "Kalkulator" },
    { to: "/auctions",  icon: Gavel,           label: "Auktionen" },
    { to: "/messenger", icon: MessageSquare,   label: "V-NET" },
    { to: "/pic",       icon: ImageIcon,       label: "PIC" },
    { to: "/archive",   icon: Archive,         label: "Archiv" },
  ];

  const handleNavigate = (path: string) => {
    const routeMap: Record<string, string> = {
      orders:    "/orders",
      invoices:  "/invoices",
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

      {/* Footer */}
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
        <div className="border-t border-border/50">
          <button
            onClick={() => setShowAlternateApp(!showAlternateApp)}
            className="w-full flex items-center gap-2 px-3 py-2.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <ArrowLeftRight className="h-3.5 w-3.5" />
            <span>{showAlternateApp ? 'Zurück zu Schmelzdepot' : 'Zur anderen App wechseln'}</span>
          </button>
        </div>
        <div className="border-t border-border/50">
          <LocalIndicator />
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
          {/* Lokal-Dot */}
          <div className="p-2">
            <span className="block h-2 w-2 rounded-full bg-green-500" />
          </div>
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
          {showAlternateApp ? (
            <iframe
              src="https://www.figma.com/make/J2pq9qomyhxiHCdOBgcYH5/Order-Management-System--Kopie-?p=f&t=pVYIYuGh0XjJDosF-0&fullscreen=1"
              className="w-full h-full border-0"
              title="Alternative App"
            />
          ) : (
            <div className="max-w-7xl mx-auto">
              <Outlet context={{ onNavigate: handleNavigate, syncTrigger }} />
            </div>
          )}
        </div>
      </main>
    </div>
  );
}