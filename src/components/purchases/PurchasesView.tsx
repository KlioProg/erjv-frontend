import { useState } from 'react'
import { CheckCircle2, Edit2, FileInput, Plus, Search, XCircle } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { StatusTabNav } from '@/components/ui/StatusTabNav'
import { PurchaseModal, type PurchaseFormValues, type PurchaseStatus } from './PurchaseModal'
import { useAuth } from '@/features/auth/AuthContext'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

export type Purchase = PurchaseFormValues & {
  id: number
  purchaseNo: string
}

type PurchasesViewProps = {
  purchases?: Purchase[]
  onPurchasesChange?: (purchases: Purchase[]) => void
}

export function PurchasesView({
  purchases: externalPurchases,
  onPurchasesChange,
}: PurchasesViewProps = {}) {
  const [internalPurchases, setInternalPurchases] = useState<Purchase[]>([])
  const purchases = externalPurchases ?? internalPurchases

  const setPurchases = (next: Purchase[]) => {
    if (onPurchasesChange) {
      onPurchasesChange(next)
    } else {
      setInternalPurchases(next)
    }
  }

  const [searchTerm, setSearchTerm] = useState('')
  const [activeStatus, setActiveStatus] = useState<PurchaseStatus>('Active')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [selectedPurchase, setSelectedPurchase] = useState<Purchase | null>(null)
  const { user } = useAuth()

  const processedBy = user?.fullName || user?.email || 'Current User'
  const statusCount = (status: PurchaseStatus) =>
    purchases.filter((purchase) => purchase.status === status).length

  const handleSavePurchase = (values: PurchaseFormValues) => {
    if (selectedPurchase) {
      setPurchases(
        purchases.map((purchase) =>
          purchase.id === selectedPurchase.id ? { ...purchase, ...values } : purchase,
        ),
      )
      setSelectedPurchase(null)
      setIsModalOpen(false)
      return
    }

    const createdAt = new Date()
    const id = createdAt.getTime()
    const purchaseNo = `PO-${id.toString(36).toUpperCase()}`

    setPurchases([{ id, purchaseNo, ...values }, ...purchases])
    setIsModalOpen(false)
  }

  const filteredPurchases = purchases.filter((purchase) => {
    const query = searchTerm.toLowerCase().trim()
    return (
      purchase.status === activeStatus &&
      (!query ||
        purchase.purchaseNo.toLowerCase().includes(query) ||
        purchase.referenceNo.toLowerCase().includes(query) ||
        purchase.supplierName.toLowerCase().includes(query) ||
        purchase.lines.some((line) => line.name.toLowerCase().includes(query)))
    )
  })

  return (
    <div className="flex flex-col gap-5">
      <StatusTabNav
        activeTab={activeStatus}
        onTabChange={(tab) => setActiveStatus(tab as PurchaseStatus)}
        tabs={[
          { value: 'Active', label: 'Active Purchases', count: statusCount('Active'), icon: <FileInput className="size-3.5" />, accent: 'green' },
          { value: 'Completed', label: 'Completed Purchases', count: statusCount('Completed'), icon: <CheckCircle2 className="size-3.5" />, accent: 'blue' },
          { value: 'Cancelled', label: 'Cancelled Purchases', count: statusCount('Cancelled'), icon: <XCircle className="size-3.5" />, accent: 'red' },
        ]}
      />

      <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
        <div className="relative w-full sm:w-80">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search PO, supplier, product..."
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            className="h-9 pl-9 text-xs"
          />
        </div>
        <Button
          size="sm"
          onClick={() => {
            setSelectedPurchase(null)
            setIsModalOpen(true)
          }}
        >
          <Plus className="size-4" />
          Record Purchase
        </Button>
      </div>

      {filteredPurchases.length === 0 ? (
        <Card className="flex min-h-[360px] items-center justify-center border-dashed bg-muted/20 shadow-xs">
          <div className="flex flex-col items-center justify-center text-center">
            <FileInput className="size-8 text-muted-foreground/40" />
            <span className="text-sm font-semibold text-foreground">
              {searchTerm.trim()
                ? `No ${activeStatus.toLowerCase()} purchases match "${searchTerm.trim()}"`
                : `No ${activeStatus.toLowerCase()} purchases found`}
            </span>
            <p className="mt-1 max-w-xs text-xs text-muted-foreground">
              {searchTerm.trim()
                ? 'Try a different purchase number, supplier, or product.'
                : activeStatus === 'Active'
                  ? 'Record your first supplier purchase.'
                  : 'Purchases moved into this status will appear here.'}
            </p>
          </div>
        </Card>
      ) : (
        <Card className="overflow-hidden border-border/80 shadow-xs">
          <Table>
            <TableHeader className="bg-muted/40">
              <TableRow>
                <TableHead className="text-xs font-semibold">Purchase No.</TableHead>
                <TableHead className="text-xs font-semibold">Supplier</TableHead>
                <TableHead className="text-xs font-semibold">Products</TableHead>
                <TableHead className="text-xs font-semibold">Purchase Date</TableHead>
                <TableHead className="text-xs font-semibold text-right">Total Cost</TableHead>
                <TableHead className="text-xs font-semibold text-center">Payment</TableHead>
                <TableHead className="text-xs font-semibold text-center">Status</TableHead>
                <TableHead className="text-xs font-semibold text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredPurchases.map((purchase) => (
                <TableRow key={purchase.id} className="hover:bg-muted/20">
                  <TableCell className="font-mono text-xs font-bold">
                    <div className="flex items-center gap-1.5">
                      <FileInput className="size-3.5 text-primary" />
                      <span>{purchase.purchaseNo}</span>
                    </div>
                    {purchase.referenceNo && (
                      <span className="mt-0.5 block font-sans text-[10px] text-muted-foreground">
                        Ref: {purchase.referenceNo}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-xs font-semibold">{purchase.supplierName}</TableCell>
                  <TableCell className="max-w-xs text-xs text-foreground/90">
                    {purchase.lines.map((line) => `${line.name} x${line.quantity}`).join(', ')}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {new Date(`${purchase.purchaseDate}T00:00:00`).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                    })}
                  </TableCell>
                  <TableCell className="text-right text-xs font-bold">
                    ₱{purchase.total.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge variant="outline" className="text-[10px]">{purchase.paymentStatus}</Badge>
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge
                      variant="outline"
                      className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${
                        purchase.status === 'Completed'
                          ? 'border-blue-500/20 bg-blue-500/10 text-blue-600'
                          : purchase.status === 'Cancelled'
                            ? 'border-rose-500/20 bg-rose-500/10 text-rose-600'
                            : 'border-emerald-500/20 bg-emerald-500/10 text-emerald-600'
                      }`}
                    >
                      {purchase.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Edit purchase ${purchase.purchaseNo}`}
                      onClick={() => {
                        setSelectedPurchase(purchase)
                        setIsModalOpen(true)
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

      {isModalOpen && (
        <PurchaseModal
          open
          onClose={() => setIsModalOpen(false)}
          onSubmit={handleSavePurchase}
          processedBy={processedBy}
          purchase={selectedPurchase || undefined}
        />
      )}
    </div>
  )
}
