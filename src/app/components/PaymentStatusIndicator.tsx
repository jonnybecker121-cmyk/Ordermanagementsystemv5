import { Card, CardContent } from './ui/card';
import { useOrderStore } from '../store/orderStore';
import { CheckCircle, AlertCircle, Clock, DollarSign } from 'lucide-react';

export function PaymentStatusIndicator() {
  const { ordersOpen, ordersDone } = useOrderStore();

  const pending = ordersOpen.filter(o => o.status === 'Ausstehend').length;
  const processing = ordersOpen.filter(o => o.status === 'In Bearbeitung').length;
  const waiting = ordersOpen.filter(o => o.status === 'Warten auf Zahlung').length;
  const paid = ordersDone.filter(o => o.status === 'Gezahlt').length;
  const completed = ordersDone.filter(o => o.status === 'Abgeschlossen').length;

  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
      <Card className="bg-yellow-50 border-yellow-200">
        <CardContent className="p-3 flex flex-col items-center justify-center text-center">
          <AlertCircle className="h-5 w-5 text-yellow-600 mb-1" />
          <div className="text-xl font-bold text-yellow-800">{pending}</div>
          <div className="text-xs text-yellow-700">Ausstehend</div>
        </CardContent>
      </Card>

      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="p-3 flex flex-col items-center justify-center text-center">
          <Clock className="h-5 w-5 text-blue-600 mb-1" />
          <div className="text-xl font-bold text-blue-800">{processing}</div>
          <div className="text-xs text-blue-700">In Bearbeitung</div>
        </CardContent>
      </Card>

      <Card className="bg-orange-50 border-orange-200">
        <CardContent className="p-3 flex flex-col items-center justify-center text-center">
          <DollarSign className="h-5 w-5 text-orange-600 mb-1" />
          <div className="text-xl font-bold text-orange-800">{waiting}</div>
          <div className="text-xs text-orange-700">Warten auf Zahlung</div>
        </CardContent>
      </Card>

      <Card className="bg-green-50 border-green-200">
        <CardContent className="p-3 flex flex-col items-center justify-center text-center">
          <CheckCircle className="h-5 w-5 text-green-600 mb-1" />
          <div className="text-xl font-bold text-green-800">{paid}</div>
          <div className="text-xs text-green-700">Gezahlt</div>
        </CardContent>
      </Card>

      <Card className="bg-gray-50 border-gray-200">
        <CardContent className="p-3 flex flex-col items-center justify-center text-center">
          <CheckCircle className="h-5 w-5 text-gray-600 mb-1" />
          <div className="text-xl font-bold text-gray-800">{completed}</div>
          <div className="text-xs text-gray-700">Abgeschlossen</div>
        </CardContent>
      </Card>
    </div>
  );
}
