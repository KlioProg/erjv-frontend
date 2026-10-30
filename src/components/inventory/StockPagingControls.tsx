import { Button } from '@/components/ui/button'

type StockPagingControlsProps = {
  hasNextPage: boolean
  isFetchingNextPage: boolean
  fetchNextPage: () => Promise<unknown>
  reload: () => Promise<unknown>
}

export function StockPagingControls({ hasNextPage, isFetchingNextPage, fetchNextPage, reload }: StockPagingControlsProps) {
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
      {hasNextPage && <span>More stock records are available. Totals remain unavailable until all records are loaded.</span>}
      {hasNextPage && (
        <Button variant="outline" size="sm" disabled={isFetchingNextPage} onClick={() => void fetchNextPage()}>
          {isFetchingNextPage ? 'Loading stock records...' : 'Load more stock records'}
        </Button>
      )}
      <Button variant="ghost" size="sm" onClick={() => void reload()}>Reload stock records</Button>
    </div>
  )
}
