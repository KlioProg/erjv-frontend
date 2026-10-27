import { DataTable, type DataTableProps } from '@/components/ui/data-table'
import { cn } from '@/lib/utils'

export function OrderItemsTable<T>({
  className,
  ...props
}: Pick<DataTableProps<T>, 'data' | 'columns' | 'getRowKey' | 'renderExpandedRow' | 'className'>) {
  return (
    <DataTable
      {...props}
      pagination={false}
      className={cn('order-entry-items h-auto shrink-0 shadow-none', className)}
      tableClassName="h-auto table-fixed [&_th]:h-11 [&_th]:text-ui [&_td]:py-2 [&_td]:text-sm"
      emptyContent={
        <p className="px-4 py-5 text-center text-ui text-muted-foreground">
          No items added yet. Select a product from the catalog to begin.
        </p>
      }
    />
  )
}
