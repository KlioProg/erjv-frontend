import { useState, useMemo } from 'react'
import {
  CalendarPlus,
  SlidersHorizontal,
  CheckCircle2,
  History,
  Truck,
  ChevronRight,
} from 'lucide-react'
import { useOutgoingDeliveries } from '@/features/logistics/outgoing-deliveries.hooks'
import { useDeliveryVehicles } from '@/features/logistics/delivery-vehicles.hooks'
import { useSalesOrders } from '@/features/crm/sales-orders.hooks'
import { ScheduleDeliveryView } from './ScheduleDeliveryView'
import { DeliveryStatusControlView } from './DeliveryStatusControlView'
import { RecordCompletedDeliveryView } from './RecordCompletedDeliveryView'
import { VehicleDeliveryHistoryView } from './VehicleDeliveryHistoryView'

type DeliverySubTab = 'schedule' | 'status' | 'completed' | 'history'

interface TabConfig {
  key: DeliverySubTab
  label: string
  icon: React.ComponentType<{ className?: string }>
  badgeCount?: number
  badgeVariant?: 'default' | 'amber' | 'blue' | 'emerald'
}

const TAB_DESCRIPTIONS: Record<DeliverySubTab, string> = {
  schedule: 'Match confirmed customer sales orders to warehouse stock allocations and plan shipments.',
  status: 'Assign available fleet vehicles and drivers, manage shipment schedules, and dispatch trucks.',
  completed: 'Welcome arriving trucks at customer destinations and record verified delivery receipts.',
  history: 'Audit fleet vehicle trip histories, delivery success rates, and manage vehicle readiness.',
}

export function DeliveriesHub() {
  const [activeTab, setActiveTab] = useState<DeliverySubTab>('schedule')

  const { data: deliveries = [] } = useOutgoingDeliveries()
  const { data: vehicles = [] } = useDeliveryVehicles()
  const { data: salesOrders = [] } = useSalesOrders()

  const readyOrdersCount = useMemo(
    () =>
      salesOrders.filter(
        (o) => o.status === 'CONFIRMED' || o.status === 'PARTIALLY_DELIVERED',
      ).length,
    [salesOrders],
  )

  const metrics = useMemo(() => {
    const drafts = deliveries.filter((d) => d.status === 'DRAFT').length
    const scheduled = deliveries.filter((d) => d.status === 'SCHEDULED').length
    const dispatched = deliveries.filter((d) => d.status === 'DISPATCHED').length
    const delivered = deliveries.filter((d) => d.status === 'DELIVERED').length
    const availableFleet = vehicles.filter((v) => v.status === 'AVAILABLE').length

    return { drafts, scheduled, dispatched, delivered, availableFleet, totalFleet: vehicles.length }
  }, [deliveries, vehicles])

  const subTabs: TabConfig[] = [
    {
      key: 'schedule',
      label: 'Schedule Orders',
      icon: CalendarPlus,
      badgeCount: readyOrdersCount,
      badgeVariant: readyOrdersCount > 0 ? 'amber' : 'default',
    },
    {
      key: 'status',
      label: 'Dispatch Operations',
      icon: SlidersHorizontal,
      badgeCount: metrics.scheduled,
      badgeVariant: 'blue',
    },
    {
      key: 'completed',
      label: 'Confirm Arrivals',
      icon: CheckCircle2,
      badgeCount: metrics.dispatched,
      badgeVariant: 'amber',
    },
    {
      key: 'history',
      label: 'Fleet & Vehicle Logs',
      icon: History,
    },
  ]

  return (
    <div className="flex flex-col gap-6">
      {/* Refined Minimalist Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-border/60">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground">Deliveries & Logistics</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Coordinate warehouse dispatches, monitor active transit routes, and verify delivered goods.
          </p>
        </div>

        {/* Quiet status pill on the right */}
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-border/80 bg-muted/30 text-xs font-medium text-muted-foreground">
            <Truck className="size-3.5 text-primary shrink-0" />
            <span>Fleet Standby:</span>
            <span className="font-semibold font-mono text-foreground">
              {metrics.availableFleet} of {metrics.totalFleet} available
            </span>
          </div>
        </div>
      </div>

      {/* Sleek Connected Logistics Pipeline Strip */}
      <div className="flex items-center gap-1.5 p-1.5 bg-muted/40 border border-border/70 rounded-2xl overflow-x-auto">
        {subTabs.map((tab, idx) => {
          const Icon = tab.icon
          const isActive = activeTab === tab.key

          let badgeColor = 'bg-muted text-muted-foreground'
          if (isActive) {
            badgeColor = 'bg-primary/10 text-primary font-bold border border-primary/20'
          } else if (tab.badgeVariant === 'amber' && typeof tab.badgeCount === 'number' && tab.badgeCount > 0) {
            badgeColor = 'bg-amber-500/15 text-amber-600 dark:text-amber-400 font-bold'
          } else if (tab.badgeVariant === 'blue' && typeof tab.badgeCount === 'number' && tab.badgeCount > 0) {
            badgeColor = 'bg-blue-500/15 text-blue-600 dark:text-blue-400 font-bold'
          }

          return (
            <div key={tab.key} className="flex items-center gap-1.5 shrink-0">
              <button
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer whitespace-nowrap select-none ${
                  isActive
                    ? 'bg-background text-foreground shadow-xs border border-border/80 ring-1 ring-black/5 dark:ring-white/10'
                    : 'text-muted-foreground hover:text-foreground hover:bg-background/60'
                }`}
              >
                <Icon className={`size-3.5 shrink-0 ${isActive ? 'text-primary' : 'text-muted-foreground'}`} />
                <span>{tab.label}</span>
                {typeof tab.badgeCount === 'number' && tab.badgeCount > 0 && (
                  <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full ${badgeColor}`}>
                    {tab.badgeCount}
                  </span>
                )}
              </button>

              {/* Directional pipeline flow indicator between lifecycle stages */}
              {idx < 2 && (
                <ChevronRight className="size-3.5 text-muted-foreground/40 shrink-0 hidden sm:block" />
              )}

              {/* Distinct separator for Fleet & Vehicle Logs */}
              {idx === 2 && (
                <div className="h-4 w-px bg-border/80 mx-1 shrink-0 hidden sm:block" />
              )}
            </div>
          )
        })}
      </div>

      {/* Main Sub-Tab Body with Context Hint */}
      <div className="flex flex-col gap-5 pt-0.5">
        <p className="text-xs text-muted-foreground/90 font-medium">
          {TAB_DESCRIPTIONS[activeTab]}
        </p>

        {activeTab === 'schedule' && <ScheduleDeliveryView />}
        {activeTab === 'status' && <DeliveryStatusControlView />}
        {activeTab === 'completed' && <RecordCompletedDeliveryView />}
        {activeTab === 'history' && <VehicleDeliveryHistoryView />}
      </div>
    </div>
  )
}
