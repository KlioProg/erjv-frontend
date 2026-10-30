import assert from 'node:assert/strict'
import test from 'node:test'
import { deliveryQuantityError, remainingDeliveryQuantity, sumDeliveryQuantities } from './delivery-quantities.ts'

test('remaining delivery quantities subtract supplied commitments exactly and clamp overcommitment', () => {
  assert.equal(remainingDeliveryQuantity('100.25', ['60.25', '10.75']), '29.25')
  assert.equal(remainingDeliveryQuantity('0.30', ['0.10', '0.20']), '0.00')
  assert.equal(remainingDeliveryQuantity('10', ['12']), '0.00')
  assert.equal(remainingDeliveryQuantity('10', []), '10.00')
  assert.equal(remainingDeliveryQuantity('9999999999999999.99', ['0.01']), '9999999999999999.98')
})

test('malformed ordered quantities or commitments never become confirmed remaining balances', () => {
  for (const invalid of [undefined, null, '', 'bad', '-1', '1.001', '1e2']) {
    assert.equal(remainingDeliveryQuantity(invalid, []), null)
    assert.equal(remainingDeliveryQuantity('10', [invalid]), null)
    assert.equal(sumDeliveryQuantities(['1', invalid]), null)
  }
})

test('delivery quantity validation allows skipped items and exact remaining balances but blocks overages', () => {
  assert.equal(deliveryQuantityError('0', '0.00'), null)
  assert.equal(deliveryQuantityError('0.25', '0.25'), null)
  assert.equal(deliveryQuantityError('0.26', '0.25'), 'Quantity exceeds the remaining 0.25.')
  assert.match(deliveryQuantityError('1', null), /remaining quantity is unavailable/)
  assert.match(deliveryQuantityError('1', 'bad'), /remaining quantity is unavailable/)
  for (const invalid of ['', '-1', '1.001', 'bad']) assert.match(deliveryQuantityError(invalid, '10'), /up to two decimal places/)
})

test('delivery quantity sums retain decimal precision and empty inputs are confirmed zero', () => {
  assert.equal(sumDeliveryQuantities([]), '0.00')
  assert.equal(sumDeliveryQuantities(['0.10', '0.20']), '0.30')
  assert.equal(sumDeliveryQuantities(['9999999999999999.99', '0.01']), '10000000000000000.00')
})
