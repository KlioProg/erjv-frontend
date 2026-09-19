import { useState } from 'react'
import { Search, Plus, Receipt } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { OrderModal, type OrderFormValues } from './OrderModal'
import { useClients } from '@/features/crm/clients.hooks'
import { useProducts } from '@/features/products/products.hooks'
import { useAuth } from '@/features/auth/AuthContext'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

export interface Order {
  id: number
  invoiceNo: string
  clientName: string
  itemSummary: string
  total: number
  status: 'Completed' | 'Pending'
  date: string
  cashier: string
}

export function OrdersView() {
  const [orders, setOrders] = useState<Order[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [isOrderModalOpen, setIsOrderModalOpen] = useState(false)
  const { data: clients = [] } = useClients()
  const { data: products = [] } = useProducts()
  const { user } = useAuth()

  const cashier = user?.fullName || user?.email || 'Current User'

  const handleAddOrder = (values: OrderFormValues) => {
    setOrders((currentOrders) => [
      {
        id: Date.now(),
        ...values,
        date: new Date().toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
        }),
      },
      ...currentOrders,
    ])
  }

  const filteredOrders = orders.filter(
    (o) =>
      o.invoiceNo.toLowerCase().includes(searchTerm.toLowerCase()) ||
      o.clientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      o.itemSummary.toLowerCase().includes(searchTerm.toLowerCase()),
  )

  return (
    <div className="flex flex-col gap-5">
      {/* Top Controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Search invoice number, client..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 h-9 text-xs"
          />
        </div>

        <Button size="sm" onClick={() => setIsOrderModalOpen(true)}>
          <Plus className="size-4" />
          Create POS Order
        </Button>
      </div>

      {/* Orders Table */}
      {filteredOrders.length === 0 ? (
        <Card className="flex min-h-[360px] items-center justify-center border-dashed bg-muted/20 shadow-xs">
          <div className="flex flex-col items-center justify-center text-center">
            <Receipt className="size-8 text-muted-foreground/40" />
            <span className="text-sm font-semibold text-foreground">
              {searchTerm.trim() ? `No orders match "${searchTerm.trim()}"` : 'No sales orders found'}
            </span>
            <p className="text-xs text-muted-foreground mt-1 max-w-xs">
              {searchTerm.trim()
                ? 'Try a different invoice number, client, or item.'
                : 'Make your first order today!'}
            </p>
          </div>
        </Card>
      ) : (
        <Card className="overflow-hidden border-border/80 shadow-xs">
          <Table>
            <TableHeader className="bg-muted/40">
              <TableRow>
                <TableHead className="text-xs font-semibold">Invoice No</TableHead>
                <TableHead className="text-xs font-semibold">Client / Customer</TableHead>
                <TableHead className="text-xs font-semibold">Items Ordered</TableHead>
                <TableHead className="text-xs font-semibold">Processed By</TableHead>
                <TableHead className="text-xs font-semibold text-right">Amount (₱)</TableHead>
                <TableHead className="text-xs font-semibold text-center">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredOrders.map((order) => (
                <TableRow key={order.id} className="hover:bg-muted/20">
                  <TableCell className="font-mono text-xs font-bold text-foreground">
                    <div className="flex items-center gap-1.5">
                      <Receipt className="size-3.5 text-rose-600" />
                      <span>{order.invoiceNo}</span>
                    </div>
                    <span className="text-[10px] text-muted-foreground font-sans block mt-0.5">
                      {order.date}
                    </span>
                  </TableCell>

                  <TableCell className="text-xs font-semibold text-foreground">
                    {order.clientName}
                  </TableCell>

                  <TableCell className="text-xs text-foreground/90">{order.itemSummary}</TableCell>

                  <TableCell className="text-xs text-muted-foreground">{order.cashier}</TableCell>

                  <TableCell className="text-xs font-bold text-foreground text-right">
                    ₱{order.total.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </TableCell>

                  <TableCell className="text-center">
                    <Badge
                      variant="outline"
                      className={`text-[10px] font-semibold px-2.5 py-0.5 rounded-full ${
                        order.status === 'Completed'
                          ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
                          : 'bg-amber-500/10 text-amber-600 border-amber-500/20'
                      }`}
                    >
                      {order.status}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      {isOrderModalOpen && (
        <OrderModal
          open
          onClose={() => setIsOrderModalOpen(false)}
          onSubmit={handleAddOrder}
          clients={clients}
          products={products}
          cashier={cashier}
        />
      )}
    </div>
  )
}
