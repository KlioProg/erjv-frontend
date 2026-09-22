import { useState } from 'react'
import { Edit2, Package, Plus, Search, Tag } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Spinner } from '@/components/ui/spinner'
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
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      (p.variety && p.variety.toLowerCase().includes(search.toLowerCase())) ||
      (p.description && p.description.toLowerCase().includes(search.toLowerCase())),
  )

  return (
    <>
      <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
        <DialogContent className="sm:max-w-[820px] p-6 max-h-[92vh] flex flex-col gap-3 overflow-hidden shadow-2xl">
          <DialogHeader className="pb-0 shrink-0">
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
                    <code className="bg-muted px-1.5 py-0.5 rounded text-[11px] font-mono text-primary">
                      GET /inventory-items
                    </code>
                  </DialogDescription>
                </div>
              </div>

              <Button
                size="sm"
                onClick={() => setIsCreateOpen(true)}
                className="gap-1.5 text-xs font-semibold h-8 shadow-xs"
              >
                <Plus className="size-3.5" />
                Add Product
              </Button>
            </div>
          </DialogHeader>

          {/* Search */}
          <div className="relative mt-1 shrink-0">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
            <Input
              placeholder="Search products by name or variety..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 h-9 text-xs rounded-xl"
            />
          </div>

          {/* Product Table */}
          <div className="min-h-0 flex-1 overflow-y-auto rounded-2xl border border-border/80 mt-1 shadow-2xs">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-16 gap-2.5 text-xs text-muted-foreground">
                <Spinner className="size-6 text-primary" />
                Loading product catalog...
              </div>
            ) : error ? (
              <div className="p-8 text-center text-xs text-destructive">
                Unable to load product catalog. Please check your connection and try again.
              </div>
            ) : filtered.length === 0 ? (
              <div className="p-10 text-center text-xs text-muted-foreground">
                No products found matching your search.
              </div>
            ) : (
              <Table>
                <TableHeader className="bg-muted/50 sticky top-0 z-10">
                  <TableRow>
                    <TableHead className="text-xs font-bold">Product Item</TableHead>
                    <TableHead className="text-xs font-bold">Variety / Grade</TableHead>
                    <TableHead className="text-xs font-bold text-right">Wholesale Price</TableHead>
                    <TableHead className="text-xs font-bold text-center">Status</TableHead>
                    <TableHead className="text-xs font-bold text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((item) => (
                    <TableRow key={item.id} className="hover:bg-muted/20">
                      <TableCell>
                        <div className="flex flex-col gap-0.5">
                          <span className="font-bold text-xs text-foreground">{item.name}</span>
                          {item.description && (
                            <span className="text-[11px] text-muted-foreground line-clamp-1">
                              {item.description}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {item.variety ? (
                          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-muted/80 border border-border/70 text-foreground text-[11px] font-semibold">
                            <Tag className="size-3 text-primary shrink-0" />
                            <span>{item.variety}</span>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <span className="font-extrabold text-sm text-foreground font-mono">
                          ₱
                          {Number(item.unitPrice).toLocaleString('en-US', {
                            minimumFractionDigits: 2,
                          })}
                        </span>
                        <span className="text-[10px] text-muted-foreground font-semibold block">
                          / {item.unit || 'unit'}
                        </span>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge
                          variant="outline"
                          className={`text-[10px] font-bold ${
                            item.isActive
                              ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
                              : 'bg-muted text-muted-foreground border-border'
                          }`}
                        >
                          {item.isActive ? 'Active' : 'Archived'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setEditingProduct(item)}
                          className="h-7 px-2.5 text-xs font-semibold gap-1 text-primary hover:text-primary hover:bg-primary/10"
                          title="Edit product details, price, and stock"
                        >
                          <Edit2 className="size-3.5" />
                          <span>Edit</span>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Product Edit Modal */}
      {editingProduct && (
        <InventoryItemModal
          item={editingProduct}
          open={Boolean(editingProduct)}
          onClose={() => setEditingProduct(null)}
        />
      )}

      {/* Product Create Modal */}
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
