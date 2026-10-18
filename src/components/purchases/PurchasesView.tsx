import { PageHeader, PageToolbar } from '@/components/ui/ManagementPage'
import { toast } from 'sonner'
import { useState, useMemo } from 'react'
import {
  Archive,
  Building2,
  Check,
  CheckCircle2,
  Clock,
  Eye,
  MoreHorizontal,
  Package,
  Plus,
  Search,
  XCircle,
} from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { ArchiveTabNav } from '@/components/ui/ArchiveTabNav'
import { StatusTabNav } from '@/components/ui/StatusTabNav'
import { ConfirmDeleteModal } from '@/components/ui/ConfirmDeleteModal'
import type { PurchaseOrderRecord } from '@/features/logistics/purchase-orders.types'
import { PurchaseModal } from './PurchaseModal'
import { PurchaseOrderDetailModal } from './PurchaseOrderDetailModal'
import { SupplierModal } from './SupplierModal'
import { useAuth } from '@/features/auth/AuthContext'
import { useProducts } from '@/features/products/products.hooks'
import { useStockItems } from '@/features/logistics/stock-items.hooks'
import { getErrorMessage } from '@/lib/api-client'
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
import { OverflowValue } from '@/components/ui/OverflowValue'
import { DataTableActions } from '@/components/ui/DataTableActions'
import { cn } from '@/lib/utils'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

export type PurchaseTabFilter = 'Active' | 'Completed' | 'Cancelled'

export type PurchaseSection = 'orders' | 'suppliers'

type PurchasesViewProps = {
  section?: PurchaseSection
  onNavigateToDeliveries?: (purchaseOrderId?: number, arrange?: boolean) => void
}

const purchaseStatusBadgeClassNames: Record<PurchaseOrderRecord['status'], string> = {
  DRAFT: 'border-border/70! bg-muted/20 text-muted-foreground',
  CONFIRMED: 'border-status-info-foreground/15! bg-status-info text-status-info-foreground',
  PARTIALLY_RECEIVED:
    'border-status-warning-foreground/15! bg-status-warning text-status-warning-foreground',
  RECEIVED: 'border-status-success-foreground/15! bg-status-success text-status-success-foreground',
  CANCELLED: 'border-destructive/15! bg-destructive/5 text-destructive',
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
  const [orderToCancel, setOrderToCancel] = useState<PurchaseOrderRecord | null>(null)

  const { user, isAdmin, isManager } = useAuth()
  const canManage = isAdmin || isManager
  const processedBy = user?.fullName || user?.email || 'Current User'

  // Data queries
  const ordersQuery = usePurchaseOrders()
  const { data: purchaseOrders = [], isLoading: isLoadingPOs } = ordersQuery
  const suppliersQuery = useSuppliers({
    includeInactive: 'true',
  })
  const { data: suppliers = [], isLoading: isLoadingSuppliers } = suppliersQuery
  const stockQuery = useStockItems()
  const { data: stockItems = [] } = stockQuery
  const productsQuery = useProducts()
  const { data: products = [] } = productsQuery
  const { data: warehouses = [] } = useWarehouses()
  const { data: incomingDeliveries = [] } = useIncomingDeliveries()
  const selectedOrder = purchaseOrders.find((order) => order.id === selectedOrderId)

  // Mutations
  const createPOMutation = useCreatePurchaseOrder({ notifySuccess: false })
  const confirmPOMutation = useConfirmPurchaseOrder()
  const cancelPOMutation = useCancelPurchaseOrder()

  const createSupplierMutation = useCreateSupplier()
  const updateSupplierMutation = useUpdateSupplier()
  const deleteSupplierMutation = useDeleteSupplier()
  const reactivateSupplierMutation = useReactivateSupplier()

  const confirmPurchaseOrder = async (id: number) => {
    if (!canManage || confirmPOMutation.isPending) return
    try {
      await confirmPOMutation.mutateAsync(id)
      setSelectedOrderId(null)
    } catch {
      /* The mutation shows the API error; retain the order for retry. */
    }
  }

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

  const handleCreatePO = async (
    payload: CreatePurchaseOrderPayload,
    intent: 'draft' | 'confirm' = 'draft',
  ) => {
    const order = await createPOMutation.mutateAsync(payload)
    if (intent === 'draft')
      toast.success('Draft saved', { description: `Purchase order ${order.orderNumber}.` })
    return order
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

  const renderStatusBadge = (status: PurchaseOrderRecord['status']) => {
    const className = cn('whitespace-nowrap px-2', purchaseStatusBadgeClassNames[status])
    switch (status) {
      case 'DRAFT':
        return (
          <Badge variant="outline" className={className}>
            Draft
          </Badge>
        )
      case 'CONFIRMED':
        return (
          <Badge variant="outline" className={className}>
            Confirmed
          </Badge>
        )
      case 'PARTIALLY_RECEIVED':
        return (
          <Badge variant="outline" className={className}>
            Partially Received
          </Badge>
        )
      case 'RECEIVED':
        return (
          <Badge variant="outline" className={className}>
            Received
          </Badge>
        )
      case 'CANCELLED':
        return (
          <Badge variant="outline" className={className}>
            Cancelled
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

    const expectedDate = po.expectedAt
      ? new Date(po.expectedAt).toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
        })
      : 'Not set'

    return { po, supplierName, total, itemSummary, expectedDate }
  })

  const orderColumns: ColumnDef<(typeof orderRows)[number]>[] = [
    {
      id: 'number',
      header: 'Order',
      width: 145,
      className: 'min-w-[145px]',
      cell: ({ row: { po } }) => (
        <span className="whitespace-nowrap text-sm font-medium text-foreground">
          {po.orderNumber}
        </span>
      ),
    },
    {
      id: 'supplier',
      header: 'Supplier',
      width: 190,
      className: 'min-w-[160px] max-w-[230px]',
      cell: ({ row: { po, supplierName } }) => (
        <div className="flex min-w-0 flex-col gap-1">
          <span className="truncate text-sm font-medium text-foreground" title={supplierName}>
            {supplierName}
          </span>
          {po.externalReference && (
            <span className="truncate text-xs text-muted-foreground" title={po.externalReference}>
              Ref: {po.externalReference}
            </span>
          )}
        </div>
      ),
    },
    {
      id: 'items',
      header: 'Items',
      width: 190,
      className: 'max-w-[240px]',
      cell: ({ row: { po, itemSummary } }) =>
        (po.items?.length ?? 0) > 1 ? (
          <OverflowValue
            value={`${po.items?.length ?? 0} items`}
            fullValue={itemSummary}
            showFullValueOnHover
            className="text-foreground"
          />
        ) : (
          <span className="block truncate text-foreground" title={itemSummary}>
            {itemSummary || 'No items listed'}
          </span>
        ),
    },
    {
      id: 'date',
      header: 'Expected Date',
      width: 135,
      className: 'whitespace-nowrap tabular-nums text-foreground',
      cell: ({ row: { expectedDate } }) => expectedDate,
    },
    {
      id: 'total',
      header: 'Total',
      width: 115,
      align: 'right',
      className: 'whitespace-nowrap tabular-nums text-foreground',
      cell: ({ row: { total } }) => (
        <>₱{total.toLocaleString('en-US', { minimumFractionDigits: 2 })}</>
      ),
    },
    {
      id: 'status',
      header: 'Status',
      width: 155,
      className: 'whitespace-nowrap',
      cell: ({ row: { po } }) => <>{renderStatusBadge(po.status)}</>,
    },
    {
      id: 'actions',
      header: 'Actions',
      width: 190,
      align: 'right',
      className: 'whitespace-nowrap',
      cell: ({ row: { po } }) => (
        <div
          className="flex items-center justify-end gap-1"
          onClick={(event) => event.stopPropagation()}
        >
          {po.status === 'DRAFT' && canManage && (
            <Button
              type="button"
              size="sm"
              className="pointer-coarse:min-h-11"
              disabled={confirmPOMutation.isPending}
              onClick={() => void confirmPurchaseOrder(po.id)}
              title="Confirm Purchase Order"
            >
              <Check aria-hidden="true" data-icon="inline-start" />
              Confirm
            </Button>
          )}
          {['CONFIRMED', 'PARTIALLY_RECEIVED'].includes(po.status) && onNavigateToDeliveries && (
            <Button
              type="button"
              size="sm"
              className="pointer-coarse:min-h-11"
              onClick={() => onNavigateToDeliveries(po.id)}
              title="Open Incoming Deliveries for this purchase order"
            >
              Incoming Deliveries
            </Button>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-8 text-muted-foreground pointer-coarse:size-11"
                aria-label={`More actions for ${po.orderNumber}`}
                title="More actions"
              >
                <MoreHorizontal aria-hidden="true" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuGroup>
                <DropdownMenuItem onSelect={() => setSelectedOrderId(po.id)}>
                  <Eye aria-hidden="true" className="mr-2 size-3.5" />
                  View Order
                </DropdownMenuItem>
                {canManage && ['DRAFT', 'CONFIRMED'].includes(po.status) && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      disabled={cancelPOMutation.isPending}
                      onSelect={() => setOrderToCancel(po)}
                      className="text-destructive focus:text-destructive"
                    >
                      Cancel Order
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ),
    },
  ]

  const supplierColumns: ColumnDef<Supplier>[] = [
    {
      id: 'supplier-0',
      header: 'Code',
      width: '12%',
      sortable: true,
      sortKey: 'code',
      className: 'text-sm font-medium text-foreground',
      cell: ({ row: supplier }) => <>{supplier.code}</>,
    },
    {
      id: 'supplier-1',
      header: 'Company Name',
      width: '22%',
      sortable: true,
      sortKey: 'name',
      className: 'text-sm font-medium text-foreground',
      cell: ({ row: supplier }) => <OverflowValue value={supplier.name} />,
    },
    {
      id: 'supplier-2',
      header: 'Contact Person',
      width: '15%',
      sortable: true,
      sortKey: (supplier) => supplier.contactPerson || '',
      className: 'text-sm text-foreground',
      cell: ({ row: supplier }) => <>{supplier.contactPerson || '—'}</>,
    },
    {
      id: 'supplier-3',
      header: 'Phone & Email',
      width: '23%',
      className: 'text-sm text-foreground',
      cell: ({ row: supplier }) => (
        <>
          <OverflowValue value={supplier.phone} />
          {supplier.email && (
            <OverflowValue value={supplier.email} className="text-xs text-muted-foreground" />
          )}
        </>
      ),
    },
    {
      id: 'supplier-4',
      header: 'Address',
      width: '20%',
      sortable: true,
      sortKey: (supplier) => supplier.address || '',
      className: 'text-sm text-foreground max-w-[280px]',
      cell: ({ row: supplier }) => <OverflowValue value={supplier.address} />,
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
    <div className="flex min-w-0 flex-col gap-4">
      {section === 'orders' ? (
        <div className="flex flex-col gap-4">
          <PageHeader description="Manage supplier orders and track stock receiving.">
            Purchase Orders
          </PageHeader>
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

          <PageToolbar>
            <div className="relative w-full sm:w-80">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                aria-label="Search purchase orders"
                placeholder="Search order number, supplier, reference..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 h-9 text-ui"
              />
            </div>

            <Button
              size="sm"
              onClick={() => setIsPurchaseModalOpen(true)}
              disabled={!canManage || !suppliers.some((supplier) => supplier.isActive)}
            >
              <Plus className="size-4" />
              Create Purchase Order
            </Button>
          </PageToolbar>

          {ordersQuery.isError ? (
            <Alert variant="destructive">
              <AlertDescription>
                Purchase orders could not be loaded. {getErrorMessage(ordersQuery.error)}
                <Button
                  variant="outline"
                  size="sm"
                  className="ml-2"
                  onClick={() => void ordersQuery.refetch()}
                  disabled={ordersQuery.isFetching}
                >
                  Retry
                </Button>
              </AlertDescription>
            </Alert>
          ) : isLoadingPOs ? (
            <Card className="flex min-h-[300px] items-center justify-center p-8">
              <div className="flex flex-col items-center gap-2">
                <Clock className="size-6 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">Loading purchase orders...</p>
              </div>
            </Card>
          ) : filteredOrders.length === 0 ? (
            <Card className="flex min-h-[340px] items-center justify-center border-border bg-card shadow-none">
              <div className="flex flex-col items-center justify-center text-center">
                <Package className="size-8 text-muted-foreground mb-2" />
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
              appearance="management"
              data={orderRows}
              columns={orderColumns}
              getRowKey={({ po }) => po.id}
              pageSize={10}
              pageSizeOptions={[10, 25, 50, 100]}
              tableClassName="table-fixed min-w-[1040px] xl:min-w-[1120px]"
            />
          )}
        </div>
      ) : (
        <div className="flex min-w-0 flex-col gap-4">
          <PageHeader description="Manage supplier details and purchasing contacts.">
            Suppliers
          </PageHeader>
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
          <PageToolbar>
            <div className="relative w-full sm:w-80">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                aria-label="Search suppliers"
                placeholder="Search suppliers..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 h-9 text-ui"
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
          </PageToolbar>

          {suppliersQuery.isError ? (
            <Alert variant="destructive">
              <AlertDescription>
                Suppliers could not be loaded. {getErrorMessage(suppliersQuery.error)}
                <Button
                  variant="outline"
                  size="sm"
                  className="ml-2"
                  onClick={() => void suppliersQuery.refetch()}
                  disabled={suppliersQuery.isFetching}
                >
                  Retry
                </Button>
              </AlertDescription>
            </Alert>
          ) : (
            <DataTable
              appearance="management"
              data={filteredSuppliers}
              columns={supplierColumns}
              getRowKey={(supplier) => supplier.id}
              isLoading={isLoadingSuppliers}
              loadingMessage="Loading supplier directory..."
              tableClassName="min-w-[800px]"
              pageSizeOptions={[10, 25, 50, 100]}
              emptyContent={
                <div className="flex min-h-64 items-center justify-center px-4 py-12">
                  <div className="flex flex-col items-center justify-center text-center">
                    <Building2 className="size-8 text-muted-foreground mb-2" />
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
                </div>
              }
            />
          )}
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
          onConfirm={canManage ? () => void confirmPurchaseOrder(selectedOrder.id) : undefined}
          confirming={confirmPOMutation.isPending}
        />
      )}

      {isPurchaseModalOpen && canManage && (
        <PurchaseModal
          open
          onClose={() => setIsPurchaseModalOpen(false)}
          onSubmit={handleCreatePO}
          onConfirm={(id) => confirmPOMutation.mutateAsync(id)}
          suppliers={suppliers}
          products={products}
          stockItems={stockItems}
          catalogState={{
            productsLoading: productsQuery.isLoading,
            stockLoading: stockQuery.isLoading,
            productsError: productsQuery.error ? getErrorMessage(productsQuery.error) : undefined,
            stockError: stockQuery.error ? getErrorMessage(stockQuery.error) : undefined,
            onRetry: () => {
              void productsQuery.refetch()
              void stockQuery.refetch()
            },
          }}
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
        key={orderToCancel?.id ?? 'cancel-order'}
        open={!!orderToCancel}
        onClose={() => setOrderToCancel(null)}
        onConfirm={async () => {
          if (orderToCancel && canManage) await cancelPOMutation.mutateAsync(orderToCancel.id)
        }}
        title="Cancel Purchase Order"
        description="Cancel this order if it has no stock movements. Physical stock is unchanged."
        itemName={orderToCancel?.orderNumber}
        confirmText="Cancel Order"
      />
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
