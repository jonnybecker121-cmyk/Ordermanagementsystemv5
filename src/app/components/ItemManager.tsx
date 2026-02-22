import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { useOrderStore } from '../store/orderStore';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { Trash2, Plus, Package } from 'lucide-react';

export function ItemManager() {
  const { items, addItem, deleteItem } = useOrderStore();
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');

  const handleAdd = () => {
    if (!name || !price) return;
    addItem({ name, price: parseFloat(price) });
    setName('');
    setPrice('');
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Package className="h-5 w-5" />
          Items
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>Name</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Item Name" />
          <Label>Price</Label>
          <Input type="number" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="Price" />
          <Button onClick={handleAdd} className="w-full">
            <Plus className="h-4 w-4 mr-2" />
            Add Item
          </Button>
        </div>
        
        <div className="max-h-[300px] overflow-y-auto border rounded-md">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Price</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.length === 0 ? (
                 <TableRow>
                   <TableCell colSpan={3} className="text-center text-muted-foreground">No items</TableCell>
                 </TableRow>
              ) : (
                items.map((i) => (
                  <TableRow key={i.id}>
                    <TableCell>{i.name}</TableCell>
                    <TableCell>${i.price.toFixed(2)}</TableCell>
                    <TableCell>
                      <Button size="sm" variant="ghost" onClick={() => deleteItem(i.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
