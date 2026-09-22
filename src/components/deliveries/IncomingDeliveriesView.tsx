import { useState, useMemo } from 'react'
import {
  ArrowDownToLine,
  Check,
  CheckCircle2,
  Clock,
  Plus,
  Search,
  Warehouse as WarehouseIcon,
  X,
  XCircle,
} from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { StatusTabNav } from '@/components/ui/StatusTabNav'
import { ScheduleIncomingDeliveryModal } from './ScheduleIncomingDeliveryModal'
import {
  useIncomingDeliveries,
  useCreateIncomingDelivery,
  useScheduleIncomingDelivery,
  useCompleteIncomingDelivery,
  useCancelIncomingDelivery,
} from '@/features/logistics/incoming-deliveries.hooks'
import { usePurchaseOrders } from '@/features/logistics/purchase-orders.hooks'
import { useWarehouses } from '@/features/logistics/warehouses.hooks'
import { useSuppliers } from '@/features/logistics/suppliers.hooks'
import { useProducts } from '@/features/products/products.hooks'
import type { CreateIncomingDeliveryPayload } from '@/features/logistics/incoming-deliveries.types'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

export type IncomingStatusFilter = 'Active' | 'Completed' | 'Cancelled'

export function IncomingDeliveriesView() {
  const [searchTerm, setSearchTerm] = useState('')
  const [activeTab, setActiveTab] = useState<IncomingStatusFilter>('Active')
  const [isModalOpen, setIsModalOpen] = useState(false)

  const { data: deliveries = [], isLoading } = useIncomingDeliveries()
  const { data: purchaseOrders = [] } = usePurchaseOrders()
  const { data: warehouses = [] } = useWarehouses()
  const { data: suppliers = [] } = useSuppliers()
  const { data: products = [] } = useProducts()

  const createDeliveryMutation = useCreateIncomingDelivery()
  const scheduleDeliveryMutation = useScheduleIncomingDelivery()
  const completeDeliveryMutation = useCompleteIncomingDelivery()
  const cancelDeliveryMutation = useCancelIncomingDelivery()

  const poMap = useMemo(() => new Map(purchaseOrders.map((p) => [p.id, p])), [purchaseOrders])
  const whMap = useMemo(() => new Map(warehouses.map((w) => [w.id, w])), [warehouses])
  const supplierMap = useMemo(() => new Map(suppliers.map((s) => [s.id, s])), [suppliers])
  const productMap = useMemo(() => new Map(products.map((p) => [p.id, p])), [products])

  const counts = useMemo(() => {
    const active = deliveries.filter((d) => ['DRAFT', 'SCHEDULED'].includes(d.status)).length
    const completed = deliveries.filter((d) => d.status === 'COMPLETED').length
    const cancelled = deliveries.filter((d) => d.status === 'CANCELLED').length
    return { active, completed, cancelled, all: deliveries.length }
  }, [deliveries])

  const filteredDeliveries = useMemo(() => {
    return deliveries.filter((d) => {
      let matchesTab = false
      if (activeTab === 'Active') {
        matchesTab = ['DRAFT', 'SCHEDULED'].includes(d.status)
      } else if (activeTab === 'Completed') {
        matchesTab = d.status === 'COMPLETED'
      } else if (activeTab === 'Cancelled') {
        matchesTab = d.status === 'CANCELLED'
      }

      if (!matchesTab) return false
      if (!searchTerm.trim()) return true

      const q = searchTerm.toLowerCase().trim()
      const delNo = d.deliveryNumber.toLowerCase()
      const po = poMap.get(d.purchaseOrderId)
      const poNo = po?.orderNumber.toLowerCase() || ''
      const sup = po ? supplierMap.get(po.supplierId)?.name.toLowerCase() || '' : ''
      const wh = whMap.get(d.warehouseId)?.name.toLowerCase() || ''
      const ref = d.supplierReference?.toLowerCase() || ''

      return (
        delNo.includes(q) ||
        poNo.includes(q) ||
        sup.includes(q) ||
        wh.includes(q) ||
        ref.includes(q)
      )
    })
  }, [deliveries, activeTab, searchTerm, poMap, whMap, supplierMap])

  const handleCreate = async (payload: CreateIncomingDeliveryPayload) => {
    const created = await createDeliveryMutation.mutateAsync(payload)
    if (created?.id) {
      try {
        await scheduleDeliveryMutation.mutateAsync(created.id)
      } catch {
        // Fallback: remains in DRAFT with Schedule button available
      }
    }
    setIsModalOpen(false)
  }

  const renderStatusBadge = (status: string) => {
    switch (status) {
      case 'DRAFT':
        return (
          <Badge
            variant="outline"
            className="rounded-full bg-amber-500/10 text-amber-600 border-amber-500/20 px-2 py-0.5 text-[10px] font-semibold inline-flex items-center gap-1"
          >
            <Clock className="size-3" />
            Draft
          </Badge>
        )
      case 'SCHEDULED':
        return (
          <Badge
            variant="outline"
            className="rounded-full bg-blue-500/10 text-blue-600 border-blue-500/20 px-2 py-0.5 text-[10px] font-semibold inline-flex items-center gap-1"
          >
            <Clock className="size-3" />
            Scheduled
          </Badge>
        )
      case 'COMPLETED':
        return (
          <Badge
            variant="outline"
            className="rounded-full bg-emerald-500/10 text-emerald-600 border-emerald-500/20 px-2 py-0.5 text-[10px] font-semibold inline-flex items-center gap-1"
          >
            <CheckCircle2 className="size-3" />
            Received & Stocked
          </Badge>
        )
      case 'CANCELLED':
        return (
          <Badge
            variant="outline"
            className="rounded-full bg-rose-500/10 text-rose-600 border-rose-500/20 px-2 py-0.5 text-[10px] font-semibold inline-flex items-center gap-1"
          >
            <XCircle className="size-3" />
            Cancelled
          </Badge>
        )
      default:
        return (
          <Badge variant="outline" className="text-[10px]">
            {status}
          </Badge>
        )
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <StatusTabNav
        activeTab={activeTab}
        onTabChange={(tab) => setActiveTab(tab as IncomingStatusFilter)}
        tabs={[
          {
            value: 'Active',
            label: 'Inbound In-Transit',
            count: counts.active,
            icon: <Clock className="size-3.5" />,
            accent: 'green',
          },
          {
            value: 'Completed',
            label: 'Received & Stocked',
            count: counts.completed,
            icon: <CheckCircle2 className="size-3.5" />,
            accent: 'blue',
          },
          {
            value: 'Cancelled',
            label: 'Cancelled',
            count: counts.cancelled,
            icon: <XCircle className="size-3.5" />,
            accent: 'red',
          },
        ]}
      />

      <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
        <div className="relative w-full sm:w-80">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search incoming delivery #, PO, supplier, dock..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 h-9 text-xs"
          />
        </div>

        <Button
          size="sm"
          onClick={() => setIsModalOpen(true)}
          disabled={purchaseOrders.length === 0}
        >
          <Plus className="size-4" />
          Schedule Inbound Intake
        </Button>
      </div>

      {isLoading ? (
        <Card className="flex min-h-[300px] items-center justify-center p-8">
          <div className="flex flex-col items-center gap-2">
            <Clock className="size-6 animate-spin text-primary" />
            <p className="text-xs text-muted-foreground">Loading incoming deliveries...</p>
          </div>
        </Card>
      ) : filteredDeliveries.length === 0 ? (
        <Card className="flex min-h-[340px] items-center justify-center border-dashed bg-muted/20 shadow-xs">
          <div className="flex flex-col items-center justify-center text-center">
            <ArrowDownToLine className="size-8 text-muted-foreground/40 mb-2" />
            <span className="text-sm font-semibold text-foreground">
              {searchTerm.trim()
                ? `No incoming shipments match "${searchTerm.trim()}"`
                : `No ${activeTab.toLowerCase()} incoming deliveries found`}
            </span>
            <p className="text-xs text-muted-foreground mt-1 max-w-xs">
              {searchTerm.trim()
                ? 'Try searching with a different delivery number or supplier name.'
                : activeTab === 'Active'
                  ? 'Schedule inbound shipments from confirmed purchase orders.'
                  : 'Deliveries moved into this status will appear here.'}
            </p>
          </div>
        </Card>
      ) : (
        <Card className="overflow-hidden border-border/80 shadow-xs">
          <Table>
            <TableHeader className="bg-muted/40">
              <TableRow>
                <TableHead className="text-xs font-semibold">Delivery #</TableHead>
                <TableHead className="text-xs font-semibold">Purchase Order & Supplier</TableHead>
                <TableHead className="text-xs font-semibold">Destination Warehouse</TableHead>
                <TableHead className="text-xs font-semibold">Received Cargo Items</TableHead>
                <TableHead className="text-xs font-semibold">Scheduled / Received</TableHead>
                <TableHead className="text-xs font-semibold text-center">Status</TableHead>
                <TableHead className="text-xs font-semibold text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredDeliveries.map((delivery) => {
                const po = poMap.get(delivery.purchaseOrderId)
                const supplier = po ? supplierMap.get(po.supplierId) : null
                const warehouse = whMap.get(delivery.warehouseId)

                const cargoSummary = delivery.items
                  .map((item) => {
                    const poItem = po?.items.find((poi) => poi.id === item.purchaseOrderItemId)
                    const product = poItem ? productMap.get(poItem.inventoryItemId) : null
                    return `${product ? product.name : 'Item'} (x${item.receivedQuantity})`
                  })
                  .join(', ')

                const arrivalDate = delivery.completedAt
                  ? new Date(delivery.completedAt).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                    })
                  : delivery.scheduledAt
                    ? new Date(delivery.scheduledAt).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })
                    : 'Unscheduled'

                return (
                  <TableRow key={delivery.id} className="hover:bg-muted/20">
                    <TableCell className="font-mono text-xs font-bold text-foreground">
                      <div className="flex items-center gap-1.5">
                        <ArrowDownToLine className="size-3.5 text-primary" />
                        <span>{delivery.deliveryNumber}</span>
                      </div>
                      {delivery.supplierReference && (
                        <span className="text-[10px] text-muted-foreground font-sans block mt-0.5">
                          Ref: {delivery.supplierReference}
                        </span>
                      )}
                    </TableCell>

                    <TableCell className="text-xs font-semibold text-foreground">
                      <div>{po?.orderNumber || `PO #${delivery.purchaseOrderId}`}</div>
                      <div className="text-[10px] text-muted-foreground font-normal">
                        {supplier?.name || 'Supplier'}
                      </div>
                    </TableCell>

                    <TableCell className="text-xs font-medium text-foreground">
                      <div className="flex items-center gap-1.5">
                        <WarehouseIcon className="size-3.5 text-muted-foreground shrink-0" />
                        <span>{warehouse?.name || `Warehouse #${delivery.warehouseId}`}</span>
                      </div>
                    </TableCell>

                    <TableCell
                      className="text-xs text-foreground/90 max-w-[220px] truncate"
                      title={cargoSummary}
                    >
                      {cargoSummary || 'No cargo listed'}
                    </TableCell>

                    <TableCell className="text-xs text-muted-foreground">{arrivalDate}</TableCell>

                    <TableCell className="text-center">
                      {renderStatusBadge(delivery.status)}
                    </TableCell>

                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        {delivery.status === 'DRAFT' && (
                          <>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 px-2 text-[11px] text-blue-600 border-blue-500/30 hover:bg-blue-500/10"
                              onClick={() => scheduleDeliveryMutation.mutate(delivery.id)}
                              disabled={scheduleDeliveryMutation.isPending}
                              title="Mark Scheduled"
                            >
                              <Clock className="size-3 mr-1" />
                              Schedule
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 px-2 text-[11px] text-rose-600 hover:bg-rose-500/10"
                              onClick={() => cancelDeliveryMutation.mutate(delivery.id)}
                              disabled={cancelDeliveryMutation.isPending}
                              title="Cancel Delivery"
                            >
                              <X className="size-3 mr-1" />
                              Cancel
                            </Button>
                          </>
                        )}

                        {delivery.status === 'SCHEDULED' && (
                          <>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 px-2 text-[11px] text-emerald-600 border-emerald-500/30 hover:bg-emerald-500/10"
                              onClick={() => completeDeliveryMutation.mutate(delivery.id)}
                              disabled={completeDeliveryMutation.isPending}
                              title="Receive Goods into Warehouse Stock"
                            >
                              <Check className="size-3 mr-1" />
                              Receive & Stock
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 px-2 text-[11px] text-rose-600 hover:bg-rose-500/10"
                              onClick={() => cancelDeliveryMutation.mutate(delivery.id)}
                              disabled={cancelDeliveryMutation.isPending}
                              title="Cancel Delivery"
                            >
                              <X className="size-3 mr-1" />
                              Cancel
                            </Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </Card>
      )}

      {isModalOpen && (
        <ScheduleIncomingDeliveryModal
          open
          onClose={() => setIsModalOpen(false)}
          onSubmit={handleCreate}
          purchaseOrders={purchaseOrders}
          warehouses={warehouses}
          suppliers={suppliers}
          products={products}
        />
      )}
    </div>
  )
}
