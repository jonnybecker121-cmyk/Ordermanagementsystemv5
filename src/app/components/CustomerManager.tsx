import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { useOrderStore } from '../store/orderStore';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { Trash2, UserPlus, Users } from 'lucide-react';

export function CustomerManager() {
  const { customers, addCustomer, deleteCustomer } = useOrderStore();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');

  const handleAdd = () => {
    if (!name) return;
    addCustomer({ name, email, phone });
    setName('');
    setEmail('');
    setPhone('');
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
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" />
          <Label>Email</Label>
          <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" />
          <Label>Phone</Label>
          <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Phone" />
          <Button onClick={handleAdd} className="w-full">
            <UserPlus className="h-4 w-4 mr-2" />
            Add Customer
          </Button>
        </div>
        
        <div className="max-h-[300px] overflow-y-auto border rounded-md">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {customers.length === 0 ? (
                 <TableRow>
                   <TableCell colSpan={2} className="text-center text-muted-foreground">No customers</TableCell>
                 </TableRow>
              ) : (
                customers.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell>
                      <div className="font-medium">{c.name}</div>
                      <div className="text-xs text-muted-foreground">{c.email}</div>
                    </TableCell>
                    <TableCell>
                      <Button size="sm" variant="ghost" onClick={() => deleteCustomer(c.id)}>
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
