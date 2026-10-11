import assert from 'node:assert/strict'
import test from 'node:test'
import {
  availableStock,
  decimalString,
  formatOrderCurrency,
  lineSubtotal,
  orderAmounts,
  parseOrderDecimal,
} from './order-amounts.ts'
import {
  discountError,
  expectedDateError,
  priceError,
  quantityError,
  subtotalError,
} from './order-entry.schema.ts'

test('decimal input supports fractional units without accepting malformed or excess precision', () => {
  assert.equal(parseOrderDecimal('12.35'), 1235n)
  assert.equal(parseOrderDecimal('0.10'), 10n)
  for (const input of ['', '-1', '1e2', 'NaN', 'Infinity', '1.234', '1.', '.5', ' 1 ', '1,000']) {
    assert.equal(parseOrderDecimal(input), null, input)
    assert.ok(quantityError(input), input)
    assert.ok(priceError(input), input)
  }
  assert.ok(quantityError('0'))
  assert.equal(quantityError('0.01'), undefined)
  assert.equal(priceError('0'), undefined)
})

test('line multiplication rounds once to cents and incomplete fields stay incomplete', () => {
  assert.equal(lineSubtotal('0.10', '0.20'), '0.02')
  assert.equal(lineSubtotal('1.25', '10.05'), '12.56')
  assert.equal(lineSubtotal('0.50', '0.01'), '0.01')
  assert.equal(lineSubtotal('3', '0'), '0.00')
  for (const [quantity, price] of [
    ['', '5'],
    ['0', '5'],
    ['2', ''],
    ['-2', '5'],
  ]) {
    assert.equal(lineSubtotal(quantity, price), null)
  }
})

test('sum uses rounded line amounts, matching persisted amounts rather than aggregate rounding', () => {
  const result = orderAmounts([
    { quantity: '0.5', unitPrice: '0.01' },
    { quantity: '0.5', unitPrice: '0.01' },
  ])
  assert.equal(result.subtotal, '0.02')
  assert.equal(result.total, '0.02')
  assert.equal(result.vat, '0.00')
})

test('sales VAT applies to each discounted line using the actual submitted rates', () => {
  const result = orderAmounts(
    [{ quantity: '2.50', unitPrice: '100.00' }],
    'percentage',
    '10',
    '12.00',
  )
  assert.equal(result.subtotal, '250.00')
  assert.equal(result.discount, '25.00')
  assert.equal(result.vat, '27.00')
  assert.equal(result.total, '252.00')
  assert.equal(result.discountRate, '10.00')
  assert.equal(result.taxRate, '12.00')
})

test('peso discounts expose API rate rounding instead of promising an unrepresentable amount', () => {
  const exact = orderAmounts([{ quantity: '1', unitPrice: '100' }], 'peso', '10', '12.00')
  assert.equal(exact.discountRate, '10.00')
  assert.equal(exact.discount, '10.00')
  assert.equal(exact.total, '100.80')
  assert.equal(exact.hasDiscountRounding, false)
  const rounded = orderAmounts([{ quantity: '1', unitPrice: '9999' }], 'peso', '1', '12.00')
  assert.equal(rounded.discountRate, '0.01')
  assert.equal(rounded.discount, '1.00')
  const unrepresentable = orderAmounts(
    [{ quantity: '1', unitPrice: '5000' }],
    'peso',
    '0.01',
    '12.00',
  )
  assert.equal(unrepresentable.discountRate, '0.00')
  assert.equal(unrepresentable.discount, '0.00')
  assert.equal(unrepresentable.hasDiscountRounding, true)
  assert.ok(discountError('0.01', 'peso', unrepresentable.subtotal, unrepresentable.discount))
  assert.equal(
    discountError('0', 'peso', unrepresentable.subtotal, unrepresentable.discount),
    undefined,
  )
})

test('VAT and discount rounding happen per line, not once on the whole order', () => {
  const result = orderAmounts(
    [
      { quantity: '1', unitPrice: '0.05' },
      { quantity: '1', unitPrice: '0.05' },
    ],
    'percentage',
    '10',
    '12.00',
  )
  assert.equal(result.discount, '0.02')
  assert.equal(result.vat, '0.00')
  assert.equal(result.total, '0.08')
  const free = orderAmounts([{ quantity: '1', unitPrice: '123.45' }], 'percentage', '100', '12.00')
  assert.equal(free.total, '0.00')
  assert.equal(free.vat, '0.00')
})

test('stock limits use unreserved quantities exactly and handle missing or depleted sources', () => {
  assert.equal(availableStock({ quantity: '0.30', reservedQuantity: '0.20' }), 10n)
  assert.equal(availableStock({ quantity: '10.50' }), 1050n)
  assert.equal(availableStock({ quantity: '1', reservedQuantity: '2' }), 0n)
  assert.equal(availableStock(), 0n)
})

test('validation honors database bounds, positive quantities, dates and discount limits', () => {
  assert.equal(quantityError('9999999999.99'), undefined)
  assert.ok(quantityError('10000000000'))
  assert.equal(priceError('999999999999.99'), undefined)
  assert.ok(priceError('1000000000000'))
  assert.ok(subtotalError(lineSubtotal('9999999999.99', '999999999999.99')))
  assert.equal(discountError('', 'peso', '100.00'), undefined)
  assert.equal(discountError('100', 'percentage', '1.00'), undefined)
  assert.ok(discountError('100.01', 'percentage', '1000.00'))
  assert.ok(discountError('1.01', 'peso', '1.00'))
  assert.ok(discountError('-1', 'peso', '100.00'))
  assert.equal(expectedDateError('2028-02-29'), undefined)
  assert.equal(expectedDateError(''), undefined)
  for (const date of ['invalid', '2026-02-29', '2026-04-31']) assert.ok(expectedDateError(date))
})

test('large values format precisely, without converting through floating-point numbers', () => {
  assert.equal(decimalString(123456789012345678901n), '1234567890123456789.01')
  assert.equal(formatOrderCurrency('1234567890123456789.01'), '₱1,234,567,890,123,456,789.01')
  assert.equal(formatOrderCurrency(null), '—')
})
