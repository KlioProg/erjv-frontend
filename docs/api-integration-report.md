# API integration audit

Verdict: **PARTIAL**. Confirmed frontend payload mismatches were repaired. Browser verification, deployment configuration and three backend concurrency safeguards remain outstanding. No production-readiness claim.

## Coverage

| Classification | Routes |
| --- | ---: |
| Discovered active backend routes | 122 |
| CONNECTED | 86 |
| PARTIAL (backend safeguards) | 3 |
| INTENTIONALLY UNUSED | 32 |
| DEFERRED | 1 |
| BACKEND BLOCKED within active route inventory | 0 |
| Unexplained | 0 |
| Repaired in this audit (subset of connected) | 14 |

Two legacy supplier-product pricing methods reference endpoints absent from the backend. Their requests are disabled; current Purchase Order manual unit costs remain supported. These two unsupported capabilities are recorded separately, outside the 122 discovered routes. Outgoing rescheduling is explicitly deferred; dates remain configurable in draft planning.

The [route matrix](api-integration-coverage.json) records every method/path, controller/handler, DTO, role, rule, API helper, active consumer, classification, action and verification scope. Source/controllers/DTOs are authoritative. The live generated OpenAPI has the same 122 routes. Checked-in backend swagger.json has 111 routes and is stale. A CONNECTED classification records contract compatibility and actual workflow use; it does not claim every route was exercised live.

## Repairs and preserved behavior

- Shared API handling rejects malformed list responses and disables automatic mutation retries. Unsupported dormant supplier pricing requests cannot reach invented routes.
- Sales drafts require a positive persisted revision. Current SO/PO composers, percentage/fixed discounts, server totals/statuses, current line IDs and confirmation permissions are preserved.
- Incoming header-only creation and the existing actual receiving form were verified, including partial/damaged/no-receipt cases, outstanding accepted quantities, conflict recovery and inventory/query refresh. No new receiving redesign was needed in this audit.
- Outgoing creation is header-only. Scheduling requires the saved revision. All three completion entry points now open one reconciliation form using actual loaded-item IDs. Delivered, sellable return, damaged return and missing quantities must total the load; damage/missing needs a reason. Mark All as Delivered fills fields only. Draft/scheduled cancellation remains; cancellation after dispatch is removed.
- Completion waits for the persisted response and refreshes deliveries, vehicles, inventory, warehouses, stock warnings, quarantine and SO fulfillment. Stale/uncertain outcomes require refresh before deliberate retry. No stock values are adjusted locally.
- The current backend supports manual warehouse inspection quarantine. The form uses actual stock IDs, available quantities, condition, reason and a stable request UUID; uncertain results are reviewed by that UUID before an explicit retry. Open-lot condition correction and supplied audit history are exposed. CLEAR/REMOVE remain, including the backend's Super Admin inheritance. Active/Archived, Products default, canonical DataTable and navigation are preserved.
- Catalog price and vehicle capacity serializers reject invalid precision/overflow instead of silently rounding. Nullable vehicle capacity is preserved. Removing an employee's final job uses supported DELETE operations; partial failures refresh staffing data.
- Four unreachable legacy delivery files were retired after confirming they had no active consumers. Their initial contents, including the prior uncommitted helper, are preserved locally in integration-retired-legacy.log. This removes the obsolete type errors without changing the active delivery architecture.

## Verification

- Full component suite: **552 passed, 0 failed, 0 skipped**, 64 suites. After the final React ref/state correction, the affected quarantine and API contract suites passed again: **37 passed**.
- Unit suite: **52 passed, 0 failed, 0 skipped**.
- Full ESLint: passed. TypeScript: passed. Git diff whitespace check: passed (existing line-ending notices only).
- One consolidated production build: passed with process-only VITE_API_BASE_URL=https://api.example.invalid. Actual production API origin is absent. No environment file was changed. Existing large-bundle warning remains (approximately 994 kB JavaScript before gzip).
- Live isolated HTTP integration: **15 checks passed**, **52 successful calls** across **38 distinct routes**, plus expected 400/401/403/404/409 rejections. Uses the actual frontend API modules against a separate Nest backend instance and localhost erjv_test. The existing application servers/business database were not mutated. Uniquely labelled fixtures remain only in the disposable test database; the bootstrap admin was deactivated.
- Live workflows: real login/profile; client/supplier/product/warehouse/employee/driver/vehicle fixtures; SO create/edit/stale revision/confirm/percentage discount; PO create/edit/confirm/fixed discount; header-only incoming schedule, no receipt with reason, partial receipt with damage, rejected over-receipt, exact physical/damaged/available balances and warnings; incoming quarantine source; idempotent manual tag, condition audit, CLEAR/REMOVE; one-warehouse outgoing planning/schedule; actual dispatch and reservations; forbidden dispatched cancellation; four-category completion; partial SO fulfillment, returned quarantine, released reservations and restored vehicle availability; completion replay without duplicate stock mutation; final employee-position removal; authentication/role/missing-record/validation failures.
- No browser automation was available. Desktop/short-viewport geometry, keyboard interaction in a real browser and complete role/device coverage remain unverified. Mocked tests cover UI behavior and network uncertainty; the HTTP exercise does not prove rendered browser flows. Verification ran on the available Node 24 host; the declared Node 22 deployment environment was not exercised.

## Backend handoff and release limits

1. DELETE /warehouses/:id: current service delegates to setActive and repository only changes the flag. The UI checks balances immediately before archive, but a concurrent stock/delivery change can race that write. Enforce required warehouse stock/delivery invariants inside the backend transaction.
2. PATCH /delivery-vehicles/:id/status and DELETE /delivery-vehicles/:id: repository writes status/isActive directly. Enforce active-shipment assignment and vehicle state restrictions transactionally, including concurrent dispatch. UI guards alone cannot guarantee these restrictions. These routes remain PARTIAL in the matrix.
3. Supplier reference-price storage has no active routes. Keep it unavailable until the backend publishes a supported contract; manual PO prices continue to work.
4. Regenerate the checked-in OpenAPI from the active backend. Document Sequences are internal numbering behavior; no document-sequence management route is exposed.

Critical receiving, planning, dispatch, reconciliation and quarantine workflows are suitable for further controlled operational testing based on static, mocked and isolated HTTP evidence. Warehouse archiving and vehicle state/archive concurrency need backend review. Configure the real HTTPS API origin and perform browser/device/role QA before a deployment decision. No known active frontend operation retains the confirmed incompatible payloads; route-specific live omissions remain explicit in the matrix.

Backend source/configuration/schema/migrations were read-only. Both initially dirty backend files were verified byte-for-byte unchanged. Existing frontend work outside the recorded changes was preserved. No dependencies, branches, commits or pushes were created.

## Frontend files changed in this audit

- [docs/inventory-notifications.md](inventory-notifications.md)
- [src/App.tsx](../src/App.tsx)
- [src/components/deliveries/DeliveriesHub.tsx](../src/components/deliveries/DeliveriesHub.tsx)
- Retired: `src/components/deliveries/DeliveriesTable.tsx`
- Retired: `src/components/deliveries/DeliveryCreateModal.tsx`
- Retired: `src/components/deliveries/shared/DeliveryItemsTable.tsx`
- [src/components/inventory/QuarantinedStock.tsx](../src/components/inventory/QuarantinedStock.tsx)
- [src/components/inventory/inventory-notifications.component.test.tsx](../src/components/inventory/inventory-notifications.component.test.tsx)
- [src/components/inventory/quarantine.component.test.tsx](../src/components/inventory/quarantine.component.test.tsx)
- [src/components/operations/VehicleModal.tsx](../src/components/operations/VehicleModal.tsx)
- [src/components/orders/OrderDetailDrawer.tsx](../src/components/orders/OrderDetailDrawer.tsx)
- [src/components/orders/OrdersView.tsx](../src/components/orders/OrdersView.tsx)
- [src/features/api-contracts.component.test.tsx](../src/features/api-contracts.component.test.tsx)
- [src/features/crm/sales-orders.api.ts](../src/features/crm/sales-orders.api.ts)
- [src/features/logistics/delivery-utils.ts](../src/features/logistics/delivery-utils.ts)
- [src/features/logistics/delivery-vehicles.api.ts](../src/features/logistics/delivery-vehicles.api.ts)
- [src/features/logistics/delivery-workflow.test.mjs](../src/features/logistics/delivery-workflow.test.mjs)
- [src/features/logistics/delivery-workflow.ts](../src/features/logistics/delivery-workflow.ts)
- [src/features/logistics/outgoing-deliveries.api.ts](../src/features/logistics/outgoing-deliveries.api.ts)
- [src/features/logistics/outgoing-deliveries.hooks.ts](../src/features/logistics/outgoing-deliveries.hooks.ts)
- [src/features/logistics/outgoing-deliveries.types.ts](../src/features/logistics/outgoing-deliveries.types.ts)
- [src/features/logistics/quarantine.hooks.ts](../src/features/logistics/quarantine.hooks.ts)
- [src/features/logistics/stock-items.api.ts](../src/features/logistics/stock-items.api.ts)
- [src/features/logistics/stock-items.types.ts](../src/features/logistics/stock-items.types.ts)
- [src/features/logistics/supplier-pricing.api.ts](../src/features/logistics/supplier-pricing.api.ts)
- [src/features/logistics/supplier-pricing.hooks.ts](../src/features/logistics/supplier-pricing.hooks.ts)
- Retired: `src/features/logistics/use-delivery-creation.ts`
- [src/features/products/products.api.ts](../src/features/products/products.api.ts)
- [src/features/staffing/staffing.api.ts](../src/features/staffing/staffing.api.ts)
- [src/features/staffing/staffing.hooks.ts](../src/features/staffing/staffing.hooks.ts)
- [src/lib/api-client.ts](../src/lib/api-client.ts)
- [docs/api-integration-coverage.json](api-integration-coverage.json)
- [src/components/deliveries/outgoing-completion.component.test.tsx](../src/components/deliveries/outgoing-completion.component.test.tsx)
- [src/components/deliveries/shared/CompleteDeliveryModal.tsx](../src/components/deliveries/shared/CompleteDeliveryModal.tsx)
- [src/components/inventory/CorrectQuarantineConditionDialog.tsx](../src/components/inventory/CorrectQuarantineConditionDialog.tsx)
- [src/components/inventory/ManualQuarantineDialog.tsx](../src/components/inventory/ManualQuarantineDialog.tsx)
- [src/components/inventory/quarantine-actions.component.test.tsx](../src/components/inventory/quarantine-actions.component.test.tsx)
- [src/features/integration-contracts.component.test.tsx](../src/features/integration-contracts.component.test.tsx)
- [src/features/logistics/outgoing-completion.ts](../src/features/logistics/outgoing-completion.ts)
- [src/features/logistics/use-outgoing-completion.ts](../src/features/logistics/use-outgoing-completion.ts)
- [src/features/logistics/use-quarantine-tag.ts](../src/features/logistics/use-quarantine-tag.ts)
- [docs/api-integration-report.md](api-integration-report.md)
