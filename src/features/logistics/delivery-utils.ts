import type { OutgoingDeliveryStatus } from './outgoing-deliveries.types'
import type { DeliveryRunRecord } from './delivery-runs.types'
import type { DeliveryVehicle, VehicleStatus } from './delivery-vehicles.types'

export interface DeliveryStatusConfig {
  label: string
  badgeClass: string
  dotClass: string
  description: string
}

export interface VehicleStatusConfig {
  label: string
  badgeClass: string
  dotClass: string
  description: string
}

export class DeliveryUtils {
  private static readonly STATUS_MAP: Record<OutgoingDeliveryStatus, DeliveryStatusConfig> = {
    DRAFT: {
      label: 'Draft',
      badgeClass: 'bg-muted/70 text-muted-foreground border-border',
      dotClass: 'bg-muted-foreground',
      description: 'Delivery draft awaiting readiness confirmation',
    },
    READY: {
      label: 'Ready',
      badgeClass: 'bg-status-info text-status-info-foreground border-status-info-foreground/20',
      dotClass: 'bg-status-info-foreground',
      description: 'Ready for assignment to a delivery run',
    },
    DISPATCHED: {
      label: 'In Transit',
      badgeClass:
        'bg-status-warning text-status-warning-foreground border-status-warning-foreground/20',
      dotClass: 'bg-status-warning-foreground',
      description: 'Vehicle & driver dispatched, en route to destination',
    },
    RECONCILED: {
      label: 'Reconciled',
      badgeClass:
        'bg-status-success text-status-success-foreground border-status-success-foreground/20',
      dotClass: 'bg-status-success-foreground',
      description: 'Loaded goods reconciled against deliveries and returns',
    },
    CANCELLED: {
      label: 'Cancelled',
      badgeClass: 'bg-destructive/10 text-destructive border-destructive/20',
      dotClass: 'bg-destructive',
      description: 'Shipment cancelled before dispatch',
    },
  }

  private static readonly VEHICLE_STATUS_MAP: Record<VehicleStatus, VehicleStatusConfig> = {
    AVAILABLE: {
      label: 'Available',
      badgeClass:
        'bg-status-success text-status-success-foreground border-status-success-foreground/20',
      dotClass: 'bg-status-success-foreground',
      description: 'Ready for assignment and dispatch',
    },
    IN_DELIVERY: {
      label: 'In Delivery',
      badgeClass:
        'bg-status-warning text-status-warning-foreground border-status-warning-foreground/20',
      dotClass: 'bg-status-warning-foreground',
      description: 'Currently out on active shipment route',
    },
    MAINTENANCE: {
      label: 'Maintenance',
      badgeClass:
        'bg-status-warning text-status-warning-foreground border-status-warning-foreground/20',
      dotClass: 'bg-status-warning-foreground',
      description: 'Under inspection or mechanical repair',
    },
    OUT_OF_SERVICE: {
      label: 'Out of Service',
      badgeClass: 'bg-destructive/10 text-destructive border-destructive/20',
      dotClass: 'bg-destructive',
      description: 'Decommissioned or unavailable for operations',
    },
  }

  public static getStatusConfig(status: OutgoingDeliveryStatus): DeliveryStatusConfig {
    return (
      this.STATUS_MAP[status] || {
        label: status,
        badgeClass: 'bg-muted text-muted-foreground',
        dotClass: 'bg-muted-foreground',
        description: 'Unknown delivery status',
      }
    )
  }

  public static getVehicleStatusConfig(status: VehicleStatus): VehicleStatusConfig {
    return (
      this.VEHICLE_STATUS_MAP[status] || {
        label: status,
        badgeClass: 'bg-muted text-muted-foreground',
        dotClass: 'bg-muted-foreground',
        description: 'Unknown vehicle status',
      }
    )
  }

  public static formatDateTime(dateStr?: string | Date | null): string {
    if (!dateStr) return '—'
    const date = typeof dateStr === 'string' ? new Date(dateStr) : dateStr
    if (isNaN(date.getTime())) return '—'
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    })
  }

  public static formatDateOnly(dateStr?: string | Date | null): string {
    if (!dateStr) return '—'
    const date = typeof dateStr === 'string' ? new Date(dateStr) : dateStr
    if (isNaN(date.getTime())) return '—'
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }

  public static toDateTimeInput(value: string | Date): string {
    const date = new Date(value)
    if (isNaN(date.getTime())) return ''
    const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
    return local.toISOString().slice(0, 16)
  }

  public static getStepIndex(status: OutgoingDeliveryStatus): number {
    switch (status) {
      case 'DRAFT':
        return 0
      case 'READY':
        return 1
      case 'DISPATCHED':
        return 2
      case 'RECONCILED':
        return 3
      case 'CANCELLED':
        return -1
      default:
        return 0
    }
  }

  public static canSchedule(status: OutgoingDeliveryStatus): boolean {
    return status === 'DRAFT'
  }

  public static canDispatch(status: OutgoingDeliveryStatus): boolean {
    return status === 'READY'
  }

  public static canComplete(status: OutgoingDeliveryStatus): boolean {
    return status === 'DISPATCHED'
  }

  public static canCancel(status: OutgoingDeliveryStatus): boolean {
    return status === 'DRAFT' || status === 'READY'
  }

  public static getVehicleAvailability(
    vehicle: Pick<DeliveryVehicle, 'id' | 'operationalStatus' | 'isActive' | 'isAvailable' | 'activeRunId'>,
    runs: DeliveryRunRecord[],
    currentRunId?: number,
  ): { isAvailable: boolean; reason?: string } {
    if (!vehicle.isActive) return { isAvailable: false, reason: 'Deactivated' }
    if (vehicle.operationalStatus === 'MAINTENANCE')
      return { isAvailable: false, reason: 'In Maintenance' }
    if (vehicle.operationalStatus === 'OUT_OF_SERVICE')
      return { isAvailable: false, reason: 'Out of Service' }
    const assigned = runs.find((run) =>
      run.id !== currentRunId && run.deliveryVehicleId === vehicle.id && run.status === 'DISPATCHED',
    )
    if (assigned) return { isAvailable: false, reason: `In Transit (${assigned.runNumber})` }
    if (!vehicle.isAvailable && (currentRunId === undefined || vehicle.activeRunId !== currentRunId))
      return { isAvailable: false, reason: 'In Transit' }
    return { isAvailable: true }
  }

  public static getDriverAvailability(
    driver: { id: number; isActive: boolean },
    runs: DeliveryRunRecord[],
    currentRunId?: number,
  ): { isAvailable: boolean; reason?: string } {
    if (!driver.isActive) return { isAvailable: false, reason: 'Inactive' }
    const assigned = runs.find((run) =>
      run.id !== currentRunId && run.driverEmployeeId === driver.id && run.status === 'DISPATCHED',
    )
    return assigned
      ? { isAvailable: false, reason: `On Route (${assigned.runNumber})` }
      : { isAvailable: true }
  }
}
