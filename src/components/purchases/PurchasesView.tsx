import { useState, useMemo } from 'react'
import {
  Archive,
  ArrowDownToLine,
  Building2,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock,
  Eye,
  Info,
  Package,
  Plus,
  Search,
  Truck,
  X,
  XCircle,
} from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { ArchiveTabNav } from '@/components/ui/ArchiveTabNav'
import { StatusTabNav } from '@/components/ui/StatusTabNav'
import { ConfirmDeleteModal } from '@/components/ui/ConfirmDeleteModal'
import { PurchaseModal } from './PurchaseModal'
import { PurchaseOrderDetailModal } from './PurchaseOrderDetailModal'
import { SupplierModal } from './SupplierModal'
import { useAuth } from '@/features/auth/AuthContext'
import { useProducts } from '@/features/products/products.hooks'
import {
  usePurchaseOrders,
  useCreatePurchaseOrder,
  useConfirmPurchaseOrder,
  useCancelPurchaseOrder,
} from '@/features/logistics/purchase-orders.hooks'
import {
  useSuppliers,
  useCreateSupplier,
  useUpdateSupplier,
  useDeleteSupplier,
  useReactivateSupplier,
} from '@/features/logistics/suppliers.hooks'
import type { Supplier } from '@/features/logistics/suppliers.types'
import type { CreatePurchaseOrderPayload } from '@/features/logistics/purchase-orders.types'
import { useWarehouses } from '@/features/logistics/warehouses.hooks'
import { useIncomingDeliveries } from '@/features/logistics/incoming-deliveries.hooks'
import { DataTable, type ColumnDef } from '@/components/ui/data-table'
import { DirectoryStatusBadge } from '@/components/ui/DirectoryRowControls'
import { DataTableActions } from '@/components/ui/DataTableActions'

export type PurchaseTabFilter = 'Active' | 'Completed' | 'Cancelled'

export type PurchaseSection = 'orders' | 'suppliers'

type PurchasesViewProps = {
  section?: PurchaseSection
  onNavigateToDeliveries?: (purchaseOrderId?: number) => void
}

export function PurchasesView({
  section = 'orders',
  onNavigateToDeliveries,
}: PurchasesViewProps = {}) {
  const [searchTerm, setSearchTerm] = useState('')
  const [activeStatus, setActiveStatus] = useState<PurchaseTabFilter>('Active')
  const [supplierView, setSupplierView] = useState<'ACTIVE' | 'ARCHIVED'>('ACTIVE')

  // Modals state
  const [isPurchaseModalOpen, setIsPurchaseModalOpen] = useState(false)
  const [isSupplierModalOpen, setIsSupplierModalOpen] = useState(false)
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null)
  const [supplierToArchive, setSupplierToArchive] = useState<Supplier | null>(null)
  const [selectedOrderId, setSelectedOrderId] = useState<number | null>(null)

  const { user } = useAuth()
  const processedBy = user?.fullName || user?.email || 'Current User'

  // Data queries
  const { data: purchaseOrders = [], isLoading: isLoadingPOs } = usePurchaseOrders()
  const { data: suppliers = [], isLoading: isLoadingSuppliers } = useSuppliers({
    includeInactive: 'true',
  })
  const { data: products = [] } = useProducts()
  const { data: warehouses = [] } = useWarehouses()
  const { data: incomingDeliveries = [] } = useIncomingDeliveries()
  const selectedOrder = purchaseOrders.find((order) => order.id === selectedOrderId)

  // Mutations
  const createPOMutation = useCreatePurchaseOrder()
  const confirmPOMutation = useConfirmPurchaseOrder()
  const cancelPOMutation = useCancelPurchaseOrder()

  const createSupplierMutation = useCreateSupplier()
  const updateSupplierMutation = useUpdateSupplier()
  const deleteSupplierMutation = useDeleteSupplier()
  const reactivateSupplierMutation = useReactivateSupplier()

  const supplierMap = useMemo(() => {
    return new Map(suppliers.map((s) => [s.id, s]))
  }, [suppliers])

  const productMap = useMemo(() => {
    return new Map(products.map((p) => [p.id, p]))
  }, [products])

  const statusCount = (status: PurchaseTabFilter) => {
    if (status === 'Active') {
      return purchaseOrders.filter((po) =>
        ['DRAFT', 'CONFIRMED', 'PARTIALLY_RECEIVED'].includes(po.status),
      ).length
    }
    if (status === 'Completed') {
      return purchaseOrders.filter((po) => po.status === 'RECEIVED').length
    }
    if (status === 'Cancelled') {
      return purchaseOrders.filter((po) => po.status === 'CANCELLED').length
    }
    return 0
  }

  const filteredOrders = useMemo(() => {
    return purchaseOrders.filter((po) => {
      let matchesStatus = false
      if (activeStatus === 'Active') {
        matchesStatus = ['DRAFT', 'CONFIRMED', 'PARTIALLY_RECEIVED'].includes(po.status)
      } else if (activeStatus === 'Completed') {
        matchesStatus = po.status === 'RECEIVED'
      } else if (activeStatus === 'Cancelled') {
        matchesStatus = po.status === 'CANCELLED'
      }

      if (!matchesStatus) return false

      if (!searchTerm.trim()) return true
      const q = searchTerm.toLowerCase().trim()
      const supplier = supplierMap.get(po.supplierId)
      const supplierName = supplier?.name?.toLowerCase() || ''
      const orderNo = po.orderNumber.toLowerCase()
      const extRef = po.externalReference?.toLowerCase() || ''

      return orderNo.includes(q) || supplierName.includes(q) || extRef.includes(q)
    })
  }, [purchaseOrders, activeStatus, searchTerm, supplierMap])

  const activeSuppliers = useMemo(
    () => suppliers.filter((supplier) => supplier.isActive !== false),
    [suppliers],
  )
  const archivedSuppliers = useMemo(
    () => suppliers.filter((supplier) => supplier.isActive === false),
    [suppliers],
  )

  const filteredSuppliers = useMemo(() => {
    const visibleSuppliers = supplierView === 'ACTIVE' ? activeSuppliers : archivedSuppliers
    if (!searchTerm.trim()) return visibleSuppliers
    const q = searchTerm.toLowerCase().trim()
    return visibleSuppliers.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.code.toLowerCase().includes(q) ||
        s.contactPerson?.toLowerCase().includes(q) ||
        s.phone?.toLowerCase().includes(q) ||
        s.email?.toLowerCase().includes(q) ||
        s.address?.toLowerCase().includes(q),
    )
  }, [activeSuppliers, archivedSuppliers, supplierView, searchTerm])

  const handleCreatePO = async (payload: CreatePurchaseOrderPayload) => {
    await createPOMutation.mutateAsync(payload)
    setIsPurchaseModalOpen(false)
  }

  const handleSaveSupplier = async (values: {
    code: string
    name: string
    contactPerson?: string
    phone?: string
    email?: string
    address?: string
  }) => {
    if (selectedSupplier) {
      await updateSupplierMutation.mutateAsync({
        id: selectedSupplier.id,
        payload: values,
      })
    } else {
      await createSupplierMutation.mutateAsync(values)
    }
    setIsSupplierModalOpen(false)
    setSelectedSupplier(null)
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
      case 'CONFIRMED':
        return (
          <Badge
            variant="outline"
            className="rounded-full bg-blue-500/10 text-blue-600 border-blue-500/20 px-2 py-0.5 text-[10px] font-semibold inline-flex items-center gap-1"
          >
            <CheckCircle2 className="size-3" />
            Confirmed
          </Badge>
        )
      case 'PARTIALLY_RECEIVED':
        return (
          <Badge
            variant="outline"
            className="rounded-full bg-indigo-500/10 text-indigo-600 border-indigo-500/20 px-2 py-0.5 text-[10px] font-semibold inline-flex items-center gap-1"
          >
            <Truck className="size-3" />
            Partially Received
          </Badge>
        )
      case 'RECEIVED':
        return (
          <Badge
            variant="outline"
            className="rounded-full bg-emerald-500/10 text-emerald-600 border-emerald-500/20 px-2 py-0.5 text-[10px] font-semibold inline-flex items-center gap-1"
          >
            <CheckCircle2 className="size-3" />
            Received
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

  const orderRows = filteredOrders.map((po) => {
    const supplier = supplierMap.get(po.supplierId)
    const supplierName = supplier?.name || `Supplier #${po.supplierId}`
    const total = (po.items || []).reduce(
      (sum, item) =>
        sum + Number(item.totalAmount || Number(item.quantity) * Number(item.unitPrice)),
      0,
    )

    const itemSummary = (po.items || [])
      .map((item) => {
        const prod = productMap.get(item.inventoryItemId)
        const name = prod ? prod.name : `Item #${item.inventoryItemId}`
        return `${name} (x${item.quantity})`
      })
      .join(', ')

    const orderDate = new Date(po.orderedAt).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })

    const expectedDate = po.expectedAt
      ? new Date(po.expectedAt).toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
        })
      : 'Not set'

    return { po, supplierName, total, itemSummary, orderDate, expectedDate }
  })

  const orderColumns: ColumnDef<(typeof orderRows)[number]>[] = [
    {
      id: 'number',
      header: 'Order Number',
      className: 'font-mono text-xs font-bold text-foreground',
      cell: ({ row: { po, orderDate } }) => (
        <>
          <div className="flex items-center gap-1.5">
            <Package className="size-3.5 text-primary" />
            <span>{po.orderNumber}</span>
          </div>
          <span className="text-[10px] text-muted-foreground font-sans block mt-0.5">
            {orderDate}
          </span>
        </>
      ),
    },
    {
      id: 'supplier',
      header: 'Supplier',
      className: 'text-xs font-semibold text-foreground',
      cell: ({ row: { po, supplierName } }) => (
        <>
          <div>{supplierName}</div>
          {po.externalReference && (
            <div className="text-[10px] text-muted-foreground font-normal">
              Ref: {po.externalReference}
            </div>
          )}
        </>
      ),
    },
    {
      id: 'items',
      header: 'Ordered Materials',
      className: 'text-xs text-foreground/90 max-w-[240px] truncate',
      cell: ({ row: { itemSummary } }) => (
        <>
          <span title={itemSummary}>{itemSummary || 'No items listed'}</span>
        </>
      ),
    },
    {
      id: 'date',
      header: 'Expected Date',
      className: 'text-xs text-muted-foreground',
      cell: ({ row: { expectedDate } }) => <>{expectedDate}</>,
    },
    {
      id: 'total',
      header: 'Total Amount',
      align: 'right',
      className: 'text-xs font-bold text-foreground text-right font-mono',
      cell: ({ row: { total } }) => (
        <>₱{total.toLocaleString('en-US', { minimumFractionDigits: 2 })}</>
      ),
    },
    {
      id: 'status',
      header: 'Status',
      align: 'center',
      className: 'text-center',
      cell: ({ row: { po } }) => <>{renderStatusBadge(po.status)}</>,
    },
    {
      id: 'actions',
      header: 'Actions',
      align: 'right',
      className: 'text-right',
      cell: ({ row: { po } }) => (
        <>
          <div className="flex items-center justify-end gap-1">
            <Button
              variant="ghost"
              size="icon"
              aria-label={`View purchase order ${po.orderNumber}`}
              title="View Purchase Order"
              onClick={() => setSelectedOrderId(po.id)}
            >
              <Eye data-icon="inline-start" />
            </Button>
            {po.status === 'DRAFT' && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 px-2 text-[11px] text-emerald-600 border-emerald-500/30 hover:bg-emerald-500/10"
                  onClick={() => confirmPOMutation.mutate(po.id)}
                  disabled={confirmPOMutation.isPending}
                  title="Confirm Purchase Order"
                >
                  <Check className="size-3 mr-1" />
                  Confirm
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-[11px] text-rose-600 hover:bg-rose-500/10"
                  onClick={() => cancelPOMutation.mutate(po.id)}
                  disabled={cancelPOMutation.isPending}
                  title="Cancel Purchase Order"
                >
                  <X className="size-3 mr-1" />
                  Cancel
                </Button>
              </>
            )}
            {po.status === 'CONFIRMED' && (
              <div className="flex items-center justify-end gap-1.5">
                {onNavigateToDeliveries ? (
                  <button
                    type="button"
                    onClick={() => onNavigateToDeliveries(po.id)}
                    className="group inline-flex items-center gap-1 rounded-md border border-border/80 bg-muted/40 px-2 py-1 text-[10px] font-medium text-muted-foreground hover:text-foreground hover:bg-muted/70 transition-colors"
                    title="Go to Deliveries → Incoming to schedule and receive materials"
                  >
                    <ArrowDownToLine className="size-3 text-primary group-hover:translate-y-0.5 transition-transform" />
                    <span>Incoming Deliveries</span>
                    <ChevronRight className="size-2.5 opacity-60" />
                  </button>
                ) : (
                  <span
                    className="inline-flex items-center gap-1 rounded-md border border-border/80 bg-muted/40 px-2 py-1 text-[10px] font-medium text-muted-foreground"
                    title="Receive materials via Deliveries → Incoming"
                  >
                    <ArrowDownToLine className="size-3 text-primary" />
                    <span>Incoming Deliveries</span>
                  </span>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-[11px] text-rose-600 hover:bg-rose-500/10"
                  onClick={() => cancelPOMutation.mutate(po.id)}
                  disabled={cancelPOMutation.isPending}
                  title="Cancel Purchase Order"
                >
                  <X className="size-3 mr-1" />
                  Cancel
                </Button>
              </div>
            )}
            {po.status === 'PARTIALLY_RECEIVED' && (
              <div className="flex items-center justify-end">
                {onNavigateToDeliveries ? (
                  <button
                    type="button"
                    onClick={() => onNavigateToDeliveries(po.id)}
                    className="group inline-flex items-center gap-1 rounded-md border border-border/80 bg-muted/40 px-2 py-1 text-[10px] font-medium text-muted-foreground hover:text-foreground hover:bg-muted/70 transition-colors"
                    title="Go to Deliveries → Incoming to receive remaining cargo"
                  >
                    <ArrowDownToLine className="size-3 text-indigo-500 group-hover:translate-y-0.5 transition-transform" />
                    <span>View Incoming</span>
                    <ChevronRight className="size-2.5 opacity-60" />
                  </button>
                ) : (
                  <span
                    className="inline-flex items-center gap-1 rounded-md border border-border/80 bg-muted/40 px-2 py-1 text-[10px] font-medium text-muted-foreground"
                    title="Receive remaining materials via Deliveries → Incoming"
                  >
                    <ArrowDownToLine className="size-3 text-indigo-500" />
                    <span>View Incoming</span>
                  </span>
                )}
              </div>
            )}
          </div>
        </>
      ),
    },
  ]

  const supplierColumns: ColumnDef<Supplier>[] = [
    {
      id: 'supplier-0',
      header: 'Code',
      className: 'font-mono text-xs font-bold text-foreground',
      cell: ({ row: supplier }) => <>{supplier.code}</>,
    },
    {
      id: 'supplier-1',
      header: 'Company Name',
      className: 'text-xs font-semibold text-foreground',
      cell: ({ row: supplier }) => <>{supplier.name}</>,
    },
    {
      id: 'supplier-2',
      header: 'Contact Person',
      className: 'text-xs text-foreground/90',
      cell: ({ row: supplier }) => <>{supplier.contactPerson || '—'}</>,
    },
    {
      id: 'supplier-3',
      header: 'Phone & Email',
      className: 'text-xs text-muted-foreground',
      cell: ({ row: supplier }) => (
        <>
          <div>{supplier.phone || '—'}</div>
          {supplier.email && <div className="text-[10px] text-primary">{supplier.email}</div>}
        </>
      ),
    },
    {
      id: 'supplier-4',
      header: 'Address',
      className: 'text-xs text-muted-foreground max-w-[200px] truncate',
      cell: ({ row: supplier }) => (
        <>
          <span title={supplier.address || ''}>{supplier.address || '—'}</span>
        </>
      ),
    },
    {
      id: 'supplier-5',
      header: 'Status',
      align: 'center',
      className: 'text-center',
      cell: ({ row: supplier }) => (
        <DirectoryStatusBadge isActive={supplier.isActive !== false} inactiveLabel="Archived" />
      ),
    },
    {
      id: 'supplier-6',
      header: 'Actions',
      align: 'right',
      className: 'w-px whitespace-nowrap text-right',
      headerClassName: 'w-px whitespace-nowrap',
      cell: ({ row: supplier }) => (
        <DataTableActions
          onEdit={
            supplier.isActive !== false
              ? () => {
                  setSelectedSupplier(supplier)
                  setIsSupplierModalOpen(true)
                }
              : undefined
          }
          onArchive={supplier.isActive !== false ? () => setSupplierToArchive(supplier) : undefined}
          onRestore={
            supplier.isActive === false
              ? () => reactivateSupplierMutation.mutate(supplier.id)
              : undefined
          }
          restoreLabel="Restore"
          isPending={deleteSupplierMutation.isPending || reactivateSupplierMutation.isPending}
        />
      ),
    },
  ]

  return (
    <div className="flex flex-col gap-5">
      {section === 'orders' ? (
        <div className="flex flex-col gap-5">
          <StatusTabNav
            activeTab={activeStatus}
            onTabChange={(tab) => setActiveStatus(tab as PurchaseTabFilter)}
            tabs={[
              {
                value: 'Active',
                label: 'Active Orders',
                count: statusCount('Active'),
                icon: <Clock className="size-3.5" />,
                accent: 'green',
              },
              {
                value: 'Completed',
                label: 'Received Orders',
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

          {activeStatus === 'Active' && (
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 rounded-xl border border-primary/20 bg-primary/5 px-3.5 py-2.5 text-xs text-muted-foreground">
              <div className="flex items-center gap-2">
                <Info className="size-4 text-primary shrink-0" />
                <span>
                  Delivered shipments are scheduled and received in{' '}
                  <strong className="text-foreground font-semibold">Deliveries → Incoming</strong>.
                </span>
              </div>
              {onNavigateToDeliveries && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => onNavigateToDeliveries()}
                  className="h-7 text-xs font-semibold gap-1 px-2.5 shrink-0 bg-background hover:bg-muted"
                >
                  Go to Incoming Deliveries
                  <ChevronRight className="size-3.5" />
                </Button>
              )}
            </div>
          )}

          <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
            <div className="relative w-full sm:w-80">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search order number, supplier, reference..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 h-9 text-xs"
              />
            </div>

            <Button
              size="sm"
              onClick={() => setIsPurchaseModalOpen(true)}
              disabled={!suppliers.some((supplier) => supplier.isActive)}
            >
              <Plus className="size-4" />
              Create Purchase Order
            </Button>
          </div>

          {isLoadingPOs ? (
            <Card className="flex min-h-[300px] items-center justify-center p-8">
              <div className="flex flex-col items-center gap-2">
                <Clock className="size-6 animate-spin text-primary" />
                <p className="text-xs text-muted-foreground">Loading purchase orders...</p>
              </div>
            </Card>
          ) : filteredOrders.length === 0 ? (
            <Card className="flex min-h-[340px] items-center justify-center border-dashed bg-muted/20 shadow-xs">
              <div className="flex flex-col items-center justify-center text-center">
                <Package className="size-8 text-muted-foreground/40 mb-2" />
                <span className="text-sm font-semibold text-foreground">
                  {searchTerm.trim()
                    ? `No purchase orders match "${searchTerm.trim()}"`
                    : `No ${activeStatus.toLowerCase()} purchase orders found`}
                </span>
                <p className="text-xs text-muted-foreground mt-1 max-w-xs">
                  {searchTerm.trim()
                    ? 'Try a different order number or supplier name.'
                    : activeStatus === 'Active'
                      ? 'Issue purchase orders to suppliers for stock replenishment.'
                      : 'Purchase orders moved into this status will appear here.'}
                </p>
              </div>
            </Card>
          ) : (
            <DataTable
              data={orderRows}
              columns={orderColumns}
              getRowKey={({ po }) => po.id}
              pagination={false}
            />
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          <ArchiveTabNav
            activeTab={supplierView}
            onTabChange={setSupplierView}
            activeLabel="Active Suppliers"
            activeCount={activeSuppliers.length}
            archivedLabel="Archived Suppliers"
            archivedCount={archivedSuppliers.length}
            activeIcon={<Building2 className="size-3.5" />}
            bannerDescription="Archived suppliers remain in past purchase orders and receiving records. Restore them to use them in new orders."
          />
          <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
            <div className="relative w-full sm:w-80">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                aria-label="Search suppliers"
                placeholder="Search suppliers..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 h-9 text-xs"
              />
            </div>

            <Button
              size="sm"
              onClick={() => {
                setSelectedSupplier(null)
                setIsSupplierModalOpen(true)
              }}
            >
              <Plus className="size-4" />
              Add Supplier
            </Button>
          </div>

          <DataTable
            data={filteredSuppliers}
            columns={supplierColumns}
            getRowKey={(supplier) => supplier.id}
            isLoading={isLoadingSuppliers}
            loadingMessage="Loading supplier directory..."
            pagination={false}
            emptyContent={
              <Card className="flex min-h-[340px] items-center justify-center border-dashed bg-muted/20 shadow-xs">
                <div className="flex flex-col items-center justify-center text-center">
                  <Building2 className="size-8 text-muted-foreground/40 mb-2" />
                  <span className="text-sm font-semibold text-foreground">
                    {searchTerm.trim()
                      ? `No suppliers match "${searchTerm.trim()}"`
                      : supplierView === 'ACTIVE'
                        ? 'No active suppliers found'
                        : 'No archived suppliers found'}
                  </span>
                  <p className="text-xs text-muted-foreground mt-1 max-w-xs">
                    {supplierView === 'ACTIVE'
                      ? 'Register suppliers to begin purchasing stock materials.'
                      : 'Archived suppliers will appear here and can be restored.'}
                  </p>
                </div>
              </Card>
            }
          />
        </div>
      )}

      {selectedOrder && (
        <PurchaseOrderDetailModal
          order={selectedOrder}
          supplier={supplierMap.get(selectedOrder.supplierId)}
          products={products}
          warehouses={warehouses}
          incomingDeliveries={incomingDeliveries}
          statusBadge={renderStatusBadge(selectedOrder.status)}
          onClose={() => setSelectedOrderId(null)}
          onNavigateToDeliveries={onNavigateToDeliveries}
        />
      )}

      {isPurchaseModalOpen && (
        <PurchaseModal
          open
          onClose={() => setIsPurchaseModalOpen(false)}
          onSubmit={handleCreatePO}
          suppliers={suppliers}
          products={products}
          processedBy={processedBy}
        />
      )}

      {isSupplierModalOpen && (
        <SupplierModal
          open
          onClose={() => {
            setIsSupplierModalOpen(false)
            setSelectedSupplier(null)
          }}
          onSubmit={handleSaveSupplier}
          supplier={selectedSupplier}
          isSubmitting={createSupplierMutation.isPending || updateSupplierMutation.isPending}
        />
      )}
      <ConfirmDeleteModal
        open={supplierToArchive !== null}
        onClose={() => setSupplierToArchive(null)}
        onConfirm={async () => {
          if (supplierToArchive) await deleteSupplierMutation.mutateAsync(supplierToArchive.id)
        }}
        title="Archive Supplier?"
        description="This supplier will be moved to Archived Suppliers. Historical purchase orders, delivery records, and receiving history will not be deleted."
        itemName={supplierToArchive?.name}
        confirmText="Archive Supplier"
        icon={<Archive className="size-6" />}
        variant="warning"
      />
    </div>
  )
}
