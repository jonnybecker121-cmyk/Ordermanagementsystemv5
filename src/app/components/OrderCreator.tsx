import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { Badge } from '../ui/badge';
import { Separator } from '../ui/separator';
import { ShoppingCart, Trash2, Plus, Package } from 'lucide-react';
import { useOrderStore, type OrderItem } from '../store/orderStore';
import { useCalculatorStore, type EndProduct } from '../store/calculatorStore';

export function OrderCreator() {
  const { customers, items, createOrder } = useOrderStore();
  const { endProducts } = useCalculatorStore();
  
  const [selectedCustomer, setSelectedCustomer] = useState('none');
  const [selectedItem, setSelectedItem] = useState('none');
  const [quantity, setQuantity] = useState('1');
  const [discount, setDiscount] = useState('0');
  const [basket, setBasket] = useState<OrderItem[]>([]);
  const [taxRate, setTaxRate] = useState('0');
  const [taxSign, setTaxSign] = useState<'minus' | 'plus'>('minus');
  
  // Calculate end product price (same logic as PriceCalculator)
  // Note: materialCost depends on materials from calculator store, so we need that too
  const { materials: calcMaterials } = useCalculatorStore();

  const calculateEndProductPrice = (product: EndProduct): number => {
    // Calculate material costs
    const materialCost = product.materials.reduce((total, usage) => {
      const material = calcMaterials.find(m => m.id === usage.materialId);
      if (!material) return total;
      return total + (material.ekPrice * usage.quantity);
    }, 0);

    // Calculate production costs
    const productionHours = product.productionTime / 60;
    const productionCostTotal = productionHours * product.productionCost;

    // Total cost
    const totalCost = materialCost + productionCostTotal;

    // Calculate VK price based on markup type (NO TAX!)
    let vkPrice: number;
    if (product.vkPrice !== undefined && product.vkPrice > 0) {
      vkPrice = product.vkPrice;
    } else if (product.markupType === 'percent') {
      vkPrice = totalCost * (1 + product.markup / 100);
    } else {
      vkPrice = totalCost + product.markup;
    }

    return vkPrice;
  };

  const addToBasket = () => {
    if (!selectedItem || selectedItem === 'none' || selectedItem.startsWith('section-')) return;
    
    // Check if it's an endproduct
    if (selectedItem.startsWith('endproduct-')) {
      const productId = selectedItem.replace('endproduct-', '');
      const product = endProducts.find(p => p.id === productId);
      if (!product) return;
      
      const price = calculateEndProductPrice(product);
      const qty = Math.max(1, parseInt(quantity) || 1);
      const disc = Math.min(100, Math.max(0, parseInt(discount) || 0));
      
      const basketItem: OrderItem = {
        name: product.name,
        price: price,
        qty,
        disc
      };
      
      setBasket(prev => [...prev, basketItem]);
    } else {
      // Regular item
      const item = items.find(i => i.id === selectedItem);
      if (!item) return;
      
      const qty = Math.max(1, parseInt(quantity) || 1);
      const disc = Math.min(100, Math.max(0, parseInt(discount) || 0));
      
      const basketItem: OrderItem = {
        name: item.name,
        price: item.price,
        qty,
        disc
      };
      
      setBasket(prev => [...prev, basketItem]);
    }
    
    setSelectedItem('none');
    setQuantity('1');
    setDiscount('0');
  };

  const removeFromBasket = (index: number) => {
    setBasket(prev => prev.filter((_, i) => i !== index));
  };

  const updateBasketItem = (index: number, field: keyof OrderItem, value: number) => {
    setBasket(prev => prev.map((item, i) => 
      i === index ? { ...item, [field]: value } : item
    ));
  };

  const clearBasket = () => {
    setBasket([]);
  };

  const calculateTotals = () => {
    const subtotal = basket.reduce((sum, item) => {
      return sum + (item.price * item.qty * (1 - item.disc / 100));
    }, 0);
    
    const rate = Math.max(0, parseFloat(taxRate) || 0) / 100;
    const fee = subtotal * rate;
    const total = taxSign === 'plus' ? subtotal + fee : Math.max(0, subtotal - fee);
    
    return { subtotal, fee, total };
  };

  const handleCreateOrder = () => {
    if (!selectedCustomer || selectedCustomer === 'none' || basket.length === 0) return;
    
    const customer = customers.find(c => c.id === selectedCustomer);
    if (!customer) return;
    
    createOrder({
      ref: `Order`,
      customerName: customer.name,
      customerEmail: customer.email,
      customerPhone: customer.phone,
      items: [...basket],
      status: 'Ausstehend',
      taxRate: parseFloat(taxRate) || 0,
      taxSign
    });
    
    // Reset form
    setSelectedCustomer('none');
    setBasket([]);
    setTaxRate('0');
    setTaxSign('minus');
  };

  const { subtotal, fee, total } = calculateTotals();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShoppingCart className="h-5 w-5" />
          New Order
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Order Form */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <Label>Customer</Label>
            <Select value={selectedCustomer} onValueChange={setSelectedCustomer}>
              <SelectTrigger>
                <SelectValue placeholder="Select customer" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none" disabled>
                  {customers.length === 0 ? 'No customers available' : 'Select customer'}
                </SelectItem>
                {customers.map((customer) => {
                  const customerId = customer.id || `customer-${Date.now()}-${Math.random()}`;
                  return (
                    <SelectItem key={customerId} value={customerId}>
                      {customer.name}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>
          
          <div>
            <Label>Item / Endprodukt</Label>
            <Select value={selectedItem} onValueChange={setSelectedItem}>
              <SelectTrigger>
                <SelectValue placeholder="Select item" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none" disabled>
                  {items.length === 0 && endProducts.length === 0 ? 'No items available' : 'Select item'}
                </SelectItem>
                
                {/* Regular Items */}
                {items.length > 0 && (
                  <>
                    <SelectItem value="section-items" disabled className="font-semibold text-primary opacity-100 cursor-default">
                      📦 Normale Artikel
                    </SelectItem>
                    {items.map((item) => {
                      const itemId = item.id || `item-${Date.now()}-${Math.random()}`;
                      return (
                        <SelectItem key={itemId} value={itemId}>
                          {item.name} — ${item.price.toFixed(2)}
                        </SelectItem>
                      );
                    })}
                  </>
                )}
                
                {/* End Products */}
                {endProducts.length > 0 && (
                  <>
                    {items.length > 0 && <Separator className="my-2" />}
                    <SelectItem value="section-endproducts" disabled className="font-semibold text-primary opacity-100 cursor-default">
                      🔧 Endprodukte (aus Kalkulator)
                    </SelectItem>
                    {endProducts.map((product) => {
                      const price = calculateEndProductPrice(product);
                      return (
                        <SelectItem key={product.id} value={`endproduct-${product.id}`}>
                          {product.name} — ${price.toFixed(2)} (netto)
                        </SelectItem>
                      );
                    })}
                  </>
                )}
              </SelectContent>
            </Select>
          </div>
          
          <div>
            <Label>Quantity</Label>
            <Input
              type="number"
              min="1"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
            />
          </div>
          
          <div>
            <Label>Discount (%)</Label>
            <Input
              type="number"
              min="0"
              max="100"
              value={discount}
              onChange={(e) => setDiscount(e.target.value)}
            />
          </div>
        </div>
        
        <div className="flex gap-2">
          <Button onClick={addToBasket} className="flex-1">
            <Plus className="h-4 w-4 mr-2" />
            Add to Order
          </Button>
          <Button variant="outline" onClick={clearBasket}>
            Clear Basket
          </Button>
        </div>

        {/* Basket */}
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Item</TableHead>
                <TableHead>Qty</TableHead>
                <TableHead>Price</TableHead>
                <TableHead>Disc %</TableHead>
                <TableHead>Total</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {basket.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    No items in basket
                  </TableCell>
                </TableRow>
              ) : (
                basket.map((item, index) => {
                  const itemTotal = item.price * item.qty * (1 - item.disc / 100);
                  const isEndProduct = item.name.includes('🔧');
                  return (
                    <TableRow key={index}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {item.name}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min="1"
                          value={item.qty}
                          onChange={(e) => updateBasketItem(index, 'qty', parseInt(e.target.value) || 1)}
                          className="w-20"
                        />
                      </TableCell>
                      <TableCell>${item.price.toFixed(2)}</TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min="0"
                          max="100"
                          value={item.disc}
                          onChange={(e) => updateBasketItem(index, 'disc', parseInt(e.target.value) || 0)}
                          className="w-20"
                        />
                      </TableCell>
                      <TableCell>${itemTotal.toFixed(2)}</TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeFromBasket(index)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>

        {/* Tax/Fee Settings */}
        <div className="border-t pt-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Tax/Fee Rate (%)</Label>
              <Input
                type="number"
                min="0"
                step="0.1"
                value={taxRate}
                onChange={(e) => setTaxRate(e.target.value)}
              />
            </div>
            <div>
              <Label>Type</Label>
              <Select value={taxSign} onValueChange={(value: 'minus' | 'plus') => setTaxSign(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="minus">− Deduct (Payout ↓)</SelectItem>
                  <SelectItem value="plus">+ Add (Payment ↑)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Totals */}
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Subtotal</span>
              <span>${subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">
                Fee ({taxSign === 'plus' ? '+' : '−'})
              </span>
              <span className="text-muted-foreground">${fee.toFixed(2)}</span>
            </div>
            <div className="flex justify-between font-semibold border-t pt-2">
              <span>{taxSign === 'plus' ? 'Payment Amount' : 'Payout Amount'}</span>
              <span>${total.toFixed(2)}</span>
            </div>
          </div>

          <Button 
            onClick={handleCreateOrder} 
            className="w-full"
            disabled={selectedCustomer === 'none' || basket.length === 0}
          >
            <ShoppingCart className="h-4 w-4 mr-2" />
            Create Order
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
