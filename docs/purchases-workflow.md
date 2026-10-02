# Phase 2: Purchases navigation and workflow

The sidebar now has a Purchases division with Suppliers and Purchase Orders.
Both entries reuse the existing sections of `PurchasesView`. The `purchases`
navigation key still opens Purchase Orders; the new `suppliers` key opens the
existing supplier directory. The redundant Purchase Orders/Suppliers tabs inside
the page have been removed; each sidebar entry opens its section directly.
Navigation uses React state, not URL routes, so no redirects are needed.
Phase 1 Sales navigation and workflows remain unchanged.

## Existing implementation and scope

- Pages and forms: `PurchasesView.tsx`, `PurchaseModal.tsx`, `SupplierModal.tsx`.
- Types, APIs and mutations: `features/logistics/purchase-orders.*` and
  `features/logistics/suppliers.*`; their API routes and internal names stay intact.
- Both existing lists now reuse `ui/data-table.tsx`, already used in Sales and
  inventory. Their filters, badges, amounts, confirm/cancel actions and supplier
  edit/archive/restore actions are preserved. Suppliers use Active and Archived
  views backed by the existing `isActive` field and archive confirmation.
- The supplier directory includes inactive records, allowing its existing
  reactivation action to work. New orders still select only active suppliers.
- `PurchaseOrderDetailModal` provides a read-only view of the existing order,
  supplier, products, quantities, prices, discounts/taxes, references, notes and
  related receiving destinations. No duplicate PO page is created.
- PO creation already supports catalog products and automatically registering
  new products. That behavior remains; quantities enter warehouse inventory
  only through the existing receiving workflow.
- Neither the existing frontend nor the backend provides a PO edit endpoint.
  Supplier editing and the item builder's quantity/cost editing are preserved;
  this phase does not invent a persisted PO edit operation.

## Existing incoming delivery handoff

Supplier → Purchase Order → Incoming Delivery → Warehouse → Inventory.

The PO page already links to Deliveries Hub → Inbound Receiving. Those links
still resolve to the existing incoming section. `ScheduleIncomingDeliveryModal`
loads supplier and ordered items from an eligible PO and preserves the existing
warehouse selector and remaining-quantity calculations.

Incoming deliveries persist `purchaseOrderId`, `warehouseId`, and item references
through `purchaseOrderItemId`. This keeps the order relationship without copying
supplier, product or pricing data. Warehouse selection currently belongs to the
incoming delivery, because the PO API/model has no destination warehouse field.
The new PO view shows warehouses from linked, non-cancelled incoming deliveries,
or **To Be Confirmed** when no incoming destination has been assigned.

## Prepared for Phase 3 Logistics

`PurchaseOrderDeliveryMethod` and `PurchaseOrderIncomingPlan` describe a future
handoff with the existing PO ID, a destination warehouse that may be undecided,
and these user-facing methods:

| Value               | UI label          | Meaning                                          |
| ------------------- | ----------------- | ------------------------------------------------ |
| `TO_BE_CONFIRMED`   | To Be Confirmed   | The arrangement is undecided.                    |
| `SUPPLIER_DELIVERY` | Supplier Delivery | The supplier brings goods to the ERJV warehouse. |
| `PICKUP`            | Pickup            | ERJV collects goods from the supplier.           |

The contract remains separate from today's API payloads. There is no persisted
PO delivery-method or warehouse field yet. No vehicle choice is added to initial
PO creation, and no selection that would be lost on save is presented.

Phase 3 must add persistence for these choices and use the PO relationship when
creating incoming deliveries. Logistics will assign an available ERJV vehicle
and driver for Pickup; Supplier Delivery must not require an ERJV vehicle.
Supplier-owned vehicles must not become permanent ERJV Vehicles. Delivery
management, vehicle management, and backend changes are deferred.
