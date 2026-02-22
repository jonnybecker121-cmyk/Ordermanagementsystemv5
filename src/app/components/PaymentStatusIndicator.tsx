import { useOrderStore } from '../store/orderStore';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';

export function PaymentStatusIndicator() {
  const { ordersOpen, ordersDone } = useOrderStore();
  
  const allOrders = [...ordersOpen, ...ordersDone];
  const paidCount = allOrders.filter(o => o.status === 'Gezahlt' || o.status === 'Abgeschlossen').length;
  const pendingCount = allOrders.filter(o => o.status === 'Ausstehend').length;
  const processingCount = allOrders.filter(o => o.status === 'In Bearbeitung').length;
  const waitingCount = allOrders.filter(o => o.status === 'Warten auf Zahlung').length;

  const data = [
    { name: 'Pending', value: pendingCount, color: '#eab308' },
    { name: 'Processing', value: processingCount, color: '#3b82f6' },
    { name: 'Waiting', value: waitingCount, color: '#f97316' },
    { name: 'Paid/Completed', value: paidCount, color: '#22c55e' },
  ].filter(d => d.value > 0);

  return (
    <div className="h-[250px] w-full">
      {data.length > 0 ? (
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={80}
              paddingAngle={5}
              dataKey="value"
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      ) : (
        <div className="flex items-center justify-center h-full text-muted-foreground">
          No orders data available
        </div>
      )}
    </div>
  );
}
