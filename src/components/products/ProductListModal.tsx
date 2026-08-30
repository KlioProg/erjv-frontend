import { useState } from 'react'
import { Package, Search } from 'lucide-react'
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
import { Badge } from '@/components/ui/badge'
import { Spinner } from '@/components/ui/spinner'
import { useProducts } from '@/features/products/products.hooks'

type ProductListModalProps = {
  open: boolean
  onClose: () => void
}

export function ProductListModal({ open, onClose }: ProductListModalProps) {
  const { data: products = [], isLoading, error } = useProducts()
  const [search, setSearch] = useState('')

  const filtered = products.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.sku.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="sm:max-w-[700px] p-6">
        <DialogHeader>
          <div className="flex items-center gap-2.5">
            <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Package className="size-5" />
            </div>
            <div>
              <DialogTitle className="text-xl font-bold">Product Catalog (Inventory)</DialogTitle>
              <DialogDescription className="text-xs">
                Live inventory items fetched via React Query from backend endpoint{' '}
                <code className="bg-muted px-1.5 py-0.5 rounded text-[11px] font-mono">
                  GET /inventory-items
                </code>
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Search */}
        <div className="relative mt-2">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Search products by SKU or name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Product Table */}
        <div className="max-h-[360px] overflow-y-auto rounded-xl border border-border mt-2">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-12 gap-2 text-xs text-muted-foreground">
              <Spinner className="size-5 text-primary" />
              Loading product items...
            </div>
          ) : error ? (
            <div className="p-6 text-center text-xs text-destructive">
              Unable to load product list from backend server.
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-8 text-center text-xs text-muted-foreground">
              No products found in inventory.
            </div>
          ) : (
            <Table>
              <TableHeader className="bg-muted/40 sticky top-0 z-10">
                <TableRow>
                  <TableHead>Product / Item</TableHead>
                  <TableHead>SKU Code</TableHead>
                  <TableHead>Unit Price</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-semibold text-xs text-foreground">{item.name}</span>
                        {item.description && (
                          <span className="text-[11px] text-muted-foreground line-clamp-1">
                            {item.description}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="font-mono text-xs text-muted-foreground bg-muted/60 px-2 py-0.5 rounded">
                        {item.sku}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="font-semibold text-xs text-foreground">
                        ₱{Number(item.unitPrice).toFixed(2)}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={item.isActive ? 'default' : 'secondary'}
                        className="text-[10px]"
                      >
                        {item.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
