import { useState } from 'react'
import { Edit2, Package, Plus, Search, Tag } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { DataTable, type ColumnDef } from '@/components/ui/data-table'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useProducts } from '@/features/products/products.hooks'
import { InventoryItemModal } from '../operations/InventoryItemModal'
import type { InventoryItemResponse } from '@/features/products/products.types'

type ProductListModalProps = {
  open: boolean
  onClose: () => void
}

export function ProductListModal({ open, onClose }: ProductListModalProps) {
  const { data: products = [], isLoading, error } = useProducts({ includeInactive: 'true' })
  const [search, setSearch] = useState('')
  const [editingProduct, setEditingProduct] = useState<InventoryItemResponse | null>(null)
  const [isCreateOpen, setIsCreateOpen] = useState(false)

  const filtered = products.filter(
    (product) =>
      product.name.toLowerCase().includes(search.toLowerCase()) ||
      product.variety?.toLowerCase().includes(search.toLowerCase()) ||
      product.description?.toLowerCase().includes(search.toLowerCase()),
  )

  const productColumns: ColumnDef<InventoryItemResponse>[] = [
    {
      id: 'product',
      header: 'Product Item',
      accessorKey: 'name',
      sortable: true,
      cell: ({ row }) => (
        <div className="flex flex-col gap-0.5">
          <span className="text-xs font-bold text-foreground">{row.name}</span>
          {row.description && (
            <span className="line-clamp-1 text-[11px] text-muted-foreground">
              {row.description}
            </span>
          )}
        </div>
      ),
    },
    {
      id: 'variety',
      header: 'Variety / Grade',
      accessorKey: 'variety',
      cell: ({ row }) =>
        row.variety ? (
          <span className="inline-flex items-center gap-1.5 rounded-lg border border-border/70 bg-muted/80 px-2.5 py-1 text-[11px] font-semibold text-foreground">
            <Tag className="size-3 shrink-0 text-primary" />
            {row.variety}
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        ),
    },
    {
      id: 'price',
      header: 'Wholesale Price',
      accessorFn: (row) => Number(row.unitPrice),
      sortable: true,
      align: 'right',
      cell: ({ row }) => (
        <div>
          <span className="font-mono text-sm font-extrabold text-foreground">
            ₱{Number(row.unitPrice).toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </span>
          <span className="block text-[10px] font-semibold text-muted-foreground">
            / {row.unit || 'unit'}
          </span>
        </div>
      ),
    },
    {
      id: 'status',
      header: 'Status',
      align: 'center',
      cell: ({ row }) => (
        <Badge
          variant="outline"
          className={`text-[10px] font-bold ${
            row.isActive
              ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-600'
              : 'border-border bg-muted text-muted-foreground'
          }`}
        >
          {row.isActive ? 'Active' : 'Archived'}
        </Badge>
      ),
    },
    {
      id: 'actions',
      header: 'Actions',
      align: 'right',
      cell: ({ row }) => (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setEditingProduct(row)}
          className="h-7 gap-1 px-2.5 text-xs font-semibold text-primary hover:bg-primary/10 hover:text-primary"
          title="Edit product details, price, and stock"
        >
          <Edit2 className="size-3.5" />
          Edit
        </Button>
      ),
    },
  ]

  return (
    <>
      <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
        <DialogContent className="flex max-h-[92vh] flex-col gap-3 overflow-hidden p-6 shadow-2xl sm:max-w-[820px]">
          <DialogHeader className="shrink-0 pb-0">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex size-10 items-center justify-center rounded-2xl bg-primary/10 text-primary shadow-2xs">
                  <Package className="size-5" />
                </div>
                <div>
                  <DialogTitle className="text-xl font-extrabold tracking-tight text-foreground">
                    Product Catalog
                  </DialogTitle>
                  <DialogDescription className="text-xs text-muted-foreground">
                    Wholesale and retail inventory items connected to{' '}
                    <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px] text-primary">
                      GET /inventory-items
                    </code>
                  </DialogDescription>
                </div>
              </div>
              <Button
                size="sm"
                onClick={() => setIsCreateOpen(true)}
                className="h-8 gap-1.5 text-xs font-semibold shadow-xs"
              >
                <Plus className="size-3.5" />
                Add Product
              </Button>
            </div>
          </DialogHeader>

          <div className="relative mt-1 shrink-0">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search products by name or variety..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="h-9 rounded-xl pl-10 text-xs"
            />
          </div>

          <div className="mt-1 min-h-0 flex-1 overflow-y-auto">
            {error ? (
              <div className="p-8 text-center text-xs text-destructive">
                Unable to load product catalog. Please check your connection and try again.
              </div>
            ) : (
              <DataTable
                data={filtered}
                columns={productColumns}
                getRowKey={(product) => product.id}
                isLoading={isLoading}
                loadingMessage="Loading product catalog..."
                pagination={false}
                tableClassName="min-w-[620px]"
                emptyContent={
                  <div className="rounded-lg border border-border/80 p-10 text-center text-xs text-muted-foreground">
                    No products found matching your search.
                  </div>
                }
              />
            )}
          </div>
        </DialogContent>
      </Dialog>

      {editingProduct && (
        <InventoryItemModal
          item={editingProduct}
          open={Boolean(editingProduct)}
          onClose={() => setEditingProduct(null)}
        />
      )}
      {isCreateOpen && (
        <InventoryItemModal
          item={null}
          open={isCreateOpen}
          onClose={() => setIsCreateOpen(false)}
        />
      )}
    </>
  )
}
