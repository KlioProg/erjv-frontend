import { StockPagingControls } from './StockPagingControls'
import { useState } from 'react'
import { useAuth } from '@/features/auth/AuthContext'
import { useWarehouses } from '@/features/logistics/warehouses.hooks'
import { useWarehouseStock } from '@/features/logistics/stock-items.hooks'
import {
  thresholdChanged,
  useStockAlertEditors,
} from '@/features/logistics/stock-alert-settings.hooks'
import type { StockItemWithInventoryItem } from '@/features/logistics/stock-items.types'
import { formatStockCents, parseStockCents, stockSortKey } from '@/features/logistics/stock-display'
import { formatProductUnit } from '@/lib/product-unit'
import { getErrorMessage } from '@/lib/api-client'
import { DataTable, type ColumnDef } from '@/components/ui/data-table'
import { OverflowValue } from '@/components/ui/OverflowValue'
import { SearchableDropdown } from '@/components/ui/SearchableDropdown'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

export function StockAlertSettings({ onClose }: { onClose: () => void }) {
  const { isAdmin, isManager } = useAuth()
  const canEdit = isAdmin || isManager
  const warehouses = useWarehouses()
  const [warehouseId, setWarehouseId] = useState<number>()
  const selectedId = warehouseId ?? warehouses.data?.find((warehouse) => warehouse.isActive)?.id
  const stock = useWarehouseStock(selectedId)
  const { drafts, change, save, pending } = useStockAlertEditors(canEdit)
  const columns: ColumnDef<StockItemWithInventoryItem>[] = [
    {
      id: 'product',
      header: 'Product',
      width: '34%',
      sortable: true,
      sortKey: (row) => row.inventoryItem?.name ?? '',
      cell: ({ row }) => (
        <div className="flex min-w-0 flex-col gap-1">
          <OverflowValue
            value={row.inventoryItem?.name ?? `Stock item #${row.id}`}
            className="font-medium"
          />
          <OverflowValue
            value={formatProductUnit(row.inventoryItem?.unit, 'units')}
            className="text-xs text-muted-foreground"
          />
        </div>
      ),
    },
    {
      id: 'available',
      header: 'Available',
      width: '22%',
      align: 'right',
      sortable: true,
      sortKey: (row) => stockSortKey(parseStockCents(row.availableQuantity)),
      cell: ({ row }) => (
        <OverflowValue
          value={formatStockCents(parseStockCents(row.availableQuantity))}
          tooltipSuffix={formatProductUnit(row.inventoryItem?.unit, 'units')}
          className="text-right tabular-nums"
        />
      ),
    },
    {
      id: 'threshold',
      header: 'Reorder Threshold',
      width: '44%',
      cell: ({ row }) => {
        if (!canEdit)
          return (
            <OverflowValue
              value={
                row.reorderThreshold == null
                  ? 'Not configured'
                  : formatStockCents(parseStockCents(row.reorderThreshold))
              }
              className="tabular-nums"
            />
          )
        const draft = drafts[row.id]
        const value = draft?.value ?? row.reorderThreshold ?? ''
        const saving = draft?.status === 'pending'
        const name = row.inventoryItem?.name ?? `Stock item #${row.id}`
        const messageId = `threshold-message-${row.id}`
        return (
          <form
            onSubmit={(event) => {
              event.preventDefault()
              void save(row)
            }}
            className="flex min-w-0 flex-col gap-1.5"
          >
            <div className="flex items-center gap-2">
              <Input
                aria-label={`Reorder threshold for ${name}`}
                aria-invalid={!!draft?.error}
                aria-describedby={
                  draft?.error || draft?.status === 'saved' ? messageId : 'threshold-help'
                }
                inputMode="decimal"
                placeholder="Not set"
                value={value}
                onChange={(event) => change(row.id, event.target.value)}
                disabled={saving}
                className="h-9 min-w-0 tabular-nums"
              />
              <Button
                type="submit"
                variant="outline"
                size="sm"
                disabled={saving || !thresholdChanged(value, row.reorderThreshold)}
                aria-label={`Save threshold for ${name}`}
              >
                {saving ? 'Saving…' : 'Save'}
              </Button>
            </div>
            {draft?.error && (
              <p id={messageId} role="alert" className="whitespace-normal text-xs text-destructive">
                {draft.error}
              </p>
            )}
            {draft?.status === 'saved' && (
              <p id={messageId} role="status" className="text-xs text-muted-foreground">
                Saved
              </p>
            )}
          </form>
        )
      },
    },
  ]
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !pending) onClose()
      }}
    >
      <DialogContent
        className="flex max-h-[90dvh] flex-col overflow-hidden sm:max-w-3xl"
        closeDisabled={pending}
      >
        <DialogHeader className="shrink-0 pr-8">
          <DialogTitle>Stock Alert Settings</DialogTitle>
          <DialogDescription>
            Configure low-stock warnings for each product at a warehouse. Warnings use the available
            stock reported by the server.
          </DialogDescription>
        </DialogHeader>
        <div className="flex min-h-0 flex-col gap-4 overflow-y-auto">
          {!canEdit && (
            <Alert>
              <AlertDescription>
                View only. An admin or manager can change stock alert settings.
              </AlertDescription>
            </Alert>
          )}
          <div className="flex min-w-0 flex-col gap-2">
            <Label htmlFor="stock-alert-warehouse">Warehouse</Label>
            <SearchableDropdown
              id="stock-alert-warehouse"
              ariaLabel="Stock alert warehouse"
              options={(warehouses.data ?? []).filter((warehouse) => warehouse.isActive)}
              value={selectedId === undefined ? '' : String(selectedId)}
              onValueChange={(value) => setWarehouseId(Number(value))}
              getOptionValue={(warehouse) => String(warehouse.id)}
              getOptionLabel={(warehouse) => warehouse.name}
              placeholder={warehouses.isLoading ? 'Loading warehouses…' : 'Select a warehouse'}
              searchPlaceholder="Search warehouses…"
              emptyMessage="No warehouses found."
              disabled={pending || warehouses.isLoading || warehouses.isError}
              className="w-full sm:max-w-sm"
            />
          </div>
          <p id="threshold-help" className="text-xs text-muted-foreground">
            Save each row separately. Leave a threshold blank and save to disable its low-stock
            warning. Out-of-stock warnings remain active.
          </p>
          {warehouses.isError || stock.isError ? (
            <Alert variant="destructive">
              <AlertDescription>
                Stock alert settings could not be loaded.{' '}
                {getErrorMessage(warehouses.error ?? stock.error)}
                <Button
                  variant="link"
                  size="sm"
                  disabled={pending}
                  onClick={() => {
                    void warehouses.refetch()
                    if (selectedId !== undefined) void stock.reload()
                  }}
                >
                  Refresh stock list
                </Button>
              </AlertDescription>
            </Alert>
          ) : selectedId === undefined && !warehouses.isLoading ? (
            <p className="text-sm text-muted-foreground">No active warehouses are available.</p>
          ) : (
            <DataTable
              key={selectedId}
              data={stock.data ?? []}
              columns={columns}
              getRowKey={(row) => row.id}
              isLoading={warehouses.isLoading || stock.isLoading}
              loadingMessage="Loading stock alert settings…"
              defaultSort={{ key: 'product', direction: 'asc' }}
              className="shrink-0"
              emptyContent={
                <p className="text-sm text-muted-foreground">No products in this warehouse.</p>
              }
              tableClassName="min-w-[600px] w-full table-fixed"
            />
          )}
          {selectedId !== undefined && !pending && <StockPagingControls {...stock} />}
          {!warehouses.isError && !stock.isError && (
            <Button
              variant="link"
              size="sm"
              className="self-start"
              disabled={pending || stock.isFetching || selectedId === undefined}
              onClick={() => void stock.reload()}
            >
              Refresh stock list
            </Button>
          )}
        </div>
        <DialogFooter className="shrink-0">
          <Button variant="outline" onClick={onClose} disabled={pending}>
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
