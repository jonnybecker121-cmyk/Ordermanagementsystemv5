import { Outlet, NavLink, useNavigate, useLocation } from "react-router";
import { 
  LayoutDashboard, 
  ShoppingCart, 
  Package, 
  FileText, 
  Calculator, 
  Archive,
  Banknote
} from "lucide-react";
import { useEffect, useState } from "react";
import { useOrderStore } from "./store/orderStore";
import { useInventoryStore } from "./store/inventoryStore";
import { useInvoiceStore } from "./store/invoiceStore";

export default function Root() {
  const navigate = useNavigate();
  const location = useLocation();
  const [syncTrigger, setSyncTrigger] = useState(0);
  const { autoArchiveCompleted, loadFromBackend: loadOrders } = useOrderStore();
  const { loadFromBackend: loadInventory } = useInventoryStore();
  const { loadFromBackend: loadInvoices } = useInvoiceStore();

  // Load data on mount
  useEffect(() => {
    loadOrders();
    loadInventory();
    loadInvoices();
  }, [loadOrders, loadInventory, loadInvoices]);

  // Auto-archive completed orders older than 1 hour
  useEffect(() => {
    autoArchiveCompleted(); // Check immediately
    const interval = setInterval(() => {
      autoArchiveCompleted();
    }, 60000); // Check every minute
    return () => clearInterval(interval);
  }, [autoArchiveCompleted]);

  // Trigger sync on location change
  useEffect(() => {
    setSyncTrigger(prev => prev + 1);
  }, [location.pathname]);

  const navItems = [
    { to: "/", icon: LayoutDashboard, label: "Dashboard", exact: true },
    { to: "/orders", icon: ShoppingCart, label: "Aufträge" },
    { to: "/inventory", icon: Package, label: "Lager" },
    { to: "/invoices", icon: FileText, label: "Rechnungen" },
    { to: "/bank", icon: Banknote, label: "Finanzen" },
    { to: "/calculator", icon: Calculator, label: "Kalkulator" },
    { to: "/archive", icon: Archive, label: "Archiv" },
  ];

  // Helper for Dashboard navigation
  const handleNavigate = (path: string) => {
    // Map quick action names to routes if necessary
    const routeMap: Record<string, string> = {
      'orders': '/orders',
      'invoices': '/invoices',
      'inventory': '/inventory',
      'bank': '/bank',
    };
    navigate(routeMap[path] || path);
  };

  return (
    <div className="flex h-screen bg-background text-foreground font-sans antialiased overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 bg-card border-r border-border flex flex-col hidden md:flex">
        <div className="p-6 border-b border-border">
          <h1 className="text-xl font-bold tracking-tight text-primary flex items-center gap-2">
            <span className="bg-primary text-primary-foreground p-1 rounded">SD</span>
            SCHMELZDEPOT
          </h1>
          <p className="text-xs text-muted-foreground mt-1">Business Management System</p>
        </div>
        
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {navItems.filter(item => item.to !== '/bank').map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.exact}
              className={({ isActive }) => `
                flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors
                ${isActive 
                  ? "bg-primary/10 text-primary" 
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"}
              `}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="p-4 border-t border-border">
          <div className="flex items-center gap-3 px-3 py-2">
            <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-xs">
              SV
            </div>
            <div>
              <p className="text-sm font-medium">StateV Factory</p>
              <p className="text-xs text-muted-foreground">Online</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        <header className="h-16 border-b border-border bg-card flex items-center justify-between px-6 md:hidden">
           <h1 className="font-bold text-primary">SCHMELZDEPOT</h1>
        </header>

        <div className="flex-1 overflow-auto p-6 bg-background/50">
          <div className="max-w-7xl mx-auto">
             <Outlet context={{ onNavigate: handleNavigate, syncTrigger }} />
          </div>
        </div>
      </main>
    </div>
  );
}
