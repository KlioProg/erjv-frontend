# Logistics workflow (Phase 3 frontend)

The sidebar uses **Logistics → Inventory, Warehouses, Deliveries, Vehicles**. The
navigation keys (`inventory`, `warehouses`, `deliveries`, `fleet`) remain stable;
this application has no URL router, so no route redirects or data migration are
needed.

## Deliveries

`DeliveriesHub` contains one `DataTable` for incoming and outgoing records. Its
type, method, status, warehouse, date, and text filters operate on both types.
The old Schedule, Status, Completed, Incoming, and History screens have been
replaced by this list and its row actions. Existing `initialTab` values remain
as filter hints for internal navigation. Each row holds the original record and
resolves its party, products, and order number from the referenced order ID.

- Purchase Order → Schedule Incoming uses `purchaseOrderId`, remaining item
  quantities, the known destination warehouse when unambiguous, and the PO
  expected date when present. Receiving still calls the existing completion
  API, which owns stock changes.
- Sales Order → Schedule Outgoing uses `salesOrderId` and the existing order
  allocations. Dispatch and completion still call the existing APIs, which own
  reservation and stock changes.
- Vehicle and driver selections reject active draft, scheduled, and dispatched
  assignments. A dispatch can reuse its own reservation. The server must still
  enforce this under concurrent edits for a full double-booking guarantee.

The current API has no persisted delivery-method field. Incoming rows therefore
show **To Be Confirmed**; existing outgoing rows show **Delivery**, the method
their current vehicle-required dispatch API supports. The prepared
`PurchaseOrderDeliveryMethod` and `SalesOrderOutgoingMethod` types are intent
contracts only, not data stored by the current API. The UI does not offer Pickup
or Client Pickup as working choices until the server supports them.

## Vehicles

The Vehicles `DataTable` includes active and archived records, condition
controls, current assignments, and a per-vehicle delivery history with counts
and filters. Archiving retains historical links. The existing vehicle status
API stores `AVAILABLE`, `IN_DELIVERY`, `MAINTENANCE`, or `OUT_OF_SERVICE`. The UI
maps this to **Operational**, **Under Maintenance**, **Out of Service**, or
**Archived** condition and derives **Available** or **In Delivery** from active
delivery references. Users cannot manually choose In Delivery. Existing
`IN_DELIVERY` values without a matching active assignment are displayed from
the references; vehicle selection fails closed until the server status is
reconciled. Completion or cancellation releases assignments through the
existing API, not a local vehicle-status write.

## Server contract needed for the remaining workflow

The server has no incoming vehicle/driver assignment, no delivery method on
either delivery, and no maintenance history or maintenance date. Outgoing
dispatch requires a company vehicle and driver and only a dispatched delivery
can be completed. Supporting the requested methods requires a server change:

1. Persist incoming `TO_BE_CONFIRMED | SUPPLIER_DELIVERY | PICKUP` and outgoing
   `CLIENT_PICKUP | DELIVERY` on delivery records. Keep order IDs as the source
   of supplier/customer, items, quantities, and warehouse information.
2. Permit `SUPPLIER_DELIVERY` and `CLIENT_PICKUP` without an ERJV vehicle. For
   `PICKUP` and `DELIVERY`, store an ERJV vehicle and driver assignment and
   validate eligibility atomically on the server. Supplier-owned vehicles must
   not become ERJV vehicle records.
3. Store maintenance records and dates independently of derived availability.
   Keep archived vehicle IDs in historical deliveries. Define an explicit
   reconciliation for legacy `IN_DELIVERY` status values before making condition
   a separate persisted field.

No backend files or database schema were changed in this frontend phase.
