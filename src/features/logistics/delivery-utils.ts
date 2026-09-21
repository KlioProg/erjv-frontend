import type { OutgoingDeliveryStatus } from './outgoing-deliveries.types'
import type { VehicleStatus } from './delivery-vehicles.types'

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
      description: 'Shipment created, waiting to be scheduled',
    },
    SCHEDULED: {
      label: 'Scheduled',
      badgeClass: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
      dotClass: 'bg-blue-500',
      description: 'Scheduled for dispatch with allocated inventory',
    },
    DISPATCHED: {
      label: 'In Transit',
      badgeClass: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
      dotClass: 'bg-amber-500 animate-pulse',
      description: 'Vehicle & driver dispatched, en route to destination',
    },
    DELIVERED: {
      label: 'Delivered',
      badgeClass: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
      dotClass: 'bg-emerald-500',
      description: 'Successfully delivered and stock deducted',
    },
    CANCELLED: {
      label: 'Cancelled',
      badgeClass: 'bg-rose-500/10 text-rose-600 border-rose-500/20',
      dotClass: 'bg-rose-500',
      description: 'Shipment cancelled and allocations released',
    },
  }

  private static readonly VEHICLE_STATUS_MAP: Record<VehicleStatus, VehicleStatusConfig> = {
    AVAILABLE: {
      label: 'Available',
      badgeClass: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
      dotClass: 'bg-emerald-500',
      description: 'Ready for assignment and dispatch',
    },
    IN_DELIVERY: {
      label: 'In Delivery',
      badgeClass: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
      dotClass: 'bg-amber-500 animate-pulse',
      description: 'Currently out on active shipment route',
    },
    MAINTENANCE: {
      label: 'Maintenance',
      badgeClass: 'bg-orange-500/10 text-orange-600 border-orange-500/20',
      dotClass: 'bg-orange-500',
      description: 'Under inspection or mechanical repair',
    },
    OUT_OF_SERVICE: {
      label: 'Out of Service',
      badgeClass: 'bg-rose-500/10 text-rose-600 border-rose-500/20',
      dotClass: 'bg-rose-500',
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

  public static getStepIndex(status: OutgoingDeliveryStatus): number {
    switch (status) {
      case 'DRAFT':
        return 0
      case 'SCHEDULED':
        return 1
      case 'DISPATCHED':
        return 2
      case 'DELIVERED':
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
    return status === 'SCHEDULED'
  }

  public static canComplete(status: OutgoingDeliveryStatus): boolean {
    return status === 'DISPATCHED'
  }

  public static canCancel(status: OutgoingDeliveryStatus): boolean {
    return ['DRAFT', 'SCHEDULED', 'DISPATCHED'].includes(status)
  }

  public static getVehicleAvailability(
    vehicle: { id: number; status: VehicleStatus; isActive: boolean },
    deliveries: { id: number; deliveryNumber: string; deliveryVehicleId: number | null; status: OutgoingDeliveryStatus }[],
    currentDeliveryId?: number,
  ): { isAvailable: boolean; reason?: string } {
    if (!vehicle.isActive) {
      return { isAvailable: false, reason: 'Deactivated' }
    }
    if (vehicle.status === 'MAINTENANCE') {
      return { isAvailable: false, reason: 'In Maintenance' }
    }
    if (vehicle.status === 'IN_DELIVERY') {
      const activeDelivery = deliveries.find(
        (d) =>
          d.id !== currentDeliveryId &&
          d.deliveryVehicleId === vehicle.id &&
          d.status === 'DISPATCHED',
      )
      return {
        isAvailable: false,
        reason: activeDelivery ? `In Transit (${activeDelivery.deliveryNumber})` : 'In Transit',
      }
    }

    const assignedDelivery = deliveries.find(
      (d) =>
        d.id !== currentDeliveryId &&
        d.deliveryVehicleId === vehicle.id &&
        (d.status === 'SCHEDULED' || d.status === 'DISPATCHED'),
    )

    if (assignedDelivery) {
      const stateLabel = assignedDelivery.status === 'DISPATCHED' ? 'In Transit' : 'Scheduled'
      return {
        isAvailable: false,
        reason: `${stateLabel} (${assignedDelivery.deliveryNumber})`,
      }
    }

    return { isAvailable: true }
  }

  public static getDriverAvailability(
    driver: { id: number; isActive: boolean },
    deliveries: { id: number; deliveryNumber: string; driverEmployeeId: number | null; status: OutgoingDeliveryStatus }[],
    currentDeliveryId?: number,
  ): { isAvailable: boolean; reason?: string } {
    if (!driver.isActive) {
      return { isAvailable: false, reason: 'Inactive' }
    }

    const assignedDelivery = deliveries.find(
      (d) =>
        d.id !== currentDeliveryId &&
        d.driverEmployeeId === driver.id &&
        (d.status === 'DISPATCHED' || d.status === 'SCHEDULED'),
    )

    if (assignedDelivery) {
      const stateLabel = assignedDelivery.status === 'DISPATCHED' ? 'On Route' : 'Scheduled'
      return {
        isAvailable: false,
        reason: `${stateLabel} (${assignedDelivery.deliveryNumber})`,
      }
    }

    return { isAvailable: true }
  }
}
