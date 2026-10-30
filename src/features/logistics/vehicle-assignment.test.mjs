import assert from 'node:assert/strict'
import test from 'node:test'
import { DeliveryUtils } from './delivery-utils.ts'
import {
  getVehicleAssignments,
  getVehicleCondition,
  getVehicleAvailabilityStatus,
} from './vehicle-assignment.ts'
const vehicle = { id: 1, operationalStatus: 'SERVICEABLE', isAvailable: true, isActive: true }
const delivery = {
  id: 10,
  runNumber: 'RUN-10',
  deliveryVehicleId: 1,
  driverEmployeeId: 2,
  status: 'DISPATCHED',
}

test('vehicle availability follows active assignment references, from dispatched runs', () => {
  for (const status of ['DISPATCHED']) {
    const records = [{ ...delivery, status }]
    assert.equal(getVehicleAvailabilityStatus(vehicle, records), 'IN_DELIVERY')
    assert.equal(DeliveryUtils.getVehicleAvailability(vehicle, records).isAvailable, false)
  }
  assert.equal(getVehicleAvailabilityStatus({ ...vehicle, isAvailable: true }, []), 'AVAILABLE')
})
test('completion and cancellation remove assignments without changing inventory locally', () => {
  for (const status of ['DRAFT', 'COMPLETED', 'CANCELLED']) {
    const records = [{ ...delivery, status }]
    assert.deepEqual(getVehicleAssignments(1, records), [])
    assert.equal(getVehicleAvailabilityStatus(vehicle, records), 'AVAILABLE')
    assert.equal(DeliveryUtils.getVehicleAvailability(vehicle, records).isAvailable, true)
  }
})
test('maintenance, out of service, and archive always prevent vehicle selection', () => {
  for (const status of ['MAINTENANCE', 'OUT_OF_SERVICE']) {
    assert.equal(getVehicleCondition({ ...vehicle, operationalStatus: status }), status)
    assert.equal(getVehicleAvailabilityStatus({ ...vehicle, operationalStatus: status }, [delivery]), status)
    assert.equal(
      DeliveryUtils.getVehicleAvailability({ ...vehicle, operationalStatus: status }, []).isAvailable,
      false,
    )
  }
  const archived = { ...vehicle, isActive: false }
  assert.equal(getVehicleCondition(archived), 'ARCHIVED')
  assert.equal(getVehicleAvailabilityStatus(archived, [delivery]), 'ARCHIVED')
  assert.equal(DeliveryUtils.getVehicleAvailability(archived, []).isAvailable, false)
})
test('dispatch may use its own run but cannot take another run’s vehicle', () => {
  assert.equal(DeliveryUtils.getVehicleAvailability(vehicle, [delivery], 10).isAvailable, true)
  assert.equal(DeliveryUtils.getVehicleAvailability(vehicle, [delivery], 11).isAvailable, false)
  assert.equal(
    DeliveryUtils.getVehicleAvailability(vehicle, [delivery, { ...delivery, id: 11 }], 10)
      .isAvailable,
    false,
  )
})
test('drivers on dispatched runs cannot be double booked', () => {
  const driver = { id: 2, isActive: true }
  for (const status of ['DISPATCHED']) {
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
test('authoritative unavailable vehicle fails closed without run references', () => {
  assert.equal(
    DeliveryUtils.getVehicleAvailability({ ...vehicle, isAvailable: false, activeRunId: 99 }, []).isAvailable,
    false,
  )
})

test('draft run assignments do not reserve a driver before departure', () => {
  assert.equal(DeliveryUtils.getDriverAvailability({ id: 2, isActive: true }, [{ ...delivery, status: 'DRAFT' }]).isAvailable, true)
})
