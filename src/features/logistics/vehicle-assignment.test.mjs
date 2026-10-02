import assert from 'node:assert/strict'
import test from 'node:test'
import { DeliveryUtils } from './delivery-utils.ts'
import {
  getVehicleAssignments,
  getVehicleCondition,
  getVehicleAvailabilityStatus,
} from './vehicle-assignment.ts'
const vehicle = { id: 1, status: 'AVAILABLE', isActive: true }
const delivery = {
  id: 10,
  deliveryNumber: 'OUT-10',
  deliveryVehicleId: 1,
  driverEmployeeId: 2,
  status: 'SCHEDULED',
}

test('vehicle availability follows active assignment references, including draft reservations', () => {
  for (const status of ['DRAFT', 'SCHEDULED', 'DISPATCHED']) {
    const records = [{ ...delivery, status }]
    assert.equal(getVehicleAvailabilityStatus(vehicle, records), 'IN_DELIVERY')
    assert.equal(DeliveryUtils.getVehicleAvailability(vehicle, records).isAvailable, false)
  }
  assert.equal(getVehicleAvailabilityStatus({ ...vehicle, status: 'IN_DELIVERY' }, []), 'AVAILABLE')
})
test('completion and cancellation remove assignments without changing inventory locally', () => {
  for (const status of ['DELIVERED', 'CANCELLED']) {
    const records = [{ ...delivery, status }]
    assert.deepEqual(getVehicleAssignments(1, records), [])
    assert.equal(getVehicleAvailabilityStatus(vehicle, records), 'AVAILABLE')
    assert.equal(DeliveryUtils.getVehicleAvailability(vehicle, records).isAvailable, true)
  }
})
test('maintenance, out of service, and archive always prevent vehicle selection', () => {
  for (const status of ['MAINTENANCE', 'OUT_OF_SERVICE']) {
    assert.equal(getVehicleCondition({ ...vehicle, status }), status)
    assert.equal(getVehicleAvailabilityStatus({ ...vehicle, status }, [delivery]), status)
    assert.equal(
      DeliveryUtils.getVehicleAvailability({ ...vehicle, status }, []).isAvailable,
      false,
    )
  }
  const archived = { ...vehicle, isActive: false }
  assert.equal(getVehicleCondition(archived), 'ARCHIVED')
  assert.equal(getVehicleAvailabilityStatus(archived, [delivery]), 'ARCHIVED')
  assert.equal(DeliveryUtils.getVehicleAvailability(archived, []).isAvailable, false)
})
test('dispatch may use its own reservation but cannot take another delivery’s vehicle', () => {
  assert.equal(DeliveryUtils.getVehicleAvailability(vehicle, [delivery], 10).isAvailable, true)
  assert.equal(DeliveryUtils.getVehicleAvailability(vehicle, [delivery], 11).isAvailable, false)
  assert.equal(
    DeliveryUtils.getVehicleAvailability(vehicle, [delivery, { ...delivery, id: 11 }], 10)
      .isAvailable,
    false,
  )
})
test('driver reservations also block draft, scheduled, and dispatched double booking', () => {
  const driver = { id: 2, isActive: true }
  for (const status of ['DRAFT', 'SCHEDULED', 'DISPATCHED']) {
    assert.equal(
      DeliveryUtils.getDriverAvailability(driver, [{ ...delivery, status }]).isAvailable,
      false,
    )
  }
  assert.equal(DeliveryUtils.getDriverAvailability(driver, [delivery], 10).isAvailable, true)
  assert.equal(
    DeliveryUtils.getDriverAvailability({ ...driver, isActive: false }, []).isAvailable,
    false,
  )
})
test('unresolved legacy In Delivery state fails closed during selection', () => {
  assert.equal(
    DeliveryUtils.getVehicleAvailability({ ...vehicle, status: 'IN_DELIVERY' }, []).isAvailable,
    false,
  )
})
