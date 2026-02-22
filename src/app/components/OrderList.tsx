import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { Badge } from '../ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../ui/dropdown-menu';
import { MoreHorizontal, Download, Eye, Edit, Trash2, Archive, RotateCcw, CheckCircle, ShoppingCart } from 'lucide-react';
import { useOrderStore, type Order } from '../store/orderStore';
import { StatusIndicator } from './StatusIndicator';

export function OrderList() {
  const { 
    ordersOpen, 
    ordersDone, 
    deleteOrder, 
    moveOrderToCompleted, 
    reopenOrder, 
    archiveOrder, 
    unarchiveOrder,
    updateOrder,
    autoArchiveCompleted
  } = useOrderStore();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [activeTab, setActiveTab] = useState('open');

  const calculateOrderTotal = (order: Order) => {
    const subtotal = order.items.reduce((sum, item) => {
      return sum + (item.price * item.qty * (1 - item.disc / 100));
    }, 0);
    
    const fee = subtotal * (order.taxRate / 100);
    return order.taxSign === 'plus' ? subtotal + fee : Math.max(0, subtotal - fee);
  };

  const getStatusBadge = (status: string, archived?: boolean) => {
    let variant: 'default' | 'secondary' | 'destructive' = 'secondary';
    let className = '';
    
    if (status === 'Gezahlt') variant = 'default';
    if (status === 'Ausstehend') variant = 'destructive';
    if (status === 'Abgeschlossen') {
      variant = 'secondary';
      className = 'bg-gray-100 text-gray-800 border-gray-200';
    }
    
    return (
      <Badge variant={variant} className={className}>
        {status}{archived ? ' · Archived' : ''}
      </Badge>
    );
  };

  const filterOrders = (orders: Order[]) => {
    return orders.filter(order => {
      const matchesSearch = !searchTerm || 
        order.number.toLowerCase().includes(searchTerm.toLowerCase()) ||
        order.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        order.customerEmail.toLowerCase().includes(searchTerm.toLowerCase()) ||
        order.ref.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesStatus = !statusFilter || statusFilter === 'all' || order.status === statusFilter;
      
      const matchesTab = activeTab === 'open' ? !order.completedAt : 
                        activeTab === 'done' && !order.archived ? !!order.completedAt :
                        activeTab === 'archive' ? !!order.archived : false;
      
      return matchesSearch && matchesStatus && matchesTab;
    });
  };

  const exportToCSV = () => {
    const allOrders = [...ordersOpen, ...ordersDone];
    const headers = [
      'Number', 'Reference', 'Customer', 'Email', 'Phone', 'Status', 
      'Items', 'Total Qty', 'Amount', 'Created', 'Completed'
    ];
    
    const rows = allOrders.map(order => {
      const totalQty = order.items.reduce((sum, item) => sum + item.qty, 0);
      const amount = calculateOrderTotal(order);
      const itemsStr = order.items.map(item => 
        `${item.name} (${item.qty}x$${item.price})`
      ).join(' | ');
      
      return [
        order.number,
        order.ref,
        order.customerName,
        order.customerEmail,
        order.customerPhone,
        order.status,
        itemsStr,
        totalQty,
        amount.toFixed(2),
        new Date(order.createdAt).toLocaleDateString(),
        order.completedAt ? new Date(order.completedAt).toLocaleDateString() : ''
      ];
    });
    
    const csvContent = [headers, ...rows]
      .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'orders.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const currentOrders = activeTab === 'open' ? ordersOpen : ordersDone;
  const filteredOrders = filterOrders(currentOrders);

  return (
    <Card>
      <CardHeader className="border-b border-primary/20 bg-card pb-3">
        <CardTitle className="flex items-center gap-2">
          <div className="p-1.5 bg-primary/90 rounded-md shadow-md shadow-primary/10">
            <ShoppingCart className="h-4 w-4 text-primary-foreground" />
          </div>
          <span className="text-black dark:text-white">Aufträge</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 pt-4">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="open">Offen</TabsTrigger>
            <TabsTrigger value="done">Gezahlt</TabsTrigger>
            <TabsTrigger value="archive">Abgeschlossen</TabsTrigger>
          </TabsList>

          {/* Filters */}
          <div className="flex gap-4 items-end mt-4">
            <div className="flex-1">
              <Label>Search</Label>
              <Input
                placeholder="Customer, items, reference, email, phone..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="w-48">
              <Label>Status</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="Ausstehend">Pending</SelectItem>
                  <SelectItem value="In Bearbeitung">Processing</SelectItem>
                  <SelectItem value="Gezahlt">Paid</SelectItem>
                  <SelectItem value="Abgeschlossen">Completed</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2">
              {activeTab === 'done' && (
                <Button 
                  onClick={() => {
                    const completedCount = ordersDone.filter(o => o.status === 'Abgeschlossen').length;
                    if (completedCount > 0) {
                      autoArchiveCompleted();
                    }
                  }}
                  variant="outline"
                  disabled={ordersDone.filter(o => o.status === 'Abgeschlossen').length === 0}
                  className="hover:bg-accent"
                >
                  <Archive className="h-4 w-4 mr-2" />
                  Alle Abgeschlossenen archivieren ({ordersDone.filter(o => o.status === 'Abgeschlossen').length})
                </Button>
              )}
              
              <Button 
                onClick={() => {
                  const csvData = filteredOrders.map(order => ({
                    Reference: order.ref || order.number,
                    Customer: order.customerName,
                    Email: order.customerEmail,
                    Phone: order.customerPhone,
                    Items: order.items.map(item => `${item.name} (${item.qty}x${item.price})`).join('; '),
                    TotalQty: order.items.reduce((sum, item) => sum + item.qty, 0),
                    Amount: calculateOrderTotal(order).toFixed(2),
                    Status: order.status,
                    Created: new Date(order.createdAt).toLocaleDateString(),
                    Archived: order.archived ? 'Yes' : 'No'
                  }));
                  
                  const csv = [
                    Object.keys(csvData[0]).join(','),
                    ...csvData.map(row => Object.values(row).map(value => `"${value}"`).join(','))
                  ].join('\n');
                  
                  const blob = new Blob([csv], { type: 'text/csv' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `orders-${activeTab}-${new Date().toISOString().split('T')[0]}.csv`;
                  document.body.appendChild(a);
                  a.click();
                  document.body.removeChild(a);
                  URL.revokeObjectURL(url);
                }} 
                variant="outline"
                className="hover:bg-accent"
              >
                <Download className="h-4 w-4 mr-2" />
                CSV Export ({filteredOrders.length})
              </Button>
            </div>
          </div>

          <TabsContent value={activeTab}>
            <div className="border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Reference</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Items</TableHead>
                    <TableHead>Qty</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-12"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredOrders.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground">
                        No orders found
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredOrders.map((order) => {
                      const totalQty = order.items.reduce((sum, item) => sum + item.qty, 0);
                      const amount = calculateOrderTotal(order);
                      
                      return (
                        <TableRow key={order.id}>
                          <TableCell>
                            <div>
                              <div className="font-medium">{order.ref || `Order ${order.number}`}</div>
                              <div className="text-sm text-muted-foreground">{order.number}</div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="font-medium">{order.customerName}</div>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm">
                              {order.items.map(item => 
                                `${item.name} (${item.qty}×$${item.price.toFixed(2)})`
                              ).join(', ')}
                            </div>
                          </TableCell>
                          <TableCell>{totalQty}</TableCell>
                          <TableCell>
                            <div>${amount.toFixed(2)}</div>
                            {order.taxRate > 0 && (
                              <div className="text-xs text-muted-foreground">
                                {order.taxSign === 'plus' ? 'incl.' : 'after'} {order.taxRate}% fee
                              </div>
                            )}
                          </TableCell>
                          <TableCell>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <div className="cursor-pointer">
                                  <StatusIndicator 
                                    orderId={order.id}
                                    status={order.status}
                                    paidAt={order.paidAt}
                                    showTimer={true}
                                  />
                                </div>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="center">
                                <DropdownMenuItem 
                                  onClick={() => updateOrder(order.id, { status: 'Ausstehend' })}
                                  className={order.status === 'Ausstehend' ? 'bg-accent' : ''}
                                >
                                  <Badge variant="secondary" className="mr-2 text-xs bg-yellow-100 text-yellow-800">Ausstehend</Badge>
                                  Ausstehend
                                </DropdownMenuItem>
                                <DropdownMenuItem 
                                  onClick={() => updateOrder(order.id, { status: 'In Bearbeitung' })}
                                  className={order.status === 'In Bearbeitung' ? 'bg-accent' : ''}
                                >
                                  <Badge variant="outline" className="mr-2 text-xs bg-blue-100 text-blue-800">In Bearbeitung</Badge>
                                  In Bearbeitung
                                </DropdownMenuItem>
                                <DropdownMenuItem 
                                  onClick={() => updateOrder(order.id, { status: 'Warten auf Zahlung' })}
                                  className={order.status === 'Warten auf Zahlung' ? 'bg-accent' : ''}
                                >
                                  <Badge variant="secondary" className="mr-2 text-xs bg-orange-100 text-orange-800">Warten</Badge>
                                  Warten auf Zahlung
                                </DropdownMenuItem>
                                <DropdownMenuItem 
                                  onClick={() => updateOrder(order.id, { status: 'Gezahlt' })}
                                  className={order.status === 'Gezahlt' ? 'bg-accent' : ''}
                                  disabled
                                >
                                  <Badge variant="default" className="mr-2 text-xs bg-green-100 text-green-800">Gezahlt</Badge>
                                  Gezahlt (Auto)
                                </DropdownMenuItem>
                                <DropdownMenuItem 
                                  onClick={() => updateOrder(order.id, { status: 'Abgeschlossen' })}
                                  className={order.status === 'Abgeschlossen' ? 'bg-accent' : ''}
                                  disabled
                                >
                                  <Badge variant="secondary" className="mr-2 text-xs bg-gray-100 text-gray-800">Abgeschlossen</Badge>
                                  Abgeschlossen (Auto)
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                          <TableCell>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm" className="hover:bg-accent">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => {
                                  alert(`Order Details:\n\nReference: ${order.ref || order.number}\nCustomer: ${order.customerName}\nEmail: ${order.customerEmail}\nPhone: ${order.customerPhone}\nItems: ${order.items.length}\nTotal: ${calculateOrderTotal(order).toFixed(2)}\nStatus: ${order.status}\nCreated: ${new Date(order.createdAt).toLocaleDateString()}`);
                                }}>
                                  <Eye className="h-4 w-4 mr-2" />
                                  View Details
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => {
                                  const newRef = prompt('Edit Reference:', order.ref);
                                  if (newRef !== null) {
                                    updateOrder(order.id, { ref: newRef });
                                  }
                                }}>
                                  <Edit className="h-4 w-4 mr-2" />
                                  Edit Reference
                                </DropdownMenuItem>
                                
                                {activeTab === 'open' && order.status !== 'Gezahlt' && (
                                  <DropdownMenuItem onClick={() => updateOrder(order.id, { status: 'Gezahlt' })}>
                                    <CheckCircle className="h-4 w-4 mr-2" />
                                    Mark as Paid
                                  </DropdownMenuItem>
                                )}
                                
                                {activeTab === 'done' && !order.archived && (
                                  <>
                                    <DropdownMenuItem onClick={() => updateOrder(order.id, { status: 'In Bearbeitung' })}>
                                      <RotateCcw className="h-4 w-4 mr-2" />
                                      Reopen Order
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => archiveOrder(order.id)}>
                                      <Archive className="h-4 w-4 mr-2" />
                                      Archive Order
                                    </DropdownMenuItem>
                                  </>
                                )}
                                
                                {activeTab === 'archive' && (
                                  <DropdownMenuItem onClick={() => unarchiveOrder(order.id)}>
                                    <RotateCcw className="h-4 w-4 mr-2" />
                                    Restore from Archive
                                  </DropdownMenuItem>
                                )}
                                
                                <DropdownMenuItem 
                                  onClick={() => {
                                    if (confirm(`Are you sure you want to delete order ${order.ref || order.number}? This action cannot be undone.`)) {
                                      deleteOrder(order.id);
                                    }
                                  }}
                                  className="text-destructive hover:bg-destructive/10"
                                >
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  Delete Order
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
