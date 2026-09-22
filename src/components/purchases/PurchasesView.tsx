import { useState, useMemo } from 'react'
import {
  ArrowDownToLine,
  Building2,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock,
  Edit2,
  Info,
  Package,
  Plus,
  Power,
  PowerOff,
  Search,
  Truck,
  X,
  XCircle,
} from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { StatusTabNav } from '@/components/ui/StatusTabNav'
import { PurchaseModal } from './PurchaseModal'
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

export type PurchaseTabFilter = 'Active' | 'Completed' | 'Cancelled'

type PurchasesViewProps = {
  onNavigateToDeliveries?: () => void
}

export function PurchasesView({ onNavigateToDeliveries }: PurchasesViewProps = {}) {
  const [activeSection, setActiveSection] = useState<'orders' | 'suppliers'>('orders')
  const [searchTerm, setSearchTerm] = useState('')
  const [activeStatus, setActiveStatus] = useState<PurchaseTabFilter>('Active')

  // Modals state
  const [isPurchaseModalOpen, setIsPurchaseModalOpen] = useState(false)
  const [isSupplierModalOpen, setIsSupplierModalOpen] = useState(false)
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null)

  const { user } = useAuth()
  const processedBy = user?.fullName || user?.email || 'Current User'

  // Data queries
  const { data: purchaseOrders = [], isLoading: isLoadingPOs } = usePurchaseOrders()
  const { data: suppliers = [], isLoading: isLoadingSuppliers } = useSuppliers()
  const { data: products = [] } = useProducts()

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

  const filteredSuppliers = useMemo(() => {
    if (!searchTerm.trim()) return suppliers
    const q = searchTerm.toLowerCase().trim()
    return suppliers.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.code.toLowerCase().includes(q) ||
        s.contactPerson?.toLowerCase().includes(q) ||
        s.email?.toLowerCase().includes(q) ||
        s.address?.toLowerCase().includes(q),
    )
  }, [suppliers, searchTerm])

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

  return (
    <div className="flex flex-col gap-5">
      <Tabs
        value={activeSection}
        onValueChange={(val) => {
          setActiveSection(val as 'orders' | 'suppliers')
          setSearchTerm('')
        }}
        className="w-full flex flex-col gap-4"
      >
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 border-b border-border/70 pb-3">
          <TabsList className="h-10 p-1 bg-secondary/80 justify-start w-full sm:w-auto">
            <TabsTrigger value="orders" className="gap-2 text-xs font-semibold px-4 cursor-pointer">
              <Package className="size-3.5" />
              <span>Purchase Orders</span>
              <span className="ml-1 rounded-full bg-primary/10 text-primary px-2 py-0.5 text-[10px] font-mono font-bold">
                {purchaseOrders.length}
              </span>
            </TabsTrigger>
            <TabsTrigger value="suppliers" className="gap-2 text-xs font-semibold px-4 cursor-pointer">
              <Building2 className="size-3.5" />
              <span>Supplier Directory</span>
              <span className="ml-1 rounded-full bg-muted text-muted-foreground px-2 py-0.5 text-[10px] font-mono font-bold">
                {suppliers.length}
              </span>
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="orders" className="mt-0 focus-visible:outline-none flex flex-col gap-5">
          <StatusTabNav
            activeTab={activeStatus}
            onTabChange={(tab) => setActiveStatus(tab as PurchaseTabFilter)}
            tabs={[
              {
                value: 'Active',
                label: 'Active POs',
                count: statusCount('Active'),
                icon: <Clock className="size-3.5" />,
                accent: 'green',
              },
              {
                value: 'Completed',
                label: 'Received POs',
                count: statusCount('Completed'),
                icon: <CheckCircle2 className="size-3.5" />,
                accent: 'blue',
              },
              {
                value: 'Cancelled',
                label: 'Cancelled POs',
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
                  <strong className="text-foreground font-semibold">Deliveries Hub → Inbound Receiving</strong>.
                </span>
              </div>
              {onNavigateToDeliveries && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={onNavigateToDeliveries}
                  className="h-7 text-xs font-semibold gap-1 px-2.5 shrink-0 bg-background hover:bg-muted"
                >
                  Go to Inbound Receiving
                  <ChevronRight className="size-3.5" />
                </Button>
              )}
            </div>
          )}

          <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
            <div className="relative w-full sm:w-80">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search PO number, supplier, reference..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 h-9 text-xs"
              />
            </div>

            <Button
              size="sm"
              onClick={() => setIsPurchaseModalOpen(true)}
              disabled={suppliers.length === 0}
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
                    ? 'Try a different PO number or supplier name.'
                    : activeStatus === 'Active'
                      ? 'Issue purchase orders to suppliers for stock replenishment.'
                      : 'Purchase orders moved into this status will appear here.'}
                </p>
              </div>
            </Card>
          ) : (
            <Card className="overflow-hidden border-border/80 shadow-xs">
              <Table>
                <TableHeader className="bg-muted/40">
                  <TableRow>
                    <TableHead className="text-xs font-semibold">PO Number</TableHead>
                    <TableHead className="text-xs font-semibold">Supplier Vendor</TableHead>
                    <TableHead className="text-xs font-semibold">Ordered Materials</TableHead>
                    <TableHead className="text-xs font-semibold">Expected Date</TableHead>
                    <TableHead className="text-xs font-semibold text-right">Total Amount</TableHead>
                    <TableHead className="text-xs font-semibold text-center">Status</TableHead>
                    <TableHead className="text-xs font-semibold text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredOrders.map((po) => {
                    const supplier = supplierMap.get(po.supplierId)
                    const supplierName = supplier?.name || `Supplier #${po.supplierId}`
                    const total = (po.items || []).reduce(
                      (sum, item) =>
                        sum +
                        Number(
                          item.totalAmount || Number(item.quantity) * Number(item.unitPrice),
                        ),
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

                    return (
                      <TableRow key={po.id} className="hover:bg-muted/20">
                        <TableCell className="font-mono text-xs font-bold text-foreground">
                          <div className="flex items-center gap-1.5">
                            <Package className="size-3.5 text-primary" />
                            <span>{po.orderNumber}</span>
                          </div>
                          <span className="text-[10px] text-muted-foreground font-sans block mt-0.5">
                            {orderDate}
                          </span>
                        </TableCell>

                        <TableCell className="text-xs font-semibold text-foreground">
                          <div>{supplierName}</div>
                          {po.externalReference && (
                            <div className="text-[10px] text-muted-foreground font-normal">
                              Ref: {po.externalReference}
                            </div>
                          )}
                        </TableCell>

                        <TableCell
                          className="text-xs text-foreground/90 max-w-[240px] truncate"
                          title={itemSummary}
                        >
                          {itemSummary || 'No items listed'}
                        </TableCell>

                        <TableCell className="text-xs text-muted-foreground">
                          {expectedDate}
                        </TableCell>

                        <TableCell className="text-xs font-bold text-foreground text-right font-mono">
                          ₱{total.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </TableCell>

                        <TableCell className="text-center">
                          {renderStatusBadge(po.status)}
                        </TableCell>

                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
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
                                    onClick={onNavigateToDeliveries}
                                    className="group inline-flex items-center gap-1 rounded-md border border-border/80 bg-muted/40 px-2 py-1 text-[10px] font-medium text-muted-foreground hover:text-foreground hover:bg-muted/70 transition-colors"
                                    title="Go to Deliveries Hub → Inbound Receiving to schedule and receive materials"
                                  >
                                    <ArrowDownToLine className="size-3 text-primary group-hover:translate-y-0.5 transition-transform" />
                                    <span>Inbound Receiving</span>
                                    <ChevronRight className="size-2.5 opacity-60" />
                                  </button>
                                ) : (
                                  <span
                                    className="inline-flex items-center gap-1 rounded-md border border-border/80 bg-muted/40 px-2 py-1 text-[10px] font-medium text-muted-foreground"
                                    title="Receive materials via Deliveries Hub → Inbound Receiving"
                                  >
                                    <ArrowDownToLine className="size-3 text-primary" />
                                    <span>Inbound Receiving</span>
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
                                    onClick={onNavigateToDeliveries}
                                    className="group inline-flex items-center gap-1 rounded-md border border-border/80 bg-muted/40 px-2 py-1 text-[10px] font-medium text-muted-foreground hover:text-foreground hover:bg-muted/70 transition-colors"
                                    title="Go to Deliveries Hub → Inbound Receiving to receive remaining cargo"
                                  >
                                    <ArrowDownToLine className="size-3 text-indigo-500 group-hover:translate-y-0.5 transition-transform" />
                                    <span>Receive in Inbound</span>
                                    <ChevronRight className="size-2.5 opacity-60" />
                                  </button>
                                ) : (
                                  <span
                                    className="inline-flex items-center gap-1 rounded-md border border-border/80 bg-muted/40 px-2 py-1 text-[10px] font-medium text-muted-foreground"
                                    title="Receive remaining materials via Deliveries Hub → Inbound Receiving"
                                  >
                                    <ArrowDownToLine className="size-3 text-indigo-500" />
                                    <span>Receive in Inbound</span>
                                  </span>
                                )}
                              </div>
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
        </TabsContent>

        {/* Suppliers Directory Section */}
        <TabsContent value="suppliers" className="mt-0 focus-visible:outline-none flex flex-col gap-5">
          <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
            <div className="relative w-full sm:w-80">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search supplier name, code, contact..."
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

          {isLoadingSuppliers ? (
            <Card className="flex min-h-[300px] items-center justify-center p-8">
              <div className="flex flex-col items-center gap-2">
                <Clock className="size-6 animate-spin text-primary" />
                <p className="text-xs text-muted-foreground">Loading supplier directory...</p>
              </div>
            </Card>
          ) : filteredSuppliers.length === 0 ? (
            <Card className="flex min-h-[340px] items-center justify-center border-dashed bg-muted/20 shadow-xs">
              <div className="flex flex-col items-center justify-center text-center">
                <Building2 className="size-8 text-muted-foreground/40 mb-2" />
                <span className="text-sm font-semibold text-foreground">
                  {searchTerm.trim()
                    ? `No suppliers match "${searchTerm.trim()}"`
                    : 'No suppliers registered yet'}
                </span>
                <p className="text-xs text-muted-foreground mt-1 max-w-xs">
                  Register accredited vendor companies to begin purchasing stock materials.
                </p>
              </div>
            </Card>
          ) : (
            <Card className="overflow-hidden border-border/80 shadow-xs">
              <Table>
                <TableHeader className="bg-muted/40">
                  <TableRow>
                    <TableHead className="text-xs font-semibold">Code</TableHead>
                    <TableHead className="text-xs font-semibold">Company Name</TableHead>
                    <TableHead className="text-xs font-semibold">Contact Person</TableHead>
                    <TableHead className="text-xs font-semibold">Phone & Email</TableHead>
                    <TableHead className="text-xs font-semibold">Address</TableHead>
                    <TableHead className="text-xs font-semibold text-center">Status</TableHead>
                    <TableHead className="text-xs font-semibold text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredSuppliers.map((supplier) => (
                    <TableRow key={supplier.id} className="hover:bg-muted/20">
                      <TableCell className="font-mono text-xs font-bold text-foreground">
                        {supplier.code}
                      </TableCell>

                      <TableCell className="text-xs font-semibold text-foreground">
                        {supplier.name}
                      </TableCell>

                      <TableCell className="text-xs text-foreground/90">
                        {supplier.contactPerson || '—'}
                      </TableCell>

                      <TableCell className="text-xs text-muted-foreground">
                        <div>{supplier.phone || '—'}</div>
                        {supplier.email && (
                          <div className="text-[10px] text-primary">{supplier.email}</div>
                        )}
                      </TableCell>

                      <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate" title={supplier.address || ''}>
                        {supplier.address || '—'}
                      </TableCell>

                      <TableCell className="text-center">
                        <Badge
                          variant="outline"
                          className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${supplier.isActive
                              ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
                              : 'bg-muted text-muted-foreground border-border'
                            }`}
                        >
                          {supplier.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                      </TableCell>

                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-7 text-muted-foreground hover:text-foreground"
                            onClick={() => {
                              setSelectedSupplier(supplier)
                              setIsSupplierModalOpen(true)
                            }}
                            title="Edit Supplier"
                          >
                            <Edit2 className="size-3.5" />
                          </Button>

                          {supplier.isActive ? (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-7 text-rose-500 hover:text-rose-600 hover:bg-rose-500/10"
                              onClick={() => deleteSupplierMutation.mutate(supplier.id)}
                              disabled={deleteSupplierMutation.isPending}
                              title="Deactivate Supplier"
                            >
                              <PowerOff className="size-3.5" />
                            </Button>
                          ) : (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-7 text-emerald-600 hover:bg-emerald-500/10"
                              onClick={() => reactivateSupplierMutation.mutate(supplier.id)}
                              disabled={reactivateSupplierMutation.isPending}
                              title="Reactivate Supplier"
                            >
                              <Power className="size-3.5" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          )}
        </TabsContent>
      </Tabs>

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
    </div>
  )
}
