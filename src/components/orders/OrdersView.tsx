import { useState } from 'react'
import { CheckCircle2, Edit2, Plus, Receipt, Search, XCircle } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { StatusTabNav } from '@/components/ui/StatusTabNav'
import { OrderModal, type OrderFormValues, type OrderStatus } from './OrderModal'
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
  lines: OrderFormValues['lines']
  discountType: OrderFormValues['discountType']
  discountValue: number
  total: number
  status: OrderStatus
  date: string
  cashier: string
}

export function OrdersView() {
  const [orders, setOrders] = useState<Order[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [activeStatus, setActiveStatus] = useState<OrderStatus>('Active')
  const [isOrderModalOpen, setIsOrderModalOpen] = useState(false)
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)
  const { data: clients = [] } = useClients()
  const { data: products = [] } = useProducts()
  const { user } = useAuth()

  const cashier = user?.fullName || user?.email || 'Current User'

  const handleSaveOrder = (values: OrderFormValues) => {
    if (selectedOrder) {
      setOrders((currentOrders) =>
        currentOrders.map((order) =>
          order.id === selectedOrder.id
            ? { ...order, ...values }
            : order,
        ),
      )
      setSelectedOrder(null)
      setIsOrderModalOpen(false)
      return
    }

    const postedAt = new Date()
    const orderId = postedAt.getTime()
    const invoiceNo = `POS-${orderId.toString(36).toUpperCase()}`

    setOrders((currentOrders) => [
      {
        id: orderId,
        invoiceNo,
        ...values,
        date: postedAt.toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
        }),
      },
      ...currentOrders,
    ])
    setIsOrderModalOpen(false)
  }

  const statusCount = (status: OrderStatus) => orders.filter((order) => order.status === status).length

  const filteredOrders = orders.filter(
    (o) =>
      o.status === activeStatus &&
      (
        o.invoiceNo.toLowerCase().includes(searchTerm.toLowerCase()) ||
        o.clientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        o.itemSummary.toLowerCase().includes(searchTerm.toLowerCase())
      ),
  )

  return (
    <div className="flex flex-col gap-5">
      <StatusTabNav
        activeTab={activeStatus}
        onTabChange={(tab) => setActiveStatus(tab as OrderStatus)}
        tabs={[
          {
            value: 'Active',
            label: 'Active Orders',
            count: statusCount('Active'),
            icon: <CheckCircle2 className="size-3.5" />,
            accent: 'green',
          },
          {
            value: 'Completed',
            label: 'Completed Orders',
            count: statusCount('Completed'),
            icon: <CheckCircle2 className="size-3.5" />,
            accent: 'blue',
          },
          {
            value: 'Cancelled',
            label: 'Cancelled Orders',
            count: statusCount('Cancelled'),
            icon: <XCircle className="size-3.5" />,
            accent: 'red',
          },
        ]}
      />

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

        <Button
          size="sm"
          onClick={() => {
            setSelectedOrder(null)
            setIsOrderModalOpen(true)
          }}
        >
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
              {searchTerm.trim()
                ? `No ${activeStatus.toLowerCase()} orders match "${searchTerm.trim()}"`
                : `No ${activeStatus.toLowerCase()} orders found`}
            </span>
            <p className="text-xs text-muted-foreground mt-1 max-w-xs">
              {searchTerm.trim()
                ? 'Try a different invoice number, client, or item.'
                : activeStatus === 'Active'
                  ? 'Make your first order today!'
                  : 'Orders moved into this status will appear here.'}
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
                <TableHead className="text-xs font-semibold text-right">Actions</TableHead>
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
                      className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${
                        order.status === 'Completed'
                          ? 'bg-blue-500/10 text-blue-600 border-blue-500/20'
                          : order.status === 'Cancelled'
                            ? 'bg-rose-500/10 text-rose-600 border-rose-500/20'
                            : 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
                      }`}
                    >
                      {order.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Edit order ${order.invoiceNo}`}
                      onClick={() => {
                        setSelectedOrder(order)
                        setIsOrderModalOpen(true)
                      }}
                      className="size-8 text-muted-foreground hover:text-foreground"
                    >
                      <Edit2 className="size-3.5" />
                    </Button>
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
          onSubmit={handleSaveOrder}
          clients={clients}
          products={products}
          cashier={cashier}
          order={selectedOrder || undefined}
        />
      )}
    </div>
  )
}
