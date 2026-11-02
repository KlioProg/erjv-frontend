import { useState } from 'react'
import { Link, useOutletContext } from 'react-router'
import { useQueryClient } from '@tanstack/react-query'
import { CheckCircle2, RefreshCw } from 'lucide-react'
import { useAuth } from '@/features/auth/AuthContext'
import { useStockWarnings } from '@/features/logistics/stock-warnings.hooks'
import { useDashboardDeliveries } from '@/features/logistics/use-dashboard-deliveries'
import type { InventoryNavigationTarget } from '@/features/logistics/stock-warnings'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/ui/ManagementPage'
import { DashboardFinancialOverview } from './DashboardFinancialOverview'
import { DashboardDataTimes } from './DashboardDataTimes'
import type { DashboardOutletContext } from './MainDashboard'
import { ROUTES } from '@/routes'

function countLabel(count: number, complete: boolean) {
  return complete
    ? count.toLocaleString()
    : count > 0
      ? `${count.toLocaleString()}+`
      : 'Not verified'
}

export function DashboardPage() {
  const { isAdmin, isManager } = useAuth()
  const { onOpenInventory } = useOutletContext<DashboardOutletContext>()
  const [now, setNow] = useState(() => new Date())
  const client = useQueryClient()
  const inventory = useStockWarnings()
  const deliveries = useDashboardDeliveries()
  const [refreshing, setRefreshing] = useState(false)
  const [visibleTasks, setVisibleTasks] = useState(4)
  const previews = [
    {
      label: 'Awaiting receipt',
      description: 'Incoming deliveries',
      href: ROUTES.incomingDeliveries,
      query: deliveries.incoming,
    },
    {
      label: 'Ready to assign',
      description: 'Outgoing deliveries',
      href: ROUTES.outgoingDeliveries,
      query: deliveries.outgoing,
    },
    {
      label: 'Draft runs',
      description: 'Delivery runs',
      href: ROUTES.deliveryRuns,
      query: deliveries.drafts,
    },
    {
      label: 'Dispatched runs',
      description: 'Delivery runs',
      href: ROUTES.deliveryRuns,
      query: deliveries.dispatched,
    },
  ]
  const stockVerified = inventory.verified
  const complete =
    stockVerified &&
    !inventory.refreshing &&
    previews.every(
      ({ query }) => !query.isPending && !query.isFetching && !query.isError && !query.hasNext,
    )
  const attention: {
    id: string
    priority: number
    label: string
    detail: string
    target?: InventoryNavigationTarget
    href: string
  }[] = [
    ...inventory.warnings.map((warning) => ({
      id: warning.id,
      priority: warning.severity === 'OUT' ? 0 : 1,
      label: `${warning.productName} · ${warning.locationName}`,
      detail: warning.severity === 'OUT' ? 'Out of available stock' : 'Low available stock',
      target: warning,
      href: ROUTES.inventory,
    })),
    ...deliveries.incoming.items
      .filter((item) => item.scheduledAt && Date.parse(item.scheduledAt) < now.getTime())
      .map((item) => ({
        id: `incoming:${item.id}`,
        priority: 1,
        label: item.deliveryNumber,
        detail: 'Overdue incoming · receiving required',
        href: ROUTES.incomingDeliveries,
      })),
    ...deliveries.dispatched.items
      .filter((run) => run.deliveries.some((member) => member.status === 'DISPATCHED'))
      .map((run) => {
        const count = run.deliveries.filter((member) => member.status === 'DISPATCHED').length
        return {
          id: `run:${run.id}`,
          priority: 1,
          label: run.runNumber,
          detail: `${count} ${count === 1 ? 'delivery' : 'deliveries'} awaiting reconciliation`,
          href: `${ROUTES.deliveryRuns}?run=${run.id}`,
        }
      }),
    ...deliveries.outgoing.items.map((item) => ({
      id: `outgoing:${item.id}`,
      priority: 2,
      label: item.deliveryNumber,
      detail: 'Ready for run assignment',
      href: ROUTES.outgoingDeliveries,
    })),
  ].sort((a, b) => a.priority - b.priority)
  const refresh = async () => {
    setRefreshing(true)
    setNow(new Date())
    try {
      await Promise.all([
        inventory.refresh(),
        ...previews.map(({ query }) => query.reload()),
        ...(isAdmin || isManager
          ? [client.invalidateQueries({ queryKey: ['financial-reports'] })]
          : []),
      ])
    } finally {
      setRefreshing(false)
    }
  }
  return (
    <div className="min-w-0 space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <PageHeader description="Business overview">Dashboard</PageHeader>
        <div className="flex flex-wrap items-center gap-3">
          <time className="text-sm text-muted-foreground" dateTime={now.toISOString()}>
            {new Intl.DateTimeFormat('en-PH', {
              timeZone: 'Asia/Manila',
              dateStyle: 'long',
            }).format(now)}
          </time>
          <Button variant="outline" size="sm" onClick={() => void refresh()} disabled={refreshing}>
            <RefreshCw className="size-4" />
            {refreshing ? 'Refreshing…' : 'Refresh'}
          </Button>
        </div>
      </div>
      {(isAdmin || isManager) && <DashboardFinancialOverview now={now} />}
      <div className="grid items-start gap-4 xl:grid-cols-2">
        <section
          aria-labelledby="inventory-overview"
          className="min-w-0 space-y-3 rounded-lg border p-4"
        >
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 id="inventory-overview" className="text-base font-semibold">
              Inventory Overview
            </h2>
            <Link
              to={ROUTES.inventory}
              className="text-sm font-medium underline underline-offset-4"
            >
              View Inventory
            </Link>
          </div>
          <div className="grid divide-y sm:grid-cols-3 sm:divide-x sm:divide-y-0">
            {(['LOW', 'OUT'] as const).map((severity) => (
              <button
                key={severity}
                className="flex min-h-11 min-w-0 items-center justify-between gap-3 rounded py-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring hover:bg-muted/40 sm:block sm:px-3 sm:py-1 sm:first:pl-0"
                onClick={() => onOpenInventory({ warningFilter: severity })}
              >
                <h3 className="text-sm font-medium">
                  {severity === 'OUT' ? 'Out of Stock' : 'Low Stock'}
                </h3>
                <p className="break-words text-xl font-semibold tabular-nums sm:mt-1">
                  {inventory.unavailable
                    ? 'Unavailable'
                    : inventory.loading
                      ? 'Loading…'
                      : countLabel(
                          inventory.warnings.filter((warning) => warning.severity === severity)
                            .length,
                          stockVerified,
                        )}
                </p>
              </button>
            ))}
            <Link
              to={ROUTES.warehouses}
              className="flex min-h-11 min-w-0 items-center justify-between gap-3 rounded py-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring hover:bg-muted/40 sm:block sm:py-1 sm:pl-3"
            >
              <h3 className="text-sm font-medium">Active Warehouses</h3>
              <p className="break-words text-xl font-semibold tabular-nums sm:mt-1">
                {inventory.unavailable
                  ? 'Unavailable'
                  : inventory.loading
                    ? 'Loading…'
                    : countLabel(inventory.warehouses.length, inventory.complete)}
              </p>
            </Link>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-1">
            <details className="text-sm text-muted-foreground">
              <summary className="min-h-11 cursor-pointer rounded py-3 font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                About stock counts
              </summary>
              <p>
                Warnings count warehouse-product locations using configured thresholds. Available
                stock can differ from on-hand stock because of reservations, transit or quarantine.
                Active Warehouses counts active locations. A + marks a verified minimum while more
                data needs checking.
              </p>
            </details>
            {(inventory.unavailable ||
              inventory.loading ||
              inventory.refreshing ||
              !stockVerified) && (
              <p className="text-sm text-muted-foreground" role="status">
                {inventory.unavailable
                  ? 'Stock information unavailable. Refresh to try again.'
                  : inventory.loading
                    ? 'Loading stock information…'
                    : inventory.refreshing
                      ? 'Refreshing stock information…'
                      : !stockVerified
                        ? 'Partial stock counts. Open Inventory to verify.'
                        : ''}
              </p>
            )}
          </div>
        </section>
        <section aria-labelledby="needs-attention" className="min-w-0 rounded-lg border p-4">
          <h2 id="needs-attention" className="text-base font-semibold">
            Needs Attention
          </h2>
          {!complete && (
            <p className="mt-2 text-xs text-muted-foreground" role="status">
              {inventory.unavailable || previews.some(({ query }) => query.isError)
                ? 'Some information is unavailable. More tasks may need attention.'
                : inventory.loading ||
                    inventory.refreshing ||
                    previews.some(({ query }) => query.isPending || query.isFetching)
                  ? attention.length > 0
                    ? 'Updating…'
                    : 'Loading tasks…'
                  : 'Partial results. More tasks may need attention.'}
            </p>
          )}
          <ul className="mt-1 divide-y">
            {attention.slice(0, visibleTasks).map((item) => {
              const content = (
                <>
                  <span
                    className={item.priority === 0 ? 'font-medium text-destructive' : 'font-medium'}
                  >
                    {item.label}
                  </span>
                  <span className="mt-1 block text-sm text-muted-foreground">{item.detail}</span>
                </>
              )
              const className =
                'block w-full min-h-11 min-w-0 rounded py-2 text-left break-words focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring hover:bg-muted/40'
              return (
                <li key={item.id} className="min-w-0">
                  {item.target ? (
                    <button
                      className={className}
                      onClick={() => item.target && onOpenInventory(item.target)}
                    >
                      {content}
                    </button>
                  ) : (
                    <Link className={className} to={item.href}>
                      {content}
                    </Link>
                  )}
                </li>
              )
            })}
          </ul>
          {attention.length === 0 && complete && (
            <p className="mt-2 flex items-center gap-2 text-sm" role="status">
              <CheckCircle2 className="size-4 text-primary" aria-hidden="true" />
              Nothing needs attention.
            </p>
          )}
          {attention.length > visibleTasks && (
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs text-muted-foreground">
                Showing {visibleTasks} of {attention.length} loaded tasks.
              </p>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setVisibleTasks((count) => count + 4)}
              >
                Show more tasks
              </Button>
            </div>
          )}
        </section>
      </div>
      <section aria-labelledby="delivery-status" className="min-w-0 rounded-lg border px-4 pb-3">
        <div className="flex flex-wrap items-center justify-between gap-x-6">
          <h2 id="delivery-status" className="text-base font-semibold">
            Delivery Status
          </h2>
          <DashboardDataTimes
            label="Update times"
            sources={previews.map(({ label, query }) => ({
              label,
              time: query.dataUpdatedAt || undefined,
              status: query.isError
                ? 'Unavailable'
                : query.isPending
                  ? 'Loading…'
                  : query.isFetching
                    ? 'Refreshing…'
                    : undefined,
            }))}
          />
        </div>
        <ul className="mt-1 grid gap-x-6 gap-y-2 sm:grid-cols-2 xl:grid-cols-4">
          {previews.map(({ label, description, href, query }) => (
            <li key={label} className="min-w-0">
              <Link
                to={href}
                className="flex min-h-14 items-center justify-between gap-3 rounded py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring hover:bg-muted/40"
              >
                <span className="min-w-0">
                  <span className="block text-sm font-medium">{label}</span>
                  <span className="block text-xs text-muted-foreground">
                    {description}
                    {query.hasNext ? ' · Partial count' : ''}
                  </span>
                </span>
                <span className="shrink-0 text-sm font-semibold tabular-nums" aria-live="polite">
                  {query.isError
                    ? 'Unavailable'
                    : query.isPending
                      ? 'Loading…'
                      : countLabel(query.items.length, !query.hasNext)}
                </span>
              </Link>
              {query.isError && (
                <Button variant="ghost" size="sm" onClick={() => void query.reload()}>
                  Retry {label}
                </Button>
              )}
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
