import { useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { CustomerManager } from './CustomerManager';
import { ItemManager } from './ItemManager';
import { OrderCreator } from './OrderCreator';
import { OrderList } from './OrderList';
import { OrderNumberSettings } from './OrderNumberSettings';
import { useOrderStore } from '../store/orderStore';

export default function OrderManager() {
  const { isLoading } = useOrderStore();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }
  
  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
           <CardTitle>Order Manager</CardTitle>
        </CardHeader>
      </Card>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 p-6 bg-card border border-primary/20 rounded-lg shadow-lg shadow-primary/5">
        {/* Left Column - Management */}
        <div className="lg:col-span-1 space-y-6">
          <CustomerManager />
          <ItemManager />
          <Card>
             <CardHeader>
               <CardTitle>Settings</CardTitle>
             </CardHeader>
             <CardContent>
               <OrderNumberSettings />
             </CardContent>
          </Card>
        </div>

        {/* Right Column - Order List & Creator */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-card border border-primary/20 rounded-lg shadow-lg shadow-primary/5">
            <OrderList />
          </div>
          <div className="bg-card border border-primary/20 rounded-lg shadow-lg shadow-primary/5">
            <OrderCreator />
          </div>
        </div>
      </div>
    </div>
  );
}
