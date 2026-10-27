# Inventory, quarantine, and delivery repair — 2026-10-27

Backend source was inspected read-only. Its working tree remained clean. Existing frontend staged, unstaged, and untracked work was retained; no commits or pushes were made.

## Findings and status

| Issue | Owner | Result | Evidence and correction |
| --- | --- | --- | --- |
| Report Stock Condition | Undetermined for the reported failure | NOT VERIFIED | The existing form sends the correct POST contract, selects a warehouse stock record, validates positive decimal quantities against availability, and retains UUIDs across unchanged retries. Regression tests pass, including selecting a different warehouse. The actual-controller HTTP harness accepts its body with 201. No persisted failure could be reproduced without a running authenticated application; no speculative report logic change was made. |
| Quarantined Stock | Backend | BACKEND BLOCKED | Actual Nest controller registration reproduces the exact GET 400 numeric-string error. The static route is captured by the earlier stock-item `:id` route. Query filters are valid, and the quarantine service is never reached. No alternate endpoint workaround was added. |
| Incoming receipt | Frontend | NOT VERIFIED end to end; frontend repair tested | The active confirmation sent no body. A disconnected receiving form also used delivery receipt lines instead of current PO lines and omitted damage. It now loads current delivery and PO records, collects actual received and damaged quantities, sends positive receipt lines, validates accepted capacity, and supports explicit no-receipt with a reason. |
| Outgoing confirmation | Frontend | NOT VERIFIED end to end; frontend repair tested | Dispatch omitted `items` and completion sent no body. Both defects were reproduced through actual controllers. Dispatch now reloads the scheduled delivery, displays its plan, resolves actual stock IDs within its warehouse, and collects loaded quantities. Completion accounts for every loaded line and requires category totals and discrepancy reasons. The observed browser click's exact stage cannot be established without that browser session; both broken handlers were repaired. |

## Exact request contracts

Report: `POST /stock-items/quarantine-lots`; the existing and retained body is `{ stockItemId: 22, condition: "DAMAGED", quantity: "1.50", reason: "Shelf damage", requestId: "9cbe4d22-a30e-4df1-97ce-79da5b23e8fd" }`. No physical-stock adjustment is sent by the frontend. Stock, product, warehouse, quarantine, and related logistics caches continue to refresh through the existing quarantine hooks.

Quarantine: `GET /stock-items/quarantine-lots?openOnly=true`, without a body or stock-item query parameter. Selected filters use positive stock record IDs, condition, and a boolean `openOnly`; tests verify that an unspecified stock ID does not become `undefined`, an empty string, or `NaN` in the URL. Empty successful responses show the existing empty state; CLEAR, REMOVE, and correction behavior remains covered.

Incoming: `PATCH /incoming-deliveries/:id/complete`, previously no JSON body. It now sends `{ items: [{ purchaseOrderItemId: 25, receivedQuantity: "100.00", damagedQuantity: "10.00" }] }`. This means 100 physically received, including 10 damaged. Products that did not arrive are omitted, rather than submitted as zero-positive receipt lines. Explicit no-receipt sends `{ items: [], noReceiptReason: "Supplier did not arrive" }`. Regular receiving never substitutes an empty array. Receipt completion refreshes PO progress, stock, products, warehouses, incoming deliveries, and quarantine; errors refresh the same caches.

Dispatch: `PATCH /outgoing-deliveries/:id/dispatch`, previously `{ deliveryVehicleId, driverEmployeeId }`. It now includes `items: [{ salesOrderItemId: 15, stockItemId: 22, loadedQuantity: "2.00" }]` alongside the vehicle and driver. Planned quantities are reference limits, not automatically loaded goods. Stock, order, plan, aggregate availability, duplicate, and nonempty checks run before submission; the backend remains authoritative for concurrency.

Completion: `PATCH /outgoing-deliveries/:id/complete`, previously no JSON body. It now sends `items: [{ outgoingDeliveryItemId: 9, deliveredQuantity: "1.00", returnedSellableQuantity: "0.00", returnedDamagedQuantity: "1.00", missingQuantity: "0.00", discrepancyReason: "Broken" }]`. All four quantities require explicit entry and must sum to actual loaded quantity. Damage or missing units require a reason. Orders and delivery screens share this form. Success and conflicts refresh delivery, order, stock, fleet, warehouse, product, and quarantine caches.

Cancellation is offered only for outgoing DRAFT and SCHEDULED statuses. Orders' older quick-dispatch path now composes the existing persisted scheduling form and the explicit dispatch form, preserving source warehouse and revision handling.

## Backend developer handoff

Conflicting sources in `erjv-backend`:

- `src/stock-items/stock-items.module.ts:16`: `controllers: [StockItemsController, QuarantineController]`.
- `src/stock-items/stock-items.controller.ts:119`: `@Get(':id')`, with `ParseIntPipe`.
- `src/stock-items/quarantine.controller.ts:46`: `@Controller('stock-items/quarantine-lots')`; its list handler is `@Get()` at line 60.

Register the static quarantine route before the generic stock-item ID route. Add a regression test that boots both controllers in the real module order, requests the quarantine path with and without filters, and asserts that the quarantine list handler receives those filters. Also retain a numeric stock-item lookup assertion. The existing quarantine HTTP test boots only QuarantineController, so it cannot detect this collision.

In a temporary in-memory HTTP harness, current ordering returned 400 with `Validation failed (numeric string is expected)` and zero quarantine-service calls. Reversing only the test registration order returned 200 and `[]`. POST returned 201 under the original order, so the GET collision does **not** establish a report-POST routing blocker. No backend file was changed to perform either check.

## UI and files

Report Stock Condition is now an outline, small button immediately left of the existing primary Register Product button, inside the same wrapping action group with an 8px gap. Search, archive filters, tab navigation, permissions, and DataTable remain in place.

Files changed for this repair (in addition to this report):

- Inventory: `InventoryHub.tsx`, `InventoryItemCatalog.tsx`, `stock-condition-report.component.test.tsx`, `quarantine-lot.component.test.tsx`, `inventory-notifications.component.test.tsx` under `src/components/inventory/`.
- Delivery components: `DeliveriesHub.tsx`, `ReceiveProductsModal.tsx`, `ScheduleDeliveryModal.tsx`, `shared/DispatchDeliveryModal.tsx`, new `shared/CompleteDeliveryModal.tsx`, new `delivery-confirmation-forms.component.test.tsx`, `outgoing-scheduling.component.test.tsx`, and `order-delivery-workflow.component.test.tsx` under `src/components/deliveries/`.
- Order callers: `OrdersView.tsx`, `OrderDetailDrawer.tsx`, and `QuickDispatchModal.tsx` under `src/components/orders/`.
- Logistics contracts: `incoming-deliveries.api.ts`, `.hooks.ts`, `.types.ts`; `outgoing-deliveries.api.ts`, `.hooks.ts`, `.types.ts`; `delivery-workflow.ts`, `delivery-workflow.test.mjs`; new `delivery-confirmation.component.test.tsx`; and `quarantine-contracts.component.test.tsx` under `src/features/logistics/`.

## Verification and limitations

- Focused component tests: 101 passed across eight files. The updated receipt workflow regression also passed separately. Tests cover receipt, damage, partial/no receipt, empty arrays, loaded stock IDs, reconciliation, duplicate plans, conflicts, cache invalidation, report UUID behavior, quarantine filters and empty states, and both inventory buttons.
- Stock and delivery unit checks: 21 passed.
- ESLint on changed source and test files: passed.
- Actual Nest controllers, DTOs, validation pipes, and workflow-body interceptors were exercised over HTTP. Old receipt/dispatch/completion bodies returned 400; corrected bodies returned 200, and report POST returned 201. Guards and service persistence were replaced in this harness: these results prove routing and DTO acceptance, **not database acceptance or stock movements**.
- The consolidated `npm run build` stopped at TypeScript. A follow-up TypeScript check after correcting a new test typing error reports only baseline errors: obsolete delivery/order/purchase components, missing older quantity helpers, stock-alert hook signatures, and order-discount test mocks. No errors remain in the new forms or updated API contracts. Vite bundling did not execute.
- A wider workflow test run also exposed four purchase-composer failures and a purchase-confirmation unhandled rejection in paths outside this repair. Its receipt test was updated to use the explicit receipt form and passes separately.
- No local HTTP API/Vite listener or connected browser session was available. Browser freshness, deployed backend/source parity, persisted writes, rendered responsive layout, and visual accessibility remain unverified. The optional `lint_hardcodes` UI gate could not run: its server returned exit 9009 because Python was unavailable to that server.

The overall definition of done remains blocked by backend quarantine routing and by the unavailable live application verification. Existing repository TypeScript errors also prevent a production build.
