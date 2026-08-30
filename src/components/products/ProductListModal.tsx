import { useState } from 'react'
import { Package, Search, Barcode } from 'lucide-react'
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
      <DialogContent className="sm:max-w-[760px] p-6">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="flex size-11 items-center justify-center rounded-2xl bg-primary/10 text-primary shadow-2xs">
              <Package className="size-5" />
            </div>
            <div>
              <DialogTitle className="text-xl font-extrabold tracking-tight text-foreground">
                Rice Product Catalog & SKUs
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Wholesale and retail grain varieties connected to{' '}
                <code className="bg-muted px-1.5 py-0.5 rounded text-[11px] font-mono text-primary">
                  GET /inventory-items
                </code>
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Search */}
        <div className="relative mt-3">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Search rice varieties by name or SKU code..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 h-10 text-xs rounded-xl"
          />
        </div>

        {/* Product Table */}
        <div className="max-h-[380px] overflow-y-auto rounded-2xl border border-border/80 mt-2 shadow-2xs">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-16 gap-2.5 text-xs text-muted-foreground">
              <Spinner className="size-6 text-primary" />
              Loading rice catalog...
            </div>
          ) : error ? (
            <div className="p-8 text-center text-xs text-destructive">
              Unable to load product list from backend server.
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-10 text-center text-xs text-muted-foreground">
              No rice products found matching your search.
            </div>
          ) : (
            <Table>
              <TableHeader className="bg-muted/50 sticky top-0 z-10">
                <TableRow>
                  <TableHead className="text-xs font-bold">Rice Variety & Grade</TableHead>
                  <TableHead className="text-xs font-bold">SKU Code</TableHead>
                  <TableHead className="text-xs font-bold text-right">Wholesale Price</TableHead>
                  <TableHead className="text-xs font-bold text-center">Status</TableHead>
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
                      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-muted/80 border border-border/70 text-foreground font-mono text-[11px] font-bold">
                        <Barcode className="size-3.5 text-primary shrink-0" />
                        <span>{item.sku}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <span className="font-extrabold text-sm text-foreground">
                        ₱{Number(item.unitPrice).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </span>
                      <span className="text-[10px] text-muted-foreground font-semibold block">
                        / sack
                      </span>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge
                        variant="outline"
                        className="text-[10px] bg-emerald-500/10 text-emerald-600 border-emerald-500/20 font-bold"
                      >
                        {item.isActive ? 'Active SKU' : 'Inactive'}
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
