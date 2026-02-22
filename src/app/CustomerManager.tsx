import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Users, Plus, Trash2, Edit } from 'lucide-react';
import { useOrderStore } from './store/orderStore';

export function CustomerManager() {
  const { customers, addCustomer, updateCustomer, deleteCustomer } = useOrderStore();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);

  const handleSubmit = () => {
    if (!name) return;

    if (editingId) {
      updateCustomer(editingId, { name, email, phone });
      setEditingId(null);
    } else {
      addCustomer({ name, email, phone });
    }
    
    setName('');
    setEmail('');
    setPhone('');
  };

  const handleEdit = (customer: any) => {
    setName(customer.name);
    setEmail(customer.email);
    setPhone(customer.phone);
    setEditingId(customer.id);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          Customers
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>Name</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Customer Name" />
        </div>
        <div className="space-y-2">
          <Label>Email</Label>
          <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" />
        </div>
        <div className="space-y-2">
          <Label>Phone</Label>
          <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Phone" />
        </div>
        <Button onClick={handleSubmit} className="w-full">
          {editingId ? 'Update Customer' : 'Add Customer'}
        </Button>

        <div className="max-h-[300px] overflow-y-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead className="w-20"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {customers.map((customer) => (
                <TableRow key={customer.id}>
                  <TableCell>
                    <div className="font-medium">{customer.name}</div>
                    <div className="text-xs text-muted-foreground">{customer.email}</div>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => handleEdit(customer)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => deleteCustomer(customer.id)}>
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
