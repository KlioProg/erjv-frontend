# Order and delivery frontend implementation

## Product goal

**Allow sales orders to be confirmed without warehouse selection, then assign warehouse sources when preparing Outgoing Delivery.**

Both order composers should record the purchase agreement; fulfillment decisions belong in Deliveries. Save Draft and Confirm Order must work without warehouse controls. Confirmation shows a top-right Order confirmed notification. Delivery preparation is opened separately from the order list; no shipment is created automatically. The current backend still requires saved allocations for confirmation. At the designer's request, compact source controls are available again while the fulfillment architecture awaits backend support.

The backend developer's requirements and end-to-end acceptance checks are in [sales-fulfillment-handoff.md](sales-fulfillment-handoff.md).

## Current implementation

The existing order workspace is retained. Purchases now match its compact sales presentation, confirmed orders show one success notification and link to delivery preparation, and the sidebar separates active incoming/outgoing deliveries from terminal history. Backend files, schemas, contracts and migrations were inspected without modification.

Sales source selection is available again as a compact action below each product name. Its editor opens only on request or a confirmation validation error. Sales Confirm Order creates a fully allocated draft and confirms its returned ID; Save Draft can still omit sources. Order editing remains unavailable.

## Files in this pass

All paths are relative to `erjv-frontend`. Earlier workspace changes remain documented in [order-entry-standardization.md](order-entry-standardization.md).

| Area                | Files                                                                                                                                                                                                                       | Responsibility                                                                                                                        |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Shared order UI     | New `src/components/order-entry/OrderAdditionalDetails.tsx`, success notifications in existing mutation hooks                                                                                                               | Mounted optional fields and notification-only confirmation                                                                            |
| Purchase UI         | `src/components/purchases/PurchaseModal.tsx`, `PurchasesView.tsx`, `PurchaseOrderDetailModal.tsx`                                                                                                                           | Compact five-column composer, independent cost, confirmation notifications, consistent incoming actions and cancellation confirmation |
| Sales UI            | `src/components/orders/SalesOrderDetails.tsx`, `SalesOrderSources.tsx`, `SalesOrderCancelModal.tsx`, `OrdersView.tsx`, `OrderDetailDrawer.tsx`                                                                              | Shared optional details, confirmation notifications, supported delivery navigation, completion status guard and stock query refresh   |
| Navigation          | `src/components/dashboard/MainDashboard.tsx`, `src/components/layout/DashboardLayout.tsx`, new `DeliveryNavigation.tsx`                                                                                                     | Expandable sidebar children and order-specific delivery navigation                                                                    |
| Delivery tables     | `src/components/deliveries/DeliveriesHub.tsx`, new `DeliveryTable.tsx`, new `DeliveryQuantityTable.tsx`                                                                                                                     | Domain columns/actions, direction/history filtering and canonical editable shipment tables                                            |
| Delivery forms      | `src/components/deliveries/ScheduleDeliveryModal.tsx`, `ScheduleIncomingDeliveryModal.tsx`, `shared/DispatchDeliveryModal.tsx`                                                                                              | Decimal shipment quantities, load/error guards, saved-draft scheduling retry and dispatch effect explanation                          |
| Delivery rules      | `src/features/logistics/delivery-workflow.ts`, new `delivery-quantities.ts`                                                                                                                                                 | View membership, supported actions, schedule presentation and exact quantity calculations                                             |
| Shared confirmation | `src/components/ui/ConfirmDeleteModal.tsx`                                                                                                                                                                                  | Inline API error retention and guarded close/duplicate submission during a pending action                                             |
| Verification        | New `src/components/deliveries/order-delivery-workflow.component.test.tsx`, new `src/features/logistics/delivery-workflow.test.mjs`, updated `src/components/order-entry/order-composer.component.test.tsx`, `package.json` | HTTP-adapter workflow tests, pure rules and updated purchase optional-details interaction                                             |
| Reports             | `docs/order-delivery-frontend.md`, `docs/order-entry-standardization.md`                                                                                                                                                    | Current scope, backend findings and actual verification                                                                               |

DataTable remains the canonical implementation for the delivery lists and both editable shipment tables. Columns and actions belong to the delivery domain. Dialog, Button, Input, Select, SearchableDropdown, DataTableActions, ProductIdentity and the established split-panel order workspace are reused. No dependency was added for this pass.

## Sales orders

- The existing Customer / Expected Delivery Date row, editable required address, five-column table, selling-price defaults, exact discount/VAT calculations and optional details remain.
- Each item has a Set stock source action; selected sources collapse to warehouse/quantity text. One item editor is expanded at a time. Warehouse names and unreserved stock are shown in explicit choices, with no automatic source selection. Split across warehouses exposes editable source quantities. Done returns focus to the summary; missing sources, duplicates, invalid totals and stock limits are validated. Single-source quantities follow ordered quantity edits; split quantities and repeated product selections preserve entered choices. `SalesOrderSources.tsx` and `sales-order-entry.schema.ts` own the presentation and pure rules.
- Save Draft permits omitted allocations and retains any valid explicit sources. Confirm Order validates complete allocations before creation, then confirms the returned saved ID. Both actions preserve customer/address, quantities, prices, discounts, VAT and metadata. Existing saved drafts confirm by ID subject to backend validation; previously saved source-free drafts still need a backend update capability before they can be fully allocated.
- Successful confirmation from the composer, list or details shows one Order confirmed notification at the top right. The confirmation popup was removed at the designer's request. Outgoing Deliveries is a green row action for orders ready for preparation; clicking it opens the outgoing list scoped to the order, where scheduling remains explicit. Existing shipment-specific actions retain their behavior.
- Existing confirmed and partially delivered orders can open the same arrangement flow. A dispatched shipment can be completed only after an effect explanation and confirmation. Completion refreshes stock, vehicles, deliveries and sales-order queries; feedback reports order progress without promising that a partial shipment completes the whole order.
- Admin/Manager controls follow the inspected mutation permissions. Staff retain read access.
- Cancellation from the sales list or order details uses the shared application confirmation dialog through `SalesOrderCancelModal.tsx`. It shows the order number, explains reservation release, and offers Keep Order or Cancel Order. Backend errors remain in the dialog for retry; pending cancellation blocks dismissal and duplicate requests.

## Purchase orders

- Supplier and Expected Delivery Date share the compact metadata row. Processed by is secondary text. Supplier reference and notes share the mounted Additional details disclosure used by sales.
- Columns are Product, Quantity, Unit Cost, Subtotal and Remove. Unit and non-redundant variety appear below the product name. The selected table continues to grow with its content.
- Purchase cost starts blank and stays independent of catalog selling price. Explicit zero is supported. Existing exact totals, validation, duplicate-add focus and API failure retention remain.
- Confirmation closes the composer/details and shows Order confirmed without a popup or navigation. Confirmed and partially received orders use the same green Incoming Deliveries button; it opens the incoming list scoped to the order. View and Cancel use compact secondary icon controls with fixed positions, keeping the primary action aligned even when cancellation is unavailable. The detail-view incoming link uses the same green Button variant.
- Destination warehouse and shipment quantities remain in incoming arrangement. Neither order creation nor confirmation receives goods or changes physical stock.
- Cancellation now requires confirmation and preserves API errors for retry.

## Deliveries

The Logistics sidebar is Inventory, Warehouses, expandable Deliveries (Incoming, Outgoing, History), then Vehicles. The parent toggles disclosure; selecting a child navigates through the application's existing dashboard tab mechanism. A newly selected child opens the group automatically. No duplicate page-level navigation tabs were added.

Incoming and Outgoing show active records of their direction. History filters `COMPLETED`, `DELIVERED` and `CANCELLED` from the same API results. Records are never deleted or moved to implement history.

The active table columns are Delivery #, Related Order, Supplier/Customer, Schedule, Status and Actions. Warehouse remains secondary order text; outgoing vehicle/driver remain secondary customer text and remain searchable. Delivery references are keyboard-accessible detail buttons. Active dates show day/month with a separate time; an order's fallback expected date is labeled Expected. History includes the year and a Direction column for its mixed records. Search, status, warehouse, date filtering, sorting and pagination remain.

| Direction/status    | Available operations      |
| ------------------- | ------------------------- |
| Incoming Draft      | Schedule, Cancel          |
| Incoming Scheduled  | Receive Goods, Cancel     |
| Outgoing Draft      | Schedule, Cancel          |
| Outgoing Scheduled  | Dispatch, Cancel          |
| Outgoing Dispatched | Complete Delivery, Cancel |
| Terminal records    | View details              |

Operations use compact named/title-bearing icon buttons with larger coarse-pointer targets. Scheduling, receiving, completion and cancellation show confirmations explaining their actual effects. Dispatch uses its existing vehicle/driver dialog with an explicit transit/vehicle/stock explanation. Receive adds the recorded shipment quantities to the receiving warehouse. Outgoing completion applies the outgoing stock movement and releases the vehicle. Outgoing cancellation leaves sales-order reservations intact; cancelling a dispatched shipment releases its vehicle. Backend validation remains authoritative.

The two shipment forms now use one domain-owned quantity DataTable. Decimal strings are preserved, including fractional balances such as `0.05`; exact scaled integer calculations replace incoming floating-point subtraction and outgoing integer truncation. Non-cancelled draft, scheduled and completed shipments count toward already-arranged quantities. Zero skips a line, and malformed/over-balance values block submission. Unknown balances and failed required queries block creation with recovery controls.

Forms disable edits and dismissal while saving. If outgoing creation succeeds but scheduling fails, Retry Schedule uses the returned draft ID. It never submits a second create request. Closing leaves that saved draft available in Outgoing Deliveries. Incoming scheduling failure likewise leaves its saved draft available for scheduling from the table. These flows do not dispatch or complete shipments automatically.

The Incoming Delivery purchase-order picker now hides orders whose full quantities are already arranged. Exact per-item balances count draft, scheduled and completed incoming shipments; cancelled shipments free their quantities for arrangement again. Partially arranged orders remain selectable for their remaining quantities. Empty pickers explain that there are no remaining orders to arrange. A preselected order that is fully arranged, or becomes fully arranged after a delivery-query refresh, is cleared from the visible selection and cannot submit; another order is never silently selected. Unknown balances remain labeled unavailable and block scheduling. The domain helper is `src/features/logistics/incoming-order-balance.ts`; purchase-order records and existing delivery lists/history remain intact.

## Backend capabilities and limits

Read-only inspection verified the backend on `main`, clean at `a139edc11cb0895443d09e6cb9a9bfa854307139`, matching the local `origin/main` reference. No remote fetch was performed.

| Capability                     | Inspected contract                                                                                                                                   | Frontend decision                                                                                |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Sales creation without sources | `POST /sales-orders` permits omitted allocations                                                                                                     | Save Draft permits omitted allocations; Confirm Order saves explicitly selected full allocations |
| Sales confirmation             | `PATCH /sales-orders/:id/confirm`, non-empty Draft only; reserves full allocations                                                                   | Create/confirm works with selected full allocations; existing source-free drafts cannot confirm  |
| Outgoing creation              | `POST /outgoing-deliveries`, Confirmed/Partially Delivered sales order; items require existing `salesOrderAllocationId` in the chosen warehouse      | Arrange quantities from existing allocations; no new allocation backend behavior                 |
| Purchase confirmation          | `PATCH /purchase-orders/:id/confirm`, non-empty Draft only; no stock movement                                                                        | Separate confirmation and optional incoming arrangement                                          |
| Incoming creation              | `POST /incoming-deliveries`, Confirmed/Partially Received purchase order; destination warehouse and order-item quantities                            | Destination and receiving quantities stay in this form                                           |
| General sales editing          | No PATCH/PUT endpoint for sales-order metadata, lines, quantities, prices or allocations; the only PATCH routes are `/:id/confirm` and `/:id/cancel` | Skip editing in all states                                                                       |
| General purchase editing       | No PATCH/PUT endpoint for purchase-order metadata, lines, quantities or costs; the only PATCH routes are `/:id/confirm` and `/:id/cancel`            | Skip editing in all states                                                                       |

No Edit Order action was added for Draft, Confirmed, Partially Delivered/Received, or Delivered/Received orders. The existing composer draft-loading capability does not supply a backend save endpoint. Correcting 60 sacks to 70 on a saved order requires a supported update contract with state/fulfillment validation and the necessary audit/concurrency protection. No frontend-only persistence or fictitious save operation was introduced.

Moving sales sourcing entirely to outgoing arrangement requires a backend capability to set/update allocations before confirmation or a different supported reservation workflow. The current outgoing endpoint consumes allocations already persisted on the sales order. This pass does not change that boundary.

Existing server-side stock/state checks still decide conflicts when another employee changes records. Browser reload persistence, live concurrent requests and authenticated server behavior were not tested. No new reconciliation endpoints, driver accounts, GPS, offline proof of delivery, trip planning or multi-order manifests were implemented.

## One-click order confirmation

Both composers offer **Save Draft** and **Confirm Order**. No direct-confirm creation endpoint exists, so Confirm Order runs POST create followed by PATCH confirm using exactly the returned ID. Sales requires explicitly selected full allocations for confirmation with the current backend; its unfinished drafts may omit sources. Existing financial, customer/address, product, quantity and purchase cost validation and Admin/Manager permissions remain.

The shared `use-order-submission.ts` hook owns the saved identity, pending phases, synchronous submission lock, completion guard and confirmation errors. Creation failure keeps the editable values and makes no confirm request. Confirmation failure keeps the saved ID and all displayed values, reports the backend error, and replaces the actions with **Retry Confirmation** and Close. Retrying skips creation and repeats only confirmation for that ID. Existing saved drafts are also confirmed by ID, without creating replacements.

Once creation succeeds, fields and catalog additions become read-only because the backend has no saved-order update endpoint. Closing after failed confirmation leaves the draft accessible in the order list. The state remains in the mounted composer; refreshing relies on the server-saved draft and the list's existing Confirm action. Nothing is stored as local business data. Pending create/confirm requests block dismissal and both actions; repeated submit events and completed-flow submissions are ignored.

Only confirmation success shows Order confirmed; the confirmation hooks check the matching ID and CONFIRMED status before notifying. Both composers close on successful confirmation and keep saved-ID retry on failure. The draft-creation success notification is suppressed during the two-step confirmation flow, producing one success notification. Save Draft still shows Draft saved. Delivery preparation stays in Incoming/Outgoing Deliveries, reached explicitly from the list. No confirmation action navigates or creates/schedules a shipment.

Sales sourcing remains a backend dependency: the Sales Order has no warehouseId, but its item allocations refer to stockItemId records associated with warehouses. Confirmation rejects unallocated items, and outgoing creation consumes existing salesOrderAllocationId values rather than assigning new sources. The compact composer controls satisfy the current contract; moving sourcing entirely into outgoing preparation still requires the backend handoff described above. Purchase destinations remain in Incoming Deliveries.

Files changed for this addition: `src/hooks/use-order-submission.ts`, both domain order-entry hooks, both composer modals, both list views, `OrderEntryDialog.tsx`, both existing component suites, and new `src/hooks/order-submission.component.test.tsx`.

Current component coverage verifies source-free draft saving, compact source disclosure, explicit choice, split quantities, duplicate-source prevention, stock limits, single-source quantity synchronization, repeated product focus, validation focus, mobile state and API error retention. Both composers are tested through create/confirm, creation failure, saved-ID confirmation retry, duplicate requests and both explicit delivery-list navigation paths. Existing allocated sales list/detail confirmation and cancellation-modal coverage remain.

## Verification

- `npm test`: 39 unit tests and 48 component tests pass (87 total). Coverage includes compact sales source selection, both composers' create/confirm, notification-only success, saved-ID retry, duplicate events, consistent incoming actions and hiding fully arranged purchases. Picker tests cover partial/cancelled balances, an empty picker, and an exhausted selection after a query refresh. Catalog tests also cover the leftmost Add column, one addition per button/keyboard activation, whole-row additions, stock/read-only guards and repeated-row focus in the actual composers.
- `npm run build`: TypeScript and production build pass. The existing Vite chunk-size warning remains; the resulting JavaScript bundle is approximately 910 kB before gzip.
- `npm run lint`: passes.
- Targeted Prettier and `git diff --check`: pass.

New unit coverage checks direction/history membership, status transitions, active/history/expected dates, exact fractional/large balances and invalid decimal rejection. New component coverage exercises actual services and query/mutation hooks through a test-only HTTP adapter: sidebar routing, no duplicate page tabs, history, sales/purchase confirmation and explicit delivery navigation, confirmation failure, no automatic delivery creation, decimal shipment payloads, saved-draft retry, receive confirmation/error retry, filtering after completion and staff read-only detail access. Financial, catalog, purchase retry and responsive composer assertions remain; sales composer coverage tests source-free drafts and explicit allocations before confirmation.

The first new incoming arrangement test omitted the required receiving warehouse choice; it was corrected to exercise that choice. TypeScript also caught an unsupported Testing Library query option in new tests; the option was removed without changing the name assertions. Final results are the passing checks above.

Computer-use inventory returned no app or browser sessions. Desktop and landscape-tablet geometry, clipping, dropdown placement, scrolling and touch behavior remain unverified. Component tests run in JSDOM and cannot establish visual correctness. Live authenticated backend creation/confirmation/receipt/dispatch and reload persistence remain unverified. No live business records were created during QA.

Frontend changes are committed locally on `main`. Nothing was pushed.
