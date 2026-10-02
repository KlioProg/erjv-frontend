# Phase 1: Sales navigation and workflow

The sidebar's Sales division contains Customers and Sales Orders. Existing tab
keys (`clients`, `orders`), components and API paths remain unchanged. The app
uses React state for navigation, with no URL router or redirects. Sidebar groups
remain always expanded, including on mobile.

## Existing implementation

- Navigation: `DashboardLayout.tsx`; page selection: `MainDashboard.tsx`.
- Customers: `ClientList.tsx`, `ClientModal.tsx`, and `features/crm/clients.*`.
  The underlying `Client` model and `/clients` API still represent customers.
- Sales Orders: `OrdersView.tsx`, `OrderModal.tsx`, `OrderDetailDrawer.tsx`,
  and `features/crm/sales-orders.*`. The list reuses `ui/data-table.tsx`, already
  used by inventory and warehouse pages. Customer cards and order forms retain
  their existing layout and controls.
- Current order API: list, retrieve by ID/number, create, confirm and cancel.
  `OrderModal` supports prefilled edit mode, but the existing page does not wire
  it to a persisted edit operation and the backend has no order update endpoint.
  This phase preserves that form support without adding an unsupported save API.
- Order data includes customer (`clientId`), products, quantities, prices,
  discounts/taxes, status, destination, dates, external reference and notes.
  Existing stock allocations support fulfillment readiness; Sales does not edit
  warehouse stock or vehicle maintenance.

## Delivery handoff

Customer → Sales Order → Outgoing Delivery → Customer receives goods.

Outgoing deliveries already hold `salesOrderId`. Their items reference
`salesOrderAllocationId` and quantity, preserving the order's customer, products,
destination and allocation relationship without entering the order again.

**Prepare Delivery** opens the existing `QuickDispatchModal`. Its current final
action still schedules and dispatches a delivery with vehicle/driver assignment.
This working shortcut is preserved pending the Logistics phase. The destination
is read directly from the Sales Order; the delivery API does not accept a separate
destination override. **View Delivery** reuses `DeliveryDetailModal` for the
specific related delivery. Existing receipt/completion actions remain available.

## Deferred to Logistics

`SalesOrderOutgoingMethod` and `SalesOrderFulfillmentPlan` prepare a typed handoff
for **Client Pickup** (`CLIENT_PICKUP`) or **Delivery** (`DELIVERY`). This plan is
separate from the current API payloads. The backend has no persisted outgoing
method field, so this phase adds no selectable control that would silently lose
the user's choice, and does not encode it into notes or infer it from an address.

The next phase must add persistence for the method, a pickup completion workflow
that requires no company vehicle, and a Logistics handoff that assigns vehicles
and drivers for Delivery. It must also own delivery scheduling, partial delivery
quantities and the overall outgoing delivery list. No backend or Logistics
implementation is changed in this phase.
