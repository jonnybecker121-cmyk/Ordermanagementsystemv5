import { Badge } from '../ui/badge';
import { Clock, CheckCircle, AlertCircle, DollarSign } from 'lucide-react';

interface StatusIndicatorProps {
  orderId: string;
  status: string;
  paidAt?: string;
  showTimer?: boolean;
}

export function StatusIndicator({ orderId, status, paidAt, showTimer }: StatusIndicatorProps) {
  let badgeVariant: 'default' | 'secondary' | 'outline' | 'destructive' = 'secondary';
  let badgeClass = '';
  let Icon = AlertCircle;

  switch (status) {
    case 'Ausstehend':
      badgeVariant = 'destructive';
      badgeClass = 'bg-yellow-100 text-yellow-800 border-yellow-200';
      Icon = AlertCircle;
      break;
    case 'In Bearbeitung':
      badgeVariant = 'outline';
      badgeClass = 'bg-blue-100 text-blue-800 border-blue-200';
      Icon = Clock;
      break;
    case 'Warten auf Zahlung':
      badgeVariant = 'secondary';
      badgeClass = 'bg-orange-100 text-orange-800 border-orange-200';
      Icon = DollarSign;
      break;
    case 'Gezahlt':
      badgeVariant = 'default';
      badgeClass = 'bg-green-100 text-green-800 border-green-200';
      Icon = CheckCircle;
      break;
    case 'Abgeschlossen':
      badgeVariant = 'secondary';
      badgeClass = 'bg-gray-100 text-gray-800 border-gray-200';
      Icon = CheckCircle;
      break;
  }

  return (
    <Badge variant={badgeVariant} className={`gap-1 ${badgeClass}`}>
      <Icon className="h-3 w-3" />
      {status}
      {showTimer && paidAt && status === 'Gezahlt' && (
        <span className="ml-1 text-[10px] opacity-70">
          Paid: {new Date(paidAt).toLocaleDateString()}
        </span>
      )}
    </Badge>
  );
}
