import { DataTable, type DataTableProps } from '@/components/ui/data-table'

export function OrderItemsTable<T>(
  props: Pick<DataTableProps<T>, 'data' | 'columns' | 'getRowKey' | 'renderExpandedRow'>,
) {
  return (
    <DataTable
      {...props}
      pagination={false}
      className="order-entry-items h-auto shrink-0 shadow-none"
      tableClassName="h-auto table-fixed [&_th]:h-11 [&_th]:text-[13px] [&_td]:py-2 [&_td]:text-sm"
      emptyContent={
        <p className="rounded-lg border border-dashed px-4 py-5 text-center text-[13px] text-muted-foreground">
          No items added yet. Select a product from the catalog to begin.
        </p>
      }
    />
  )
}
