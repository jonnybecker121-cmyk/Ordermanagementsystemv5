import { useState } from 'react';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Button } from '../ui/button';
import { Save, RotateCcw, Hash } from 'lucide-react';
import { useOrderStore } from '../store/orderStore';
import { toast } from 'sonner';

export function OrderNumberSettings() {
  const { orderPrefix, orderDigits, nextCounter, updateSettings } = useOrderStore();
  
  const [localPrefix, setLocalPrefix] = useState(orderPrefix);
  const [localDigits, setLocalDigits] = useState(orderDigits.toString());
  const [localCounter, setLocalCounter] = useState(nextCounter.toString());

  const handleSave = () => {
    const digits = parseInt(localDigits) || 4;
    const counter = parseInt(localCounter) || 1;

    if (digits < 1 || digits > 10) {
      toast.error('Anzahl Ziffern muss zwischen 1 und 10 liegen');
      return;
    }

    if (counter < 1) {
      toast.error('Nächste Nummer muss mindestens 1 sein');
      return;
    }

    updateSettings({
      prefix: localPrefix,
      digits: digits,
      counter: counter
    });

    toast.success('Bestellnummern-Einstellungen gespeichert!');
  };

  const handleReset = () => {
    setLocalPrefix('SD');
    setLocalDigits('4');
    setLocalCounter('1145');
    
    updateSettings({
      prefix: 'SD',
      digits: 4,
      counter: 1145
    });

    toast.success('Einstellungen zurückgesetzt');
  };

  return (
    <div className="space-y-6">
      {/* Settings Form */}
      <div className="grid gap-6 md:grid-cols-3">
        {/* Prefix */}
        <div className="space-y-2">
          <Label htmlFor="order-prefix" className="flex items-center gap-2">
            <Hash className="h-4 w-4 text-primary" />
            Präfix
          </Label>
          <Input
            id="order-prefix"
            value={localPrefix}
            onChange={(e) => setLocalPrefix(e.target.value.toUpperCase())}
            placeholder="SD"
            maxLength={6}
            className="font-mono font-bold"
          />
        </div>

        {/* Digits */}
        <div className="space-y-2">
          <Label htmlFor="order-digits" className="flex items-center gap-2">
            Anzahl Ziffern
          </Label>
          <Input
            id="order-digits"
            type="number"
            min="1"
            max="10"
            value={localDigits}
            onChange={(e) => setLocalDigits(e.target.value)}
            placeholder="4"
          />
        </div>

        {/* Next Counter */}
        <div className="space-y-2">
          <Label htmlFor="order-counter" className="flex items-center gap-2">
            Nächste Nummer
          </Label>
          <Input
            id="order-counter"
            type="number"
            min="1"
            value={localCounter}
            onChange={(e) => setLocalCounter(e.target.value)}
            placeholder="1145"
          />
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-2">
        <Button onClick={handleSave} className="gap-2 flex-1">
          <Save className="h-4 w-4" />
          Einstellungen speichern
        </Button>
        <Button onClick={handleReset} variant="outline" className="gap-2">
          <RotateCcw className="h-4 w-4" />
          Zurücksetzen
        </Button>
      </div>
    </div>
  );
}
