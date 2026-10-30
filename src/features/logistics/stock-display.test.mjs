import assert from 'node:assert/strict'
import test from 'node:test'
import { availableStockCents, formatStockCents, parseStockCents, stockSortKey } from './stock-display.ts'

test('keeps very large warehouse quantities exact', () => {
  const original = '123901982739817298172398712'
  const cents = parseStockCents(original)
  assert.equal(formatStockCents(cents), '123,901,982,739,817,298,172,398,712')
  assert.equal(formatStockCents(parseStockCents('100.50')), '100.5')
})

test('rejects malformed or negative backend stock values', () => {
  for (const value of ['-1', '1e20', '12.345', 'NaN', '', null, undefined]) {
    assert.equal(parseStockCents(value), null)
  }
  assert.equal(formatStockCents(null), '—')
})

test('sort keys retain magnitude beyond JavaScript safe integers', () => {
  const smaller = stockSortKey(parseStockCents('999999999999999999999'))
  const larger = stockSortKey(parseStockCents('1000000000000000000000'))
  assert.ok(smaller && larger && smaller < larger)
})


test('available stock uses only the backend balance and never reconstructs missing balances', () => {
  assert.equal(availableStockCents({ availableQuantity: '7.25', onHandQuantity: '100', inTransitQuantity: '50', quarantinedQuantity: '4' }), 725n)
  for (const availableQuantity of [undefined, null, 'invalid']) {
    assert.equal(availableStockCents({ availableQuantity, onHandQuantity: '100', quantity: '100', reservedQuantity: '0' }), null)
  }
})
