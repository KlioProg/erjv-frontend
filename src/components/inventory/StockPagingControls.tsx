import { Button } from '@/components/ui/button'

type StockPagingControlsProps = {
  hasNextPage: boolean
  isFetchingNextPage: boolean
  fetchNextPage: () => Promise<unknown>
}

export function StockPagingControls({ hasNextPage, isFetchingNextPage, fetchNextPage }: StockPagingControlsProps) {
  if (!hasNextPage) return null
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
      {hasNextPage && <span>More stock records are available. Totals remain unavailable until all records are loaded.</span>}
      {hasNextPage && (
        <Button variant="outline" size="sm" disabled={isFetchingNextPage} onClick={() => void fetchNextPage()}>
          {isFetchingNextPage ? 'Loading stock records...' : 'Load more stock records'}
        </Button>
      )}
    </div>
  )
}
