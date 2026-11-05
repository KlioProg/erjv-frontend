// Read-only probes against the sibling backend. No backend files or database rows are changed.
// Run: node --test verification/backend-changes.test.cjs
// These tests intentionally expose absent approved contracts; they are separate from frontend CI.
const { test } = require('node:test')
const assert = require('node:assert/strict')
const { createRequire } = require('node:module')
const path = require('node:path')

const backend = path.resolve(__dirname, process.env.ERJV_BACKEND_DIR || '../../erjv-backend')
const backendRequire = createRequire(path.join(backend, 'package.json'))
backendRequire('reflect-metadata')
backendRequire('ts-node').register({
  project: path.join(backend, 'tsconfig.json'),
  transpileOnly: true,
  experimentalResolver: true,
  compilerOptions: {
    module: 'CommonJS',
    moduleResolution: 'node',
    resolvePackageJsonExports: false,
    resolvePackageJsonImports: false,
    verbatimModuleSyntax: false,
  },
})
const load = (name) => backendRequire(path.join(backend, 'src', name))
const { ValidationPipe } = backendRequire('@nestjs/common')
const { Reflector } = backendRequire('@nestjs/core')
const { validationProblem } = load('common/http/problem-details.ts')
const pipe = new ValidationPipe({
  whitelist: true,
  forbidNonWhitelisted: true,
  transform: true,
  exceptionFactory: validationProblem,
})
const validate = (metatype, body) => pipe.transform(body, { type: 'body', metatype })
const invalid = (error) =>
  error.getStatus() === 400 && error.getResponse().code === 'VALIDATION_FAILED'
const po = load('purchase-orders/dto/purchase-order.dto.ts')
const so = load('sales-orders/dto/sales-order.dto.ts')

for (const [name, create, update, body] of [
  ['purchase', po.CreatePurchaseOrderDto, po.UpdatePurchaseOrderDraftDto, { items: [] }],
  ['sales', so.CreateSalesOrderDto, so.UpdateSalesOrderDraftDto, { clientId: 1, items: [] }],
]) {
  test(`${name}: accepts a historical timezone-aware business date on create`, async () => {
    const result = await validate(create, { ...body, orderedAt: '2026-01-02T00:30:00+08:00' })
    assert.equal(new Date(result.orderedAt).toISOString(), '2026-01-01T16:30:00.000Z')
  })
  test(`${name}: accepts a business-date-only draft patch without other draft fields`, async () => {
    const result = await validate(update, {
      expectedRevision: 2,
      orderedAt: '2026-01-02T00:30:00+08:00',
    })
    assert.equal(new Date(result.orderedAt).toISOString(), '2026-01-01T16:30:00.000Z')
    for (const field of ['clientId', 'supplierId', 'items', 'deliveryAddress', 'createdAt'])
      assert.equal(result[field], undefined)
  })
  test(`${name}: permits omitted orderedAt on creation and draft updates`, async () => {
    assert.equal((await validate(create, body)).orderedAt, undefined)
    assert.equal(
      (await validate(update, { expectedRevision: 2, notes: 'Keep dates' })).orderedAt,
      undefined,
    )
  })
  for (const value of [null, 'bad-date', '2026-02-30T00:30:00+08:00', '2026-01-02T00:30:00']) {
    test(`${name}: rejects invalid orderedAt ${JSON.stringify(value)} with date validation`, async () => {
      await assert.rejects(validate(create, { ...body, orderedAt: value }), (error) => {
        assert.ok(invalid(error))
        // UNKNOWN_FIELD would reject even a valid date, and is not implemented date validation.
        assert.ok(
          error
            .getResponse()
            .issues.some((issue) => issue.path === 'orderedAt' && issue.code !== 'UNKNOWN_FIELD'),
        )
        return true
      })
    })
  }
}

test('sales: rejects explicit null clientId in a draft patch', async () => {
  await assert.rejects(
    validate(so.UpdateSalesOrderDraftDto, { expectedRevision: 2, clientId: null }),
    invalid,
  )
})

const incomingDto = load('incoming-deliveries/dto/incoming-delivery.dto.ts')
const runDto = load('delivery-runs/dto/delivery-run.dto.ts')
for (const dto of [
  incomingDto.UpdateIncomingDraftDto,
  incomingDto.RescheduleIncomingDto,
  runDto.UpdateDeliveryRunDraftDto,
]) {
  test(`${dto.name}: permits omitted warehouseId`, async () => {
    assert.equal(
      (await validate(dto, { expectedRevision: 2, notes: 'Keep warehouse' })).warehouseId,
      undefined,
    )
  })
  test(`${dto.name}: rejects explicit null warehouseId with a field issue`, async () => {
    await assert.rejects(
      validate(dto, { expectedRevision: 2, warehouseId: null }),
      (error) =>
        invalid(error) && error.getResponse().issues.some((issue) => issue.path === 'warehouseId'),
    )
  })
}

const { IncomingDeliveriesService } = load('incoming-deliveries/incoming-deliveries.service.ts')
function receiptService() {
  const stored = {
    id: 1,
    revision: 3,
    status: 'COMPLETED',
    noReceiptReason: null,
    items: [
      {
        id: 4,
        purchaseOrderItemId: 5,
        receivedQuantity: '3.00',
        damagedQuantity: '1.00',
        acceptedQuantity: '2.50',
        createdAt: new Date('2026-01-02T00:00:00Z'),
        updatedAt: new Date('2026-01-03T00:00:00Z'),
      },
    ],
  }
  let stockWrites = 0
  const service = new IncomingDeliveriesService(
    { findById: async () => structuredClone(stored) },
    {},
    {},
    {
      applyReceipt: async () => {
        stockWrites++
      },
    },
    {},
    { run: (operation) => operation() },
  )
  const command = {
    expectedRevision: 1,
    items: [{ purchaseOrderItemId: 5, receivedQuantity: '3.00', damagedQuantity: '1.00' }],
  }
  return { stored, service, command, stockWrites: () => stockWrites }
}
test('receipt retry: returns accepted quantity after partial quarantine clearance', async () => {
  const { service, command, stored } = receiptService()
  assert.equal(
    (await service.complete(1, command, 9)).items[0].acceptedQuantity,
    stored.items[0].acceptedQuantity,
  )
})
test('receipt retry: preserves the stored item updatedAt', async () => {
  const { service, command, stored } = receiptService()
  assert.deepEqual(
    (await service.complete(1, command, 9)).items[0].updatedAt,
    stored.items[0].updatedAt,
  )
})
test('receipt retry: performs no stock writes and rejects differing counts', async () => {
  const { service, command, stockWrites } = receiptService()
  await service.complete(1, command, 9)
  await assert.rejects(
    service.complete(
      1,
      { ...command, items: [{ ...command.items[0], receivedQuantity: '4.00' }] },
      9,
    ),
    (error) =>
      error.getStatus() === 409 && error.getResponse().code === 'RECEIPT_ALREADY_CONFIRMED',
  )
  assert.equal(stockWrites(), 0)
})
test('receipt retry: rejects a different no-receipt reason', async () => {
  const { service, stored } = receiptService()
  // The repository in this fixture reads this mutable stored record on each request.
  stored.items = []
  stored.noReceiptReason = 'No shipment'
  await assert.rejects(
    service.complete(1, { expectedRevision: 1, items: [], noReceiptReason: 'Other reason' }, 9),
    (error) =>
      error.getStatus() === 409 && error.getResponse().code === 'RECEIPT_ALREADY_CONFIRMED',
  )
})

const { toOutgoingDeliveryResponseDto } = load('outgoing-deliveries/outgoing-delivery.mapper.ts')
for (const [status, deliveredQuantity, expected] of [
  ['READY', null, null],
  ['RECONCILED', '0.00', 'NONE'],
  ['RECONCILED', '1.00', 'PARTIAL'],
  ['RECONCILED', '2.00', 'FULL'],
]) {
  test(`outgoing mapper: returns ${expected} independently of lifecycle ${status}`, () => {
    const response = toOutgoingDeliveryResponseDto({
      status,
      items: [
        {
          quantity: '2.00',
          deliveredQuantity,
          returnedDamagedQuantity: '0.00',
          missingQuantity: '0.00',
        },
      ],
    })
    assert.equal(response.fulfillmentOutcome, expected)
    assert.equal(response.status, status)
  })
}

const { PrismaEmployeeJobsRepository } = load(
  'employee-jobs/infrastructure/prisma-employee-jobs.repository.ts',
)
for (const jobIds of [[2, 3], [2], [2, 1]]) {
  test(`employee jobs: retained assignment timestamps survive replacement ${jobIds}`, async () => {
    const original = new Date('2026-01-01T00:00:00Z')
    const rows = new Map(
      [1, 2].map((jobId) => [jobId, { employeeId: 7, jobId, assignedAt: original }]),
    )
    const prisma = {
      employeeJob: {
        findMany: async () => [...rows.values()],
        deleteMany: async ({ where }) => {
          for (const id of rows.keys()) if (!where.jobId?.notIn?.includes(id)) rows.delete(id)
        },
        createMany: async ({ data }) => {
          for (const row of data)
            if (!rows.has(row.jobId))
              rows.set(row.jobId, { ...row, assignedAt: new Date('2026-02-01T00:00:00Z') })
        },
      },
      $transaction: async (operations) =>
        typeof operations === 'function' ? operations(prisma) : Promise.all(operations),
    }
    await new PrismaEmployeeJobsRepository(prisma).replaceJobsForEmployee(7, jobIds)
    assert.deepEqual([...rows.keys()].sort(), [...jobIds].sort())
    assert.deepEqual(rows.get(2).assignedAt, original)
  })
}

const { ReplaceEmployeeJobsDto } = load('employee-jobs/dto/replace-employee-jobs.dto.ts')
test('employee jobs: rejects an empty replacement set', async () => {
  await assert.rejects(validate(ReplaceEmployeeJobsDto, { jobIds: [] }))
})

const { RolesGuard } = load('security/guards/roles.guard.ts')
for (const [required, role, expected] of [
  [['ADMIN'], 'SUPERADMIN', true],
  [['SUPERADMIN'], 'ADMIN', false],
  [['ADMIN', 'MANAGER'], 'STAFF', false],
  [['ADMIN'], 'MANAGER', false],
  [['ADMIN', 'MANAGER', 'STAFF'], 'STAFF', true],
]) {
  test(`roles: ${role} with ${required.join('/')} authorization returns ${expected}`, () => {
    const target = () => {}
    Reflect.defineMetadata('roles', required, target)
    const result = new RolesGuard(new Reflector()).canActivate({
      getHandler: () => target,
      getClass: () => RolesGuard,
      switchToHttp: () => ({ getRequest: () => ({ user: { role } }) }),
    })
    assert.equal(result, expected)
  })
}

for (const [name, Service, Repository, model, body] of [
  [
    'purchase',
    load('purchase-orders/purchase-orders.service.ts').PurchaseOrdersService,
    load('purchase-orders/infrastructure/prisma-purchase-orders.repository.ts')
      .PrismaPurchaseOrdersRepository,
    'purchaseOrder',
    { items: [] },
  ],
  [
    'sales',
    load('sales-orders/sales-orders.service.ts').SalesOrdersService,
    load('sales-orders/infrastructure/prisma-sales-orders.repository.ts')
      .PrismaSalesOrdersRepository,
    'salesOrder',
    { clientId: 1, items: [] },
  ],
]) {
  const fixture = () => {
    const saved = {
      id: 1,
      revision: 2,
      status: 'DRAFT',
      clientId: 1,
      deliveryAddress: 'Keep address',
      items: [],
      orderedAt: new Date('2026-01-01T00:00:00Z'),
      createdAt: new Date('2026-01-05T00:00:00Z'),
    }
    let patch
    const repository = {
      create: async (command) => ({ ...saved, ...command }),
      findById: async () => saved,
      updateDraft: async (_, command) => {
        patch = command
        return {
          ...saved,
          ...Object.fromEntries(Object.entries(command).filter(([, value]) => value !== undefined)),
        }
      },
    }
    const service = new Service(
      repository,
      { requireActive: async () => {}, findById: async () => ({ isActive: true }) },
      {},
      { issue: async () => 'TEST-1' },
      { run: (operation) => operation() },
    )
    return { service, saved, patch: () => patch }
  }
  test(`${name}: rejects future business dates with INVALID_ORDER_DATE in the service`, async () => {
    const { service } = fixture()
    await assert.rejects(
      service.create({ ...body, orderedAt: new Date(Date.now() + 86_400_000) }),
      (error) => error.getStatus() === 400 && error.getResponse().code === 'INVALID_ORDER_DATE',
    )
  })
  test(`${name}: omitted order dates leave business date, creation date and unrelated fields alone`, async () => {
    const { service, saved, patch } = fixture()
    const result = await service.updateDraft(1, { expectedRevision: 2, notes: 'Changed note' })
    assert.deepEqual(result.orderedAt, saved.orderedAt)
    assert.deepEqual(result.createdAt, saved.createdAt)
    assert.equal(result.deliveryAddress, saved.deliveryAddress)
    for (const field of ['createdAt', 'orderedAt', 'clientId', 'supplierId', 'deliveryAddress'])
      assert.equal(patch()[field], undefined)
  })
  test(`${name}: stale draft revisions fail before repository update`, async () => {
    const { service, patch } = fixture()
    await assert.rejects(
      service.updateDraft(1, { expectedRevision: 1, notes: 'Stale write' }),
      (error) => error.getStatus() === 409 && error.getResponse().code === 'STALE_REVISION',
    )
    assert.equal(patch(), undefined)
  })
  test(`${name}: filters and orders cursor pages by saved orderedAt rather than createdAt`, async () => {
    let query
    const prisma = {
      [model]: {
        findMany: async (args) => {
          query = args
          return []
        },
      },
    }
    const repository = new Repository(prisma, { client: (client) => client })
    const page = await repository.findAll({
      limit: 2,
      orderedFrom: '2026-01-01T00:00:00+08:00',
      orderedBefore: '2026-01-03T00:00:00+08:00',
    })
    assert.deepEqual(query.orderBy, [{ orderedAt: 'desc' }, { id: 'desc' }])
    const where = JSON.stringify(query.where)
    assert.ok(where.includes('orderedAt'))
    assert.ok(where.includes('2025-12-31T16:00:00.000Z'))
    assert.ok(!where.includes('createdAt'))
    assert.deepEqual(page, { items: [], nextCursor: null })
  })
}

test('outgoing OpenAPI describes FULL and nullable fulfillmentOutcome', () => {
  const { DECORATORS } = backendRequire('@nestjs/swagger/dist/constants')
  const { OutgoingDeliveryResponseDto } = load('outgoing-deliveries/dto/outgoing-delivery.dto.ts')
  const metadata = Reflect.getMetadata(
    DECORATORS.API_MODEL_PROPERTIES,
    OutgoingDeliveryResponseDto.prototype,
    'fulfillmentOutcome',
  )
  assert.deepEqual(metadata.enum, ['NONE', 'PARTIAL', 'FULL'])
  assert.equal(metadata.nullable, true)
})
