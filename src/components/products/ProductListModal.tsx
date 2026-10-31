import { formatProductUnit } from '@/lib/product-unit'
import { useState } from 'react'
import { Plus, Search, Tag } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { DataTableActions } from '@/components/ui/DataTableActions'
import { DataTable, type ColumnDef } from '@/components/ui/data-table'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useResourcePage } from '@/lib/use-cursor-page'
import { CursorPageControls } from '@/components/ui/CursorPageControls'
import { InventoryItemModal } from '../operations/InventoryItemModal'
import type { InventoryItemResponse } from '@/features/products/products.types'

type ProductListModalProps = {
  open: boolean
  onClose: () => void
}

export function ProductListModal({ open, onClose }: ProductListModalProps) {
  const [search, setSearch] = useState('')
  const query = useResourcePage<InventoryItemResponse>('/inventory-items', { includeInactive: 'true', q: search.trim() || undefined }, open)
  const { isFetching: isLoading, error } = query
  const [editingProduct, setEditingProduct] = useState<InventoryItemResponse | null>(null)
  const [isCreateOpen, setIsCreateOpen] = useState(false)

  const filtered = query.items

  const productColumns: ColumnDef<InventoryItemResponse>[] = [
    {
      id: 'product',
      header: 'Product Item',
      accessorKey: 'name',
      sortable: false,
      cell: ({ row }) => (
        <div className="flex flex-col gap-0.5">
          <span className="text-sm font-medium text-foreground">{row.name}</span>
          {row.description && (
            <span className="line-clamp-1 text-xs text-muted-foreground">
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
          <span className="inline-flex items-center gap-1.5 rounded-lg border border-border/70 bg-muted/80 px-2.5 py-1 text-xs font-medium text-foreground">
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
      sortable: false,
      align: 'right',
      cell: ({ row }) => (
        <div>
          <span className="text-sm font-normal tabular-nums text-foreground">
            ₱{Number(row.unitPrice).toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </span>
          <span className="block text-xs font-normal text-muted-foreground">
            / {formatProductUnit(row.unit, 'unit')}
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
          className={`text-xs font-medium ${
            row.isActive
              ? 'border-status-success-foreground/20 bg-status-success text-status-success-foreground'
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
      className: 'w-px whitespace-nowrap',
      headerClassName: 'w-px whitespace-nowrap',
      cell: ({ row }) => <DataTableActions onEdit={() => setEditingProduct(row)} />,
    },
  ]

  return (
    <>
      <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
        <DialogContent className="flex max-h-[92vh] flex-col gap-5 overflow-hidden p-6 sm:max-w-[820px]">
          <DialogHeader className="shrink-0 pb-0">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div>
                  <DialogTitle className="text-xl font-semibold tracking-tight text-foreground">
                    Product Catalog
                  </DialogTitle>
                  <DialogDescription className="text-xs text-muted-foreground">
                    Wholesale and retail inventory items connected to{' '}
                    <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-primary">
                      GET /inventory-items
                    </code>
                  </DialogDescription>
                </div>
              </div>
              <Button
                size="sm"
                onClick={() => setIsCreateOpen(true)}
                className="h-8 gap-2 text-ui font-medium"
              >
                <Plus className="size-3.5" />
                Add Product
              </Button>
            </div>
          </DialogHeader>

          <div className="relative mt-1 shrink-0">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search product name..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="h-10 pl-10 text-ui"
            />
          </div>

          <div className="mt-1 min-h-0 flex-1 overflow-y-auto">
            {error ? (
              <div className="p-8 text-center text-xs text-destructive">
                Unable to load product catalog. <Button variant="link" onClick={() => void query.reload()}>Retry</Button>
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
          <CursorPageControls {...query} label="Product" />
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
