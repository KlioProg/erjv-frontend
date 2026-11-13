import { CursorLookup } from '@/components/ui/CursorLookup'
import { Label } from '@/components/ui/label'
import { manilaScheduleToIso } from '@/lib/manila-schedule'
import {
  DataTableFilters,
  DataTableFilterChips,
  type DataTableFilter,
} from '@/components/ui/data-table-filters'
import { fetchProductByIdApi } from '@/features/products/products.api'
import type { InventoryItemResponse } from '@/features/products/products.types'
import type { Warehouse } from '@/features/logistics/warehouses.types'
import { useRecordsById } from '@/lib/use-records-by-id'
import { fetchIncomingDeliveriesApi } from '@/features/logistics/incoming-deliveries.api'
import { useResourcePage } from '@/lib/use-cursor-page'
import { useQueries } from '@tanstack/react-query'
import { fetchSupplierByIdApi } from '@/features/logistics/suppliers.api'
import { DataTableFooter, DataTableFrame } from '@/components/ui/DataTableFooter'
import { PageHeader, PageToolbar } from '@/components/ui/ManagementPage'
import { toast } from 'sonner'
import { useState, useMemo, useRef } from 'react'
import { Archive, Building2, CheckCircle2, Clock, Plus, Search, XCircle } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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
import { exportPurchaseReceiptPdf } from '@/lib/purchase-receipt'
import { StatusBadge } from '@/components/ui/StatusBadge'
import {
  getPurchaseOrderProgressDisplay,
  purchaseMaterialsSummary,
  PURCHASE_ORDER_STATUS,
} from '@/features/logistics/purchase-orders.presentation'

export type PurchaseTabFilter = 'Active' | 'Completed' | 'Cancelled'

export type PurchaseSection = 'orders' | 'suppliers'

type PurchasesViewProps = {
  section?: PurchaseSection
  onNavigateToDeliveries?: (purchaseOrderId?: number, arrange?: boolean) => void
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
  const [editingOrder, setEditingOrder] = useState<PurchaseOrderRecord | null>(null)
  const [orderToCancel, setOrderToCancel] = useState<PurchaseOrderRecord | null>(null)

  const { user, isAdmin, isManager } = useAuth()
  const canManage = isAdmin || isManager
  const canConfirmPurchaseOrder = isAdmin
  const processedBy = user?.fullName || user?.email || 'Current User'

  // Data queries
  const [orderStatus, setOrderStatus] = useState('ALL')
  const [partyFilter, setPartyFilter] = useState<{ id: string; name: string } | null>(null)
  const [orderedFrom, setOrderedFrom] = useState('')
  const [orderedThrough, setOrderedThrough] = useState('')
  const dateError = !!orderedFrom && !!orderedThrough && orderedFrom > orderedThrough
  const groupStatuses: PurchaseOrderRecord['status'][] =
    activeStatus === 'Active'
      ? ['DRAFT', 'CONFIRMED', 'PARTIALLY_RECEIVED']
      : activeStatus === 'Completed'
        ? ['RECEIVED']
        : ['CANCELLED']
  const specificStatus = groupStatuses.includes(orderStatus as PurchaseOrderRecord['status'])
    ? orderStatus
    : 'ALL'
  const orderFilters: DataTableFilter[] = [
    {
      kind: 'select',
      id: 'order-status',
      label: 'Order status',
      value: specificStatus,
      onChange: setOrderStatus,
      options: [
        { value: 'ALL', label: 'All statuses in this tab' },
        ...groupStatuses.map((value) => ({
          value,
          label: value
            .replaceAll('_', ' ')
            .toLowerCase()
            .replace(/^./, (letter) => letter.toUpperCase()),
        })),
      ],
    },
    {
      kind: 'custom',
      id: 'party',
      label: 'Supplier',
      active: !!partyFilter,
      valueLabel: partyFilter?.name,
      onClear: () => setPartyFilter(null),
      content: (
        <>
          <Label htmlFor="order-party-filter">Supplier</Label>
          <CursorLookup<{ id: number; name: string }>
            id="order-party-filter"
            path="/suppliers"
            filter={{ includeInactive: 'true' }}
            label="Supplier"
            value={partyFilter?.id ?? ''}
            selectedLabel={partyFilter?.name}
            getLabel={(party) => party.name}
            onChange={(id, party) => setPartyFilter({ id, name: party.name })}
          />
        </>
      ),
    },
    ...[
      { id: 'order-from', label: 'Order date from', value: orderedFrom, set: setOrderedFrom },
      {
        id: 'order-through',
        label: 'Order date through',
        value: orderedThrough,
        set: setOrderedThrough,
      },
    ].map((field): DataTableFilter => ({
      kind: 'custom',
      id: field.id,
      label: field.label,
      active: !!field.value,
      valueLabel: field.value,
      onClear: () => field.set(''),
      content: (
        <>
          <Label htmlFor={field.id}>{field.label}</Label>
          <Input
            id={field.id}
            type="date"
            value={field.value}
            min={field.id === 'order-through' ? orderedFrom || undefined : undefined}
            max="9999-12-31"
            onChange={(event) => field.set(event.target.value)}
            aria-invalid={dateError}
          />
          <p className="text-xs text-muted-foreground">Order dates use Manila time.</p>
          {dateError && field.id === 'order-through' && (
            <p className="text-xs text-destructive">
              Choose an end date on or after the start date.
            </p>
          )}
        </>
      ),
    })),
  ]
  const ordersQuery = usePurchaseOrdersPage(
    {
      statuses:
        specificStatus === 'ALL'
          ? groupStatuses
          : [specificStatus as PurchaseOrderRecord['status']],
      q: searchTerm.trim() || undefined,
      ...(partyFilter ? { supplierId: Number(partyFilter.id) } : {}),
      ...(orderedFrom ? { orderedFrom: manilaScheduleToIso(`${orderedFrom}T00:00`)! } : {}),
      ...(orderedThrough
        ? {
            orderedBefore: new Date(
              Date.parse(`${orderedThrough}T00:00:00+08:00`) + 86400000,
            ).toISOString(),
          }
        : {}),
    },
    section === 'orders' && !dateError,
  )
  const purchaseOrders = ordersQuery.items
  const isLoadingPOs = ordersQuery.isLoading
  const selectedDetail = usePurchaseOrderById(selectedOrderId ?? undefined)
  const suppliersQuery = useResourcePage<Supplier>(
    '/suppliers',
    {
      includeInactive: supplierView === 'ACTIVE' ? 'false' : 'only',
      q: section === 'suppliers' ? searchTerm.trim() || undefined : undefined,
    },
    section === 'suppliers',
  )
  const baseSuppliers = suppliersQuery.items
  const isLoadingSuppliers = suppliersQuery.isLoading
  const stockQuery = useStockItems()
  const { data: stockItems = [] } = stockQuery
  const productsQuery = useRecordsById<InventoryItemResponse>(
    '/inventory-items',
    [
      ...purchaseOrders,
      ...[editingOrder, selectedDetail.data].filter(
        (order): order is PurchaseOrderRecord => !!order,
      ),
    ].flatMap((order) => order.items.map((item) => item.inventoryItemId)),
  )
  const { data: products = [] } = productsQuery
  const deliveryOrderIds = [
    ...new Set(
      [
        ...(section === 'orders' ? purchaseOrders.map((order) => order.id) : []),
        selectedOrderId,
      ].filter((id): id is number => id !== null),
    ),
  ]
  const deliveryQueries = useQueries({
    queries: deliveryOrderIds.map((id) => ({
      queryKey: ['incoming-deliveries', 'for-order', id],
      queryFn: ({ signal }) => fetchIncomingDeliveriesApi({ purchaseOrderId: id }, signal),
    })),
  })
  const selectedDeliveries = deliveryQueries[deliveryOrderIds.indexOf(selectedOrderId ?? -1)]
  const incomingDeliveries = selectedDeliveries?.data ?? []
  const { data: warehouses } = useRecordsById<Warehouse>(
    '/warehouses',
    incomingDeliveries.map((delivery) => delivery.warehouseId),
  )
  const selectedOrder =
    selectedDetail.data ?? purchaseOrders.find((order) => order.id === selectedOrderId)

  const pageSuppliers = useQueries({
    queries: [
      ...new Set([
        ...purchaseOrders.flatMap((order) => (order.supplierId === null ? [] : [order.supplierId])),
        ...(selectedOrder?.supplierId ? [selectedOrder.supplierId] : []),
      ]),
    ]
      .filter((id) => !baseSuppliers.some((supplier) => supplier.id === id))
      .map((id) => ({
        queryKey: ['suppliers', 'id', id],
        queryFn: () => fetchSupplierByIdApi(id),
      })),
  })
  const suppliers = useMemo(
    () => [...baseSuppliers, ...pageSuppliers.flatMap((query) => (query.data ? [query.data] : []))],
    [baseSuppliers, pageSuppliers],
  )

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

  const confirmPurchaseOrder = async (
    id: number,
    expectedRevision: number,
  ): Promise<PurchaseOrderRecord> => {
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
      const supplier =
        order.supplierId == null
          ? undefined
          : (supplierMap.get(order.supplierId) ?? (await fetchSupplierByIdApi(order.supplierId)))
      if (order.supplierId != null && supplier?.id !== order.supplierId)
        throw Error(
          'Supplier details are unavailable. Reload before exporting this purchase order.',
        )
      const documentProducts = await Promise.all(
        [...new Set(order.items.map((item) => item.inventoryItemId))].map(async (id) => {
          const product =
            products.find((product) => product.id === id) ?? (await fetchProductByIdApi(id))
          if (product?.id !== id)
            throw Error(
              'Product details are unavailable. Reload before exporting this purchase order.',
            )
          return product
        }),
      )
      if (!exportPurchaseReceiptPdf(order, supplier ?? undefined, documentProducts))
        toast.error('The purchase order document could not be downloaded. Try again.')
    } catch (error) {
      toast.error(getErrorMessage(error))
    }
  }

  const handleOrderRowClick = (row: { po: PurchaseOrderRecord }) => setSelectedOrderId(row.po.id)

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

  const renderStatusBadge = (status: PurchaseOrderRecord['status']) => (
    <StatusBadge
      label={PURCHASE_ORDER_STATUS[status].label}
      tone={status === 'CANCELLED' ? 'neutral' : PURCHASE_ORDER_STATUS[status].tone}
    />
  )
  const orderRows = filteredOrders.map((po) => {
    const query = deliveryQueries[deliveryOrderIds.indexOf(po.id)]
    return {
      po,
      supplierName:
        supplierMap.get(po.supplierId ?? -1)?.name ||
        (po.supplierId == null ? 'No supplier assigned' : 'Supplier #' + po.supplierId),
      total: (po.items || []).reduce((sum, item) => sum + Number(item.totalAmount), 0),
      progress: getPurchaseOrderProgressDisplay(
        po,
        query?.data ?? [],
        !!query?.data && !query.isError,
      ),
    }
  })
  const productNames = new Map(products.map((product) => [product.id, product.name]))
  const orderColumns: ColumnDef<(typeof orderRows)[number]>[] = [
    {
      id: 'number',
      header: 'Order',
      width: '18%',
      className: '!px-0',
      cell: ({ row }) => (
        <OverflowValue
          value={row.po.orderNumber}
          onActivate={() => setSelectedOrderId(row.po.id)}
        />
      ),
    },
    {
      id: 'supplier',
      header: 'Supplier',
      width: '24%',
      cell: ({ row }) => (
        <OverflowValue
          value={row.supplierName}
          fullValue={
            row.po.externalReference
              ? row.supplierName + ' | Ref: ' + row.po.externalReference
              : undefined
          }
          showFullValueOnHover
        />
      ),
    },
    {
      id: 'items',
      header: 'Items',
      width: '20%',
      cell: ({ row }) => {
        const items = row.po.items || []
        return (
          <OverflowValue
            value={
              items.length > 1
                ? `${items.length} items`
                : purchaseMaterialsSummary(items, productNames).preview
            }
          />
        )
      },
    },
    {
      id: 'total',
      header: 'Total',
      width: '16%',
      align: 'right',
      className: 'whitespace-nowrap tabular-nums',
      cell: ({ row }) =>
        '₱' +
        row.total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
    },
    {
      id: 'progress',
      header: 'Progress',
      align: 'right',
      width: '22%',
      cell: ({ row }) => (
        <StatusBadge
          label={row.progress.label}
          tone={row.progress.tone}
          className="whitespace-nowrap"
        />
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
      cell: ({ row: supplier }) => <OverflowValue value={supplier.contactPerson} />,
    },
    {
      id: 'supplier-3',
      header: 'Phone & Email',
      width: '23%',
      className: 'text-sm text-foreground',
      cell: ({ row: supplier }) => (
        <OverflowValue
          value={[supplier.phone, supplier.email].filter(Boolean).join(' | ')}
          className="max-w-64"
        />
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

            <DataTableFilters filters={orderFilters} />
            <Button size="sm" onClick={() => setIsPurchaseModalOpen(true)} disabled={!canManage}>
              <Plus className="size-4" />
              Create Purchase Order
            </Button>
          </PageToolbar>
          <DataTableFilterChips filters={orderFilters} />

          <DataTableFrame>
            {dateError ? (
              <p role="alert" className="p-4 text-sm text-destructive">
                Choose an end date on or after the start date.
              </p>
            ) : ordersQuery.isError ? (
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
            ) : (
              <DataTable
                appearance="management"
                retainHeaders
                data={orderRows}
                columns={orderColumns}
                getRowKey={({ po }) => po.id}
                onRowClick={handleOrderRowClick}
                pagination={false}
                isLoading={isLoadingPOs}
                loadingMessage="Loading purchase orders..."
                tableClassName="table-fixed min-w-[760px]"
                emptyContent={
                  searchTerm.trim()
                    ? `No purchase orders match "${searchTerm.trim()}"`
                    : `No ${activeStatus.toLowerCase()} purchase orders found`
                }
              />
            )}
            <DataTableFooter {...ordersQuery} rowCount={ordersQuery.items.length} />
          </DataTableFrame>
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

          <DataTableFrame>
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
          <DataTableFooter {...suppliersQuery} rowCount={suppliersQuery.items.length} label="Supplier" />
          </DataTableFrame>
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
          receivingLoading={selectedDeliveries?.isPending ?? true}
          receivingUnavailable={selectedDeliveries?.isError ?? false}
          onRetryReceiving={() => void selectedDeliveries?.refetch()}
          recordBusy={selectedDetail.isFetching}
          recordUnavailable={
            selectedDetail.isError || (selectedDetail.isSuccess && !selectedDetail.data)
          }
          onEdit={
            canManage && selectedOrder.status === 'DRAFT'
              ? () => {
                  setSelectedOrderId(null)
                  setEditingOrder(selectedOrder)
                }
              : undefined
          }
          onCancel={
            canManage && ['DRAFT', 'CONFIRMED'].includes(selectedOrder.status)
              ? () => {
                  setSelectedOrderId(null)
                  setOrderToCancel(selectedOrder)
                }
              : undefined
          }
          onConfirm={
            canConfirmPurchaseOrder
              ? () => confirmPurchaseOrder(selectedOrder.id, selectedOrder.revision)
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
          if (orderToCancel && canManage)
            await cancelPOMutation.mutateAsync({
              id: orderToCancel.id,
              expectedRevision: orderToCancel.revision,
            })
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
