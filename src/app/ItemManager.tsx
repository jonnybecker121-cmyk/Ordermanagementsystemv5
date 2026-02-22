import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Package, Plus, Trash2, Edit } from 'lucide-react';
import { useOrderStore } from './store/orderStore';

export function ItemManager() {
  const { items, addItem, updateItem, deleteItem } = useOrderStore();
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);

  const handleSubmit = () => {
    if (!name || !price) return;

    if (editingId) {
      updateItem(editingId, { name, price: parseFloat(price) });
      setEditingId(null);
    } else {
      addItem({ name, price: parseFloat(price) });
    }
    
    setName('');
    setPrice('');
  };

  const handleEdit = (item: any) => {
    setName(item.name);
    setPrice(item.price.toString());
    setEditingId(item.id);
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
        </div>
        <div className="space-y-2">
          <Label>Price</Label>
          <Input value={price} onChange={(e) => setPrice(e.target.value)} placeholder="Price" type="number" step="0.01" />
        </div>
        <Button onClick={handleSubmit} className="w-full">
          {editingId ? 'Update Item' : 'Add Item'}
        </Button>

        <div className="max-h-[300px] overflow-y-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead className="text-right">Price</TableHead>
                <TableHead className="w-20"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>
                    <div className="font-medium">{item.name}</div>
                  </TableCell>
                  <TableCell className="text-right">
                    ${item.price.toFixed(2)}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => handleEdit(item)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => deleteItem(item.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
