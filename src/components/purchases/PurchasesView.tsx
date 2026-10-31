import { fetchProductByIdApi } from '@/features/products/products.api'
import type { InventoryItemResponse } from '@/features/products/products.types'
import type { Warehouse } from '@/features/logistics/warehouses.types'
import { useRecordsById } from '@/lib/use-records-by-id'
import { fetchIncomingDeliveriesApi } from '@/features/logistics/incoming-deliveries.api'
import { useResourcePage } from '@/lib/use-cursor-page'
import { useQueries, useQuery } from '@tanstack/react-query'
import { fetchSupplierByIdApi } from '@/features/logistics/suppliers.api'
import { CursorPageControls } from '@/components/ui/CursorPageControls'
import { Label } from '@/components/ui/label'
import { PageHeader, PageToolbar } from '@/components/ui/ManagementPage'
import { toast } from 'sonner'
import { useState, useMemo, useRef, type MouseEvent } from 'react'
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
import { useStockItems } from '@/features/logistics/stock-items.hooks'
import { getErrorMessage } from '@/lib/api-client'
import {
  usePurchaseOrdersPage,
  usePurchaseOrderById,
  useCreatePurchaseOrder,
  useConfirmPurchaseOrder,
  useCancelPurchaseOrder,
  useUpdatePurchaseOrderDraft,
} from '@/features/logistics/purchase-orders.hooks'
import { fetchPurchaseOrderByIdApi } from '@/features/logistics/purchase-orders.api'
import {
  useCreateSupplier,
  useUpdateSupplier,
  useDeleteSupplier,
  useReactivateSupplier,
} from '@/features/logistics/suppliers.hooks'
import type { CreateSupplierPayload, Supplier } from '@/features/logistics/suppliers.types'
import type {
  CreatePurchaseOrderPayload,
  UpdatePurchaseOrderDraftPayload,
} from '@/features/logistics/purchase-orders.types'
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
  const [orderedFrom, setOrderedFrom] = useState('')
  const [orderedBefore, setOrderedBefore] = useState('')
  const [activeStatus, setActiveStatus] = useState<PurchaseTabFilter>('Active')
  const [supplierView, setSupplierView] = useState<'ACTIVE' | 'ARCHIVED'>('ACTIVE')

  // Modals state
  const [isPurchaseModalOpen, setIsPurchaseModalOpen] = useState(false)
  const [isSupplierModalOpen, setIsSupplierModalOpen] = useState(false)
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null)
  const [supplierToArchive, setSupplierToArchive] = useState<Supplier | null>(null)
  const [selectedOrderId, setSelectedOrderId] = useState<number | null>(null)
  const [editingOrder, setEditingOrder] = useState<PurchaseOrderRecord | null>(null)
  const [orderToCancel, setOrderToCancel] = useState<PurchaseOrderRecord | null>(null)

  const { user, isAdmin, isManager } = useAuth()
  const canManage = isAdmin || isManager
  const canConfirmPurchaseOrder = isAdmin
  const processedBy = user?.fullName || user?.email || 'Current User'

  // Data queries
  const ordersQuery = usePurchaseOrdersPage({ statuses: activeStatus === 'Active' ? ['DRAFT', 'CONFIRMED', 'PARTIALLY_RECEIVED'] : activeStatus === 'Completed' ? ['RECEIVED'] : ['CANCELLED'], q: searchTerm.trim() || undefined, orderedFrom: orderedFrom ? new Date(orderedFrom).toISOString() : undefined, orderedBefore: orderedBefore ? new Date(orderedBefore).toISOString() : undefined }, section === 'orders')
  const purchaseOrders = ordersQuery.items
  const isLoadingPOs = ordersQuery.isFetching
  const selectedDetail = usePurchaseOrderById(selectedOrderId ?? undefined)
  const suppliersQuery = useResourcePage<Supplier>('/suppliers', {
    includeInactive: supplierView === 'ACTIVE' ? 'false' : 'only',
    q: section === 'suppliers' ? searchTerm.trim() || undefined : undefined,
  }, section === 'suppliers')
  const baseSuppliers = suppliersQuery.items
  const isLoadingSuppliers = suppliersQuery.isFetching
  const stockQuery = useStockItems()
  const { data: stockItems = [] } = stockQuery
  const productsQuery = useRecordsById<InventoryItemResponse>('/inventory-items', [...purchaseOrders, ...[editingOrder, selectedDetail.data].filter((order): order is PurchaseOrderRecord => !!order)].flatMap(order => order.items.map(item => item.inventoryItemId)))
  const { data: products = [] } = productsQuery
  const selectedDeliveries = useQuery({ queryKey: ['incoming-deliveries', 'for-order', selectedOrderId], enabled: !!selectedOrderId, queryFn: ({ signal }) => fetchIncomingDeliveriesApi({ purchaseOrderId: selectedOrderId! }, signal) })
  const incomingDeliveries = selectedDeliveries.data ?? []
  const { data: warehouses } = useRecordsById<Warehouse>('/warehouses', incomingDeliveries.map(delivery => delivery.warehouseId))
  const selectedOrder = selectedDetail.data ?? purchaseOrders.find((order) => order.id === selectedOrderId)

  const pageSuppliers = useQueries({ queries: [...new Set([...purchaseOrders.flatMap((order) => order.supplierId === null ? [] : [order.supplierId]), ...(selectedOrder?.supplierId ? [selectedOrder.supplierId] : [])])].filter((id) => !baseSuppliers.some((supplier) => supplier.id === id)).map((id) => ({ queryKey: ['suppliers', 'id', id], queryFn: () => fetchSupplierByIdApi(id) })) })
  const suppliers = useMemo(() => [...baseSuppliers, ...pageSuppliers.flatMap((query) => query.data ? [query.data] : [])], [baseSuppliers, pageSuppliers])

  // Mutations
  const createPOMutation = useCreatePurchaseOrder({ notifySuccess: false })
  const updatePOMutation = useUpdatePurchaseOrderDraft()
  const confirmPOMutation = useConfirmPurchaseOrder()
  const confirmationInFlight = useRef(false)
  const cancelPOMutation = useCancelPurchaseOrder()

  const createSupplierMutation = useCreateSupplier()
  const updateSupplierMutation = useUpdateSupplier()
  const deleteSupplierMutation = useDeleteSupplier()
  const reactivateSupplierMutation = useReactivateSupplier()

  const supplierMap = useMemo(() => {
    return new Map(suppliers.map((s) => [s.id, s]))
  }, [suppliers])

  const confirmPurchaseOrder = async (id: number, expectedRevision: number): Promise<PurchaseOrderRecord> => {
    if (!canConfirmPurchaseOrder || confirmPOMutation.isPending || confirmationInFlight.current)
      throw new Error('Purchase order confirmation is unavailable.')
    confirmationInFlight.current = true
    try {
      const confirmedOrder = await confirmPOMutation.mutateAsync({ id, expectedRevision })
      setSelectedOrderId(null)
      return confirmedOrder
    } finally {
      confirmationInFlight.current = false
    }
  }

  const exportPurchaseReceipt = async (id: number) => {
    let order = purchaseOrders.find((candidate) => candidate.id === id)
    if (!order) {
      try {
        order = (await fetchPurchaseOrderByIdApi(id)) ?? undefined
      } catch {
        toast.error('Purchase order could not be found. Refresh the list and try again.')
        return
      }
    }
    if (!order) {
      toast.error('Purchase order could not be found. Refresh the list and try again.')
      return
    }
    if (!['CONFIRMED', 'PARTIALLY_RECEIVED', 'RECEIVED'].includes(order.status)) return
    try {
      const supplier = order.supplierId == null ? undefined : supplierMap.get(order.supplierId) ?? await fetchSupplierByIdApi(order.supplierId)
      if (order.supplierId != null && supplier?.id !== order.supplierId)
        throw Error('Supplier details are unavailable. Reload before exporting this purchase order.')
      const documentProducts = await Promise.all([...new Set(order.items.map(item => item.inventoryItemId))].map(async id => {
        const product = products.find(product => product.id === id) ?? await fetchProductByIdApi(id)
        if (product?.id !== id) throw Error('Product details are unavailable. Reload before exporting this purchase order.')
        return product
      }))
      if (!exportPurchaseReceiptPdf(order, supplier ?? undefined, documentProducts))
        toast.error('The purchase order document could not be downloaded. Try again.')
    } catch (error) {
      toast.error(getErrorMessage(error))
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

  const filteredOrders = purchaseOrders

  const filteredSuppliers = suppliersQuery.items

  const handleCreatePO = async (
    payload: CreatePurchaseOrderPayload,
    intent: 'draft' | 'confirm' = 'draft',
  ) => {
    const order = await createPOMutation.mutateAsync(payload)
    if (intent === 'draft')
      toast.success('Draft saved', { description: `Purchase order ${order.orderNumber}.` })
    return order
  }

  const handleUpdateDraft = async (id: number, payload: UpdatePurchaseOrderDraftPayload) =>
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
    const total = (po.items || []).reduce((sum, item) => sum + Number(item.totalAmount), 0)

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
          {po.status === 'DRAFT' && canConfirmPurchaseOrder && (
            <Button
              type="button"
              size="sm"
              className="pointer-coarse:min-h-11"
              disabled={confirmPOMutation.isPending}
              onClick={() => void confirmPurchaseOrder(po.id, po.revision).catch(() => undefined)}
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
            <DropdownMenuContent align="end" className="w-64">
              <DropdownMenuGroup>
                <DropdownMenuItem onSelect={() => setSelectedOrderId(po.id)}>
                  <Eye aria-hidden="true" className="mr-2 size-3.5" />
                  View Order
                </DropdownMenuItem>
                {canManage && po.status === 'DRAFT' && (
                  <DropdownMenuItem
                    onSelect={() => {
                      setSelectedOrderId(null)
                      setEditingOrder(po)
                    }}
                  >
                    <Pencil aria-hidden="true" className="mr-2 size-3.5" />
                    Edit Draft
                  </DropdownMenuItem>
                )}
                {po.status !== 'DRAFT' && po.status !== 'CANCELLED' && (
                  <DropdownMenuItem onSelect={() => exportPurchaseReceipt(po.id)}>
                    <Download aria-hidden="true" className="mr-2 size-3.5" />
                    Print / Download Purchase Order
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
      sortable: false,
      sortKey: 'code',
      className: 'text-sm font-medium text-foreground',
      cell: ({ row: supplier }) => <>{supplier.code}</>,
    },
    {
      id: 'supplier-1',
      header: 'Company Name',
      width: '22%',
      sortable: false,
      sortKey: 'name',
      className: 'text-sm font-medium text-foreground',
      cell: ({ row: supplier }) => <OverflowValue value={supplier.name} />,
    },
    {
      id: 'supplier-2',
      header: 'Contact Person',
      width: '15%',
      sortable: false,
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
      sortable: false,
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
                icon: <Clock className="size-3.5" />,
                accent: 'green',
              },
              {
                value: 'Completed',
                label: 'Received Orders',
                icon: <CheckCircle2 className="size-3.5" />,
                accent: 'blue',
              },
              {
                value: 'Cancelled',
                label: 'Cancelled Orders',
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
              disabled={!canManage}
            >
              <Plus className="size-4" />
              Create Purchase Order
            </Button>
          </PageToolbar>

          <div className="flex flex-wrap gap-3" aria-label="Ordered date filters">
            <div className="space-y-1"><Label htmlFor="po-ordered-from">Ordered from (inclusive)</Label><Input id="po-ordered-from" type="datetime-local" value={orderedFrom} onChange={(event) => setOrderedFrom(event.target.value)} className="h-9 w-auto" /></div>
            <div className="space-y-1"><Label htmlFor="po-ordered-before">Ordered before (exclusive)</Label><Input id="po-ordered-before" type="datetime-local" value={orderedBefore} onChange={(event) => setOrderedBefore(event.target.value)} className="h-9 w-auto" /></div>
          </div>
          {ordersQuery.isError ? (
            <Alert variant="destructive">
              <AlertDescription>
                Purchase orders could not be loaded. {getErrorMessage(ordersQuery.error)}
                <Button
                  variant="outline"
                  size="sm"
                  className="ml-2"
                  onClick={() => void ordersQuery.reload()}
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
              pagination={false}
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
              pagination={false}
              tableClassName="table-fixed min-w-[1040px] xl:min-w-[1120px]"
            />
          )}
          <CursorPageControls {...ordersQuery} />
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

            archivedLabel="Archived Suppliers"

            activeIcon={<Building2 className="size-3.5" />}
            bannerDescription="Archived suppliers remain in past purchase orders and receiving records. Restore them to use them in new orders."
          />
          <PageToolbar>
            <div className="relative w-full sm:w-80">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                aria-label="Search suppliers"
                placeholder="Search supplier name or code..."
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
                  onClick={() => void suppliersQuery.reload()}
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
              pagination={false}
              manualSorting
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
          <CursorPageControls {...suppliersQuery} label="Supplier" />
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
          statusBadge={renderStatusBadge(selectedOrder.status)}
          onClose={() => setSelectedOrderId(null)}
          onNavigateToDeliveries={onNavigateToDeliveries}
          onConfirm={
            canConfirmPurchaseOrder
              ? () => void confirmPurchaseOrder(selectedOrder.id, selectedOrder.revision).catch(() => undefined)
              : undefined
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
          remoteSelectors
          key={editingOrder?.id ?? 'new-purchase-order'}
          open
          onClose={() => {
            setIsPurchaseModalOpen(false)
            setEditingOrder(null)
          }}
          onSubmit={handleCreatePO}
          onUpdateDraft={editingOrder ? handleUpdateDraft : undefined}
          onConfirm={canConfirmPurchaseOrder ? confirmPurchaseOrder : undefined}
          onExportReceipt={(id) => exportPurchaseReceipt(id)}
          suppliers={suppliers}
          products={products}
          stockItems={stockItems}
          draftOrder={editingOrder ?? undefined}
          catalogState={{
            productsLoading: productsQuery.isLoading,
            stockLoading: stockQuery.isLoading,
            stockIncomplete: stockQuery.hasNextPage,
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
          if (orderToCancel && canManage) await cancelPOMutation.mutateAsync({ id: orderToCancel.id, expectedRevision: orderToCancel.revision })
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
