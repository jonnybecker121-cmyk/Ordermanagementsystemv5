import { Badge } from './ui/badge';
import { cn } from '../lib/utils';
import { Clock, CheckCircle, AlertCircle, DollarSign } from 'lucide-react';

interface StatusIndicatorProps {
  orderId: string;
  status: string;
  paidAt?: string;
  showTimer?: boolean;
}

export function StatusIndicator({ status, paidAt, showTimer }: StatusIndicatorProps) {
  let variant: 'default' | 'secondary' | 'destructive' | 'outline' = 'secondary';
  let className = '';
  let Icon = AlertCircle;

  if (status === 'Gezahlt') {
    variant = 'default';
    className = 'bg-green-100 text-green-800 border-green-200';
    Icon = CheckCircle;
  } else if (status === 'Ausstehend') {
    variant = 'secondary';
    className = 'bg-yellow-100 text-yellow-800 border-yellow-200';
    Icon = AlertCircle;
  } else if (status === 'In Bearbeitung') {
    variant = 'outline';
    className = 'bg-blue-100 text-blue-800 border-blue-200';
    Icon = Clock;
  } else if (status === 'Warten auf Zahlung') {
    variant = 'secondary';
    className = 'bg-orange-100 text-orange-800 border-orange-200';
    Icon = DollarSign;
  } else if (status === 'Abgeschlossen') {
    variant = 'secondary';
    className = 'bg-gray-100 text-gray-800 border-gray-200';
    Icon = CheckCircle;
  }

  return (
    <Badge variant={variant} className={cn("gap-1.5 px-3 py-1 text-xs", className)}>
      <Icon className="h-3 w-3" />
      {status}
      {showTimer && paidAt && status === 'Gezahlt' && (
        <span className="ml-1 text-[10px] opacity-70">
          {new Date(paidAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </span>
      )}
    </Badge>
  );
}
