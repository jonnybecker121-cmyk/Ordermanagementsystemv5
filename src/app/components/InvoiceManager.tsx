import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Separator } from '../ui/separator';
import { Plus, FileText, Trash2, Save, Edit3 } from 'lucide-react';
import { useOrderStore } from '../store/orderStore';
import { useInvoiceStore, PaymentNote } from '../store/invoiceStore';
import Invoice from './Invoice';

export default function InvoiceManager() {
  const { ordersOpen, ordersDone } = useOrderStore();
  const { paymentNotes, addPaymentNote, updatePaymentNote, deletePaymentNote, setDefaultPaymentNote, getDefaultPaymentNote } = useInvoiceStore();
  const orders = [...(ordersOpen || []), ...(ordersDone || [])];
  const [invoiceData, setInvoiceData] = useState<any>(null);
  const [formData, setFormData] = useState({
    customerName: '',
    customerEmail: '',
    customerPhone: '',
    orderNumber: '',
    deliveryDate: '',
    reference: '',
    paymentNote: '',
    vban: 'IBAN-DE89-3704-0044-0000-0000-00',
    items: [] as any[],
    taxPercent: 19,
    taxMode: 'plus'
  });

  const [showPaymentNoteManager, setShowPaymentNoteManager] = useState(false);
  const [newPaymentNote, setNewPaymentNote] = useState({ title: '', content: '' });
  const [editingPaymentNote, setEditingPaymentNote] = useState<PaymentNote | null>(null);

  // Initialize with default payment note
  useEffect(() => {
    const defaultNote = getDefaultPaymentNote();
    if (defaultNote && !formData.paymentNote) {
      setFormData(prev => ({ ...prev, paymentNote: defaultNote.content }));
    }
  }, [getDefaultPaymentNote, formData.paymentNote]);

  const handleLoadFromOrder = (orderId: string) => {
    const order = orders.find(o => o.id === orderId);
    if (order) {
      const defaultNote = getDefaultPaymentNote();
      setFormData({
        ...formData,
        customerName: order.customerName || '',
        customerEmail: order.customerEmail || '',
        customerPhone: order.customerPhone || '',
        orderNumber: order.number || '',
        deliveryDate: '', // Order doesn't have deliveryDate in store
        reference: order.number || '',
        items: order.items || [],
        // Preserve existing values for other fields unless empty
        paymentNote: formData.paymentNote || defaultNote?.content || '',
        vban: formData.vban || 'IBAN-DE89-3704-0044-0000-0000-00',
        taxPercent: order.taxRate || formData.taxPercent || 19,
        taxMode: order.taxSign || formData.taxMode || 'plus'
      });
      
      // Show success message
      if (typeof window !== 'undefined') {
        import('sonner').then(({ toast }) => {
          toast.success('Auftragsdaten geladen!', {
            description: `Daten von Auftrag ${order.number} - ${order.customerName} wurden übernommen.`,
          });
        }).catch(() => {
          console.log('Toast notification not available');
        });
      }
    }
  };

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const addItem = () => {
    setFormData(prev => ({
      ...prev,
      items: [...prev.items, { name: '', qty: 1, price: 0, disc: 0 }]
    }));
  };

  const updateItem = (index: number, field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      items: prev.items.map((item, i) => 
        i === index ? { ...item, [field]: value } : item
      )
    }));
  };

  const removeItem = (index: number) => {
    setFormData(prev => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index)
    }));
  };

  const generateInvoice = () => {
    setInvoiceData(formData);
  };

  const resetForm = () => {
    const defaultNote = getDefaultPaymentNote();
    setFormData({
      customerName: '',
      customerEmail: '',
      customerPhone: '',
      orderNumber: '',
      deliveryDate: '',
      reference: '',
      paymentNote: defaultNote?.content || '',
      vban: 'IBAN-DE89-3704-0044-0000-0000-00',
      items: [],
      taxPercent: 19,
      taxMode: 'plus'
    });
    setInvoiceData(null);
  };

  const handleSavePaymentNote = () => {
    if (newPaymentNote.title && newPaymentNote.content) {
      addPaymentNote(newPaymentNote.title, newPaymentNote.content);
      setNewPaymentNote({ title: '', content: '' });
    }
  };

  const handleUpdatePaymentNote = () => {
    if (editingPaymentNote && newPaymentNote.title && newPaymentNote.content) {
      updatePaymentNote(editingPaymentNote.id, newPaymentNote.title, newPaymentNote.content);
      setEditingPaymentNote(null);
      setNewPaymentNote({ title: '', content: '' });
    }
  };

  const handleEditPaymentNote = (note: PaymentNote) => {
    setEditingPaymentNote(note);
    setNewPaymentNote({ title: note.title, content: note.content });
  };

  const handleSelectPaymentNote = (noteId: string) => {
    const selectedNote = paymentNotes.find(note => note.id === noteId);
    if (selectedNote) {
      setFormData(prev => ({ ...prev, paymentNote: selectedNote.content }));
    }
  };

  if (invoiceData) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Button variant="outline" onClick={() => setInvoiceData(null)}>
            ← Zurück zum Formular
          </Button>
          <Button onClick={resetForm} variant="destructive">
            Formular zurücksetzen
          </Button>
        </div>
        <Invoice data={invoiceData} />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <Card className="bg-card border border-primary/20 shadow-lg shadow-primary/5">
        <CardHeader className="border-b border-primary/20 bg-card">
          <CardTitle className="flex items-center gap-2">
            <div className="p-1.5 bg-primary/90 rounded-md shadow-md shadow-primary/10">
              <FileText className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="text-black dark:text-white">Rechnungen</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Auftrag laden */}
          <div className="space-y-2">
            <Label>Auftrag laden ({ordersOpen.length} offen)</Label>
            <Select onValueChange={handleLoadFromOrder} disabled={orders.length === 0}>
              <SelectTrigger>
                <SelectValue placeholder={
                  orders.length === 0 
                    ? "Kein Auftrag verfügbar" 
                    : `Wähle einen Auftrag... (${orders.length} verfügbar)`
                } />
              </SelectTrigger>
              <SelectContent>
                {orders.map(order => (
                  <SelectItem key={order.id} value={order.id}>
                    {order.number} - {order.customerName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Separator />

          {/* Kundendaten */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="customerName">Kundenname *</Label>
              <Input
                id="customerName"
                value={formData.customerName}
                onChange={(e) => handleInputChange('customerName', e.target.value)}
                placeholder="Max Mustermann"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="customerEmail">E-Mail</Label>
              <Input
                id="customerEmail"
                type="email"
                value={formData.customerEmail}
                onChange={(e) => handleInputChange('customerEmail', e.target.value)}
                placeholder="max@example.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="customerPhone">Telefon</Label>
              <Input
                id="customerPhone"
                value={formData.customerPhone}
                onChange={(e) => handleInputChange('customerPhone', e.target.value)}
                placeholder="+49 123 456789"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="orderNumber">Bestellnummer *</Label>
              <Input
                id="orderNumber"
                value={formData.orderNumber}
                onChange={(e) => handleInputChange('orderNumber', e.target.value)}
                placeholder="ORD-2024-001"
              />
            </div>
          </div>

          {/* Weitere Details */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="deliveryDate">Lieferdatum</Label>
              <Input
                id="deliveryDate"
                type="date"
                value={formData.deliveryDate}
                onChange={(e) => handleInputChange('deliveryDate', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="reference">Verwendungszweck</Label>
              <Input
                id="reference"
                value={formData.reference}
                onChange={(e) => handleInputChange('reference', e.target.value)}
                placeholder="Bestellnummer eingeben..."
              />
            </div>
          </div>

          {/* Steuer-Einstellungen */}
          {/* Steuer wird automatisch mit 5% berechnet */}

          {/* Artikel */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label>Artikel</Label>
              <Button onClick={addItem} size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Artikel hinzufügen
              </Button>
            </div>
            
            {formData.items.map((item, index) => (
              <div key={index} className="grid grid-cols-12 gap-2 items-end">
                <div className="col-span-5">
                  <Input
                    value={item.name}
                    onChange={(e) => updateItem(index, 'name', e.target.value)}
                    placeholder="Artikelname"
                  />
                </div>
                <div className="col-span-2">
                  <Input
                    type="number"
                    value={item.qty}
                    onChange={(e) => updateItem(index, 'qty', parseInt(e.target.value) || 1)}
                    placeholder="Anzahl"
                  />
                </div>
                <div className="col-span-2">
                  <Input
                    type="number"
                    step="0.01"
                    value={item.price}
                    onChange={(e) => updateItem(index, 'price', parseFloat(e.target.value) || 0)}
                    placeholder="Preis"
                  />
                </div>
                <div className="col-span-2">
                  <Input
                    type="number"
                    value={item.disc}
                    onChange={(e) => updateItem(index, 'disc', parseFloat(e.target.value) || 0)}
                    placeholder="Rabatt %"
                  />
                </div>
                <div className="col-span-1">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => removeItem(index)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>

          {/* Zahlungsdetails */}
          <div className="space-y-4">

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="paymentNote">Zahlungshinweis</Label>
                <div className="flex gap-2">
                  <Select onValueChange={handleSelectPaymentNote}>
                    <SelectTrigger className="w-[200px]">
                      <SelectValue placeholder="Vorlage wählen..." />
                    </SelectTrigger>
                    <SelectContent>
                      {paymentNotes.map(note => (
                        <SelectItem key={note.id} value={note.id}>
                          {note.title} {note.isDefault && '(Standard)'}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setShowPaymentNoteManager(!showPaymentNoteManager)}
                  >
                    <Edit3 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <Textarea
                id="paymentNote"
                value={formData.paymentNote}
                onChange={(e) => handleInputChange('paymentNote', e.target.value)}
                placeholder="Bitte überweisen Sie den Betrag bis zum Fälligkeitsdatum."
                rows={3}
              />
              
              {/* Payment Note Manager */}
              {showPaymentNoteManager && (
                <Card className="mt-4">
                  <CardHeader>
                    <CardTitle className="text-sm">Zahlungshinweise verwalten</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Add/Edit Form */}
                    <div className="space-y-2">
                      <Input
                        placeholder="Titel für Zahlungshinweis..."
                        value={newPaymentNote.title}
                        onChange={(e) => setNewPaymentNote(prev => ({ ...prev, title: e.target.value }))}
                      />
                      <Textarea
                        placeholder="Zahlungshinweis Text..."
                        value={newPaymentNote.content}
                        onChange={(e) => setNewPaymentNote(prev => ({ ...prev, content: e.target.value }))}
                        rows={2}
                      />
                      <div className="flex gap-2">
                        {editingPaymentNote ? (
                          <>
                            <Button size="sm" onClick={handleUpdatePaymentNote}>
                              <Save className="h-4 w-4 mr-1" />
                              Aktualisieren
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setEditingPaymentNote(null);
                                setNewPaymentNote({ title: '', content: '' });
                              }}
                            >
                              Abbrechen
                            </Button>
                          </>
                        ) : (
                          <Button size="sm" onClick={handleSavePaymentNote}>
                            <Plus className="h-4 w-4 mr-1" />
                            Hinzufügen
                          </Button>
                        )}
                      </div>
                    </div>
                    
                    <Separator />
                    
                    {/* Existing Notes */}
                    <div className="space-y-2 max-h-40 overflow-y-auto">
                      {paymentNotes.map(note => (
                        <div key={note.id} className="flex items-center justify-between p-2 border rounded">
                          <div className="flex-1">
                            <div className="font-medium text-sm">{note.title}</div>
                            <div className="text-xs text-muted-foreground truncate">
                              {note.content.substring(0, 50)}...
                            </div>
                          </div>
                          <div className="flex gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleEditPaymentNote(note)}
                            >
                              <Edit3 className="h-3 w-3" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setDefaultPaymentNote(note.id)}
                              className={note.isDefault ? 'text-orange-600' : ''}
                            >
                              ⭐
                            </Button>
                            {!note.isDefault && (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => deletePaymentNote(note.id)}
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>

          {/* Aktionen */}
          <div className="flex gap-4">
            <Button onClick={generateInvoice} className="flex-1">
              Rechnung generieren
            </Button>
            <Button onClick={resetForm} variant="outline">
              Zurücksetzen
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
