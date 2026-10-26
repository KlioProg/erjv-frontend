import { PageHeader, PageToolbar } from '@/components/ui/ManagementPage'
import { toast } from 'sonner'
import { useState, useMemo, useRef, type MouseEvent } from 'react'
import { formatPurchaseMoney, storedPurchaseTotal } from '@/features/logistics/purchase-pricing'
import {
  Archive,
  Building2,
  Check,
  CheckCircle2,
  Clock,
  Download,
  Eye,
  MoreHorizontal,
  Package,
  Pencil,
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
  useUpdatePurchaseOrderDraft,
} from '@/features/logistics/purchase-orders.hooks'
import {
  useSuppliers,
  useCreateSupplier,
  useUpdateSupplier,
  useDeleteSupplier,
  useReactivateSupplier,
} from '@/features/logistics/suppliers.hooks'
import type { CreateSupplierPayload, Supplier } from '@/features/logistics/suppliers.types'
import type { CreatePurchaseOrderPayload } from '@/features/logistics/purchase-orders.types'
import { useWarehouses } from '@/features/logistics/warehouses.hooks'
import { useIncomingDeliveries } from '@/features/logistics/incoming-deliveries.hooks'
import { DataTable, type ColumnDef } from '@/components/ui/data-table'
import { OverflowValue } from '@/components/ui/OverflowValue'
import { DataTableActions } from '@/components/ui/DataTableActions'
import { cn } from '@/lib/utils'
import { exportPurchaseReceiptPdf } from '@/lib/purchase-receipt'
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
  const [editingOrderId, setEditingOrderId] = useState<number | null>(null)
  const [orderToCancel, setOrderToCancel] = useState<PurchaseOrderRecord | null>(null)

  const { user, isAdmin, isManager } = useAuth()
  const canManage = isAdmin || isManager
  const canConfirmPurchaseOrder = isAdmin
  const confirmationLock = useRef(false)
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
  const incomingQuery = useIncomingDeliveries()
  const { data: incomingDeliveries = [] } = incomingQuery
  const selectedOrder = purchaseOrders.find((order) => order.id === selectedOrderId)
  const editingOrder = purchaseOrders.find(
    (order) => order.id === editingOrderId && order.status === 'DRAFT',
  )

  // Mutations
  const createPOMutation = useCreatePurchaseOrder({ notifySuccess: false })
  const updatePOMutation = useUpdatePurchaseOrderDraft()
  const confirmPOMutation = useConfirmPurchaseOrder()
  const cancelPOMutation = useCancelPurchaseOrder()

  const createSupplierMutation = useCreateSupplier()
  const updateSupplierMutation = useUpdateSupplier()
  const deleteSupplierMutation = useDeleteSupplier()
  const reactivateSupplierMutation = useReactivateSupplier()

  const supplierMap = useMemo(() => new Map(suppliers.map((s) => [s.id, s])), [suppliers])

  const confirmPurchaseOrder = async (id: number): Promise<PurchaseOrderRecord> => {
    if (!canConfirmPurchaseOrder || confirmationLock.current)
      throw new Error('Purchase order confirmation is unavailable.')
    confirmationLock.current = true
    try {
      const confirmedOrder = await confirmPOMutation.mutateAsync(id)
      if (confirmedOrder.id !== id || confirmedOrder.status !== 'CONFIRMED')
        throw new Error('The server did not confirm this purchase order. Refresh and review its status.')
      const supplier =
        confirmedOrder.supplierId == null ? undefined : supplierMap.get(confirmedOrder.supplierId)
      if (!exportPurchaseReceiptPdf(confirmedOrder, supplier, products)) {
        toast.error('Purchase confirmed, but the receipt window could not be opened.')
      }
      setSelectedOrderId(null)
      return confirmedOrder
    } finally {
      confirmationLock.current = false
    }
  }

  const exportPurchaseReceipt = (id: number) => {
    const order = purchaseOrders.find((candidate) => candidate.id === id)
    if (!order) {
      toast.error('Purchase order could not be found. Refresh the list and try again.')
      return
    }
    const supplier = order.supplierId == null ? undefined : supplierMap.get(order.supplierId)
    if (!exportPurchaseReceiptPdf(order, supplier, products)) {
      toast.error('The receipt window could not be opened. Allow pop-ups and try again.')
    }
  }

  const productMap = useMemo(() => {
    return new Map(products.map((p) => [p.id, p]))
  }, [products])

  const handleOrderRowClick = (
    row: (typeof orderRows)[number],
    _index: number,
    event: MouseEvent<HTMLTableRowElement>,
  ) => {
    if (window.getSelection()?.toString()) return
    if (event.target instanceof Element && event.target.closest('button, a, [role="menuitem"]'))
      return
    setSelectedOrderId(row.po.id)
  }

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
      const supplier = po.supplierId == null ? undefined : supplierMap.get(po.supplierId)
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
        String(s.name ?? '').toLowerCase().includes(q) ||
        String(s.code ?? '').toLowerCase().includes(q) ||
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

  const handleUpdateDraft = async (id: number, payload: CreatePurchaseOrderPayload) =>
    updatePOMutation.mutateAsync({ id, payload })

  const handleSaveSupplier = async (values: CreateSupplierPayload) => {
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
    const supplier = po.supplierId == null ? undefined : supplierMap.get(po.supplierId)
    const supplierName =
      supplier?.name ||
      (po.supplierId == null ? 'No supplier assigned' : `Supplier #${po.supplierId}`)
    const total = storedPurchaseTotal(po.items || [])

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
      width: 240,
      className: 'min-w-[160px] max-w-[230px]',
      cell: ({ row: { po, supplierName } }) => (
        <div className="flex min-w-0 flex-col gap-1">
          <OverflowValue value={supplierName} className="text-sm font-medium text-foreground" />
          {po.externalReference && (
            <OverflowValue value={`Ref: ${po.externalReference}`} className="text-xs text-muted-foreground" />
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
          <OverflowValue value={itemSummary || 'No items listed'} className="text-foreground" />
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
        <>{formatPurchaseMoney(total)}</>
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
          {po.status === 'DRAFT' && canConfirmPurchaseOrder && (
            <Button
              type="button"
              size="sm"
              className="pointer-coarse:min-h-11"
              disabled={confirmPOMutation.isPending}
              onClick={() => { void confirmPurchaseOrder(po.id).catch(() => { /* Mutation reports the error. */ }) }}
              title="Confirm and Export Receipt"
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
                {canManage && po.status === 'DRAFT' && (
                  <DropdownMenuItem
                    onSelect={() => {
                      setSelectedOrderId(null)
                      setEditingOrderId(po.id)
                    }}
                  >
                    <Pencil aria-hidden="true" className="mr-2 size-3.5" />
                    Edit Draft
                  </DropdownMenuItem>
                )}
                {po.status !== 'DRAFT' && po.status !== 'CANCELLED' && (
                  <DropdownMenuItem onSelect={() => exportPurchaseReceipt(po.id)}>
                    <Download aria-hidden="true" className="mr-2 size-3.5" />
                    Export Receipt
                  </DropdownMenuItem>
                )}
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
                  {ordersQuery.isFetching ? 'Retrying...' : 'Retry'}
                </Button>
              </AlertDescription>
            </Alert>
          ) : isLoadingPOs ? (
            <DataTable
              appearance="management"
              data={orderRows}
              columns={orderColumns}
              getRowKey={({ po }) => po.id}
              onRowClick={handleOrderRowClick}
              isLoading
              loadingMessage="Loading purchase orders..."
              pageSize={10}
              pageSizeOptions={[10, 25, 50, 100]}
              tableClassName="table-fixed min-w-[1040px] xl:min-w-[1120px]"
            />
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
              onRowClick={handleOrderRowClick}
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
                  {suppliersQuery.isFetching ? 'Retrying...' : 'Retry'}
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
          supplier={
            selectedOrder.supplierId == null ? undefined : supplierMap.get(selectedOrder.supplierId)
          }
          products={products}
          warehouses={warehouses}
          incomingDeliveries={incomingDeliveries}
          receivingLoading={incomingQuery.isLoading}
          receivingUnavailable={incomingQuery.isError}
          onRetryReceiving={() => void incomingQuery.refetch()}
          statusBadge={renderStatusBadge(selectedOrder.status)}
          onClose={() => setSelectedOrderId(null)}
          onNavigateToDeliveries={onNavigateToDeliveries}
          onConfirm={
            canConfirmPurchaseOrder ? () => confirmPurchaseOrder(selectedOrder.id) : undefined
          }
          onExportReceipt={
            selectedOrder.status !== 'DRAFT' && selectedOrder.status !== 'CANCELLED'
              ? () => exportPurchaseReceipt(selectedOrder.id)
              : undefined
          }
          confirming={confirmPOMutation.isPending}
        />
      )}

      {(isPurchaseModalOpen || editingOrder) && canManage && (
        <PurchaseModal
          key={editingOrder?.id ?? 'new-purchase-order'}
          open
          onClose={() => {
            setIsPurchaseModalOpen(false)
            setEditingOrderId(null)
          }}
          onSubmit={handleCreatePO}
          onUpdateDraft={editingOrder ? handleUpdateDraft : undefined}
          onConfirm={canConfirmPurchaseOrder ? confirmPurchaseOrder : undefined}
          suppliers={suppliers}
          products={products}
          stockItems={stockItems}
          draftOrder={editingOrder}
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
