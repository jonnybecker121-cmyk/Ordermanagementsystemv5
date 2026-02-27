import { createBrowserRouter, useOutletContext, Navigate } from "react-router";
import Root from "./Root";
import Dashboard from "./components/Dashboard";
import OrderManager from "./components/OrderManager";
import InventoryManager from "./components/InventoryManager";
import InvoiceManager from "./components/InvoiceManager";
import PriceCalculator from "./components/PriceCalculator";
import ArchiveManager from "./components/ArchiveManager";

// Wrappers to pass context from Outlet to component
function DashboardWrapper() {
  const context = useOutletContext<{ onNavigate: (path: string) => void, syncTrigger: number }>();
  return <Dashboard onNavigate={context.onNavigate} syncTrigger={context.syncTrigger} />;
}

function InventoryManagerWrapper() {
  const context = useOutletContext<{ syncTrigger: number }>();
  return <InventoryManager syncTrigger={context.syncTrigger} />;
}

function PriceCalculatorWrapper() {
  const context = useOutletContext<{ syncTrigger: number }>();
  return <PriceCalculator syncTrigger={context.syncTrigger} />;
}

function ArchiveManagerWrapper() {
  const context = useOutletContext<{ syncTrigger: number }>();
  return <ArchiveManager syncTrigger={context.syncTrigger} />;
}

// Catch-all redirect component
function NotFoundRedirect() {
  return <Navigate to="/" replace />;
}

export const router = createBrowserRouter([
  {
    path: "/",
    Component: Root,
    children: [
      { index: true, Component: DashboardWrapper },
      { path: "orders", Component: OrderManager },
      { path: "inventory", Component: InventoryManagerWrapper },
      { path: "invoices", Component: InvoiceManager },
      { path: "calculator", Component: PriceCalculatorWrapper },
      { path: "archive", Component: ArchiveManagerWrapper },
    ],
  },
  {
    path: "*",
    Component: NotFoundRedirect,
  }
]);