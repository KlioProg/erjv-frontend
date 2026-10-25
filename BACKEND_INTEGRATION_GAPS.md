# ERJVPOS Backend Integration Gaps

Date: 2026-10-24 (Asia/Manila)

## Outcome and scope

No confirmed backend defect or missing API capability blocks the existing, active core frontend workflows reviewed in this integration pass. This is a source-contract assessment with focused frontend tests, not a production acceptance or concurrency audit.

Backend files and database state were not modified. Existing frontend integration work was preserved. No commits, merges, or pushes were performed.

## Frontend integration status

| Module | Status | Remaining work |
| --- | --- | --- |
| Sales | Existing customer CRUD, sales pricing/details, and warehouse-free order creation/confirmation match source contracts. | Authenticated end-to-end QA. |
| Purchases | Supplier CRUD, supplier-less drafts, draft editing, agreed line costs, and admin-only confirmation are integrated. Cleared draft reference/notes now persist; supplier actions respect permissions. | Authenticated end-to-end QA; optional reference pricing below. |
| Inventory/Warehouses | Warehouse inventory, threshold editor, warning scope/navigation, and available-stock status are integrated. | Configure thresholds where low-stock warnings are wanted; real movement QA. |
| Deliveries | Per-line warehouse sources, partial quantities, history, vehicle assignment, and cache refresh use existing contracts. Cancellation refreshes released stock reservations. | Live receiving/dispatch/completion and concurrency QA against a designated test database. |
| Staffing | Employee/job/account APIs, account-link failure recovery, and user-management permissions match source contracts. | Live role-matrix QA. |
| Authentication | Existing bearer-token requests, profile validation, session expiry, and cache clearing are covered by focused tests. | Live login/session QA. |

## Supported capabilities: do not treat these as backend gaps

- **Sales confirmation without warehouses:** `POST /sales-orders` accepts customer, destination, and product lines. `PATCH /sales-orders/:id/confirm` takes no allocation body. `SalesOrdersService.confirm` changes a non-empty draft to confirmed. Sources belong to outgoing preparation.
- **Outgoing allocation and partial fulfillment:** `POST /outgoing-deliveries` takes `salesOrderId` and lines containing `salesOrderItemId`, `stockItemId`, and decimal-string `quantity`. `OutgoingDeliveriesService.create` checks remaining order quantities and reserves selected stock. Cancellation releases reservations; completion applies backend-owned outgoing movements.
- **Purchase drafts and pricing:** `CreatePurchaseOrderDto.supplierId` is optional. `PATCH /purchase-orders/:id/draft` supports supplier, date, reference, notes, and replacement lines, including agreed `unitPrice`, discount and tax rates. `PurchaseOrdersService.confirm` requires an active supplier; the controller permits ADMIN confirmation (including any inherited role access defined by backend guards), while ADMIN/MANAGER may create/edit drafts.
- **Actual receiving quantities:** `POST /incoming-deliveries` records per-line decimal-string `receivedQuantity` and the destination warehouse. Completion uses those stored quantities; its request does not accept replacement quantities. Multiple incoming transactions support partial receiving.
- **Completion retry protection:** `IncomingDeliveriesService.complete` returns an already `COMPLETED` delivery; `OutgoingDeliveriesService.complete` returns an already `DELIVERED` delivery before applying movements again. Sequential retry protection is confirmed in source; simultaneous completion requests were not tested.
- **Warehouse thresholds:** `PATCH /stock-items/:id/reorder-threshold` accepts a decimal string or `null` for ADMIN/MANAGER. `stock-item.mapper.ts` derives status from physical stock minus reservations: available stock at or below zero is OUT; positive stock with no threshold is UNCONFIGURED; positive available stock at or below the configured threshold is LOW. There is no default or reorder-count-derived threshold.

Contract evidence is in the sibling backend repository:

- `src/sales-orders/sales-orders.controller.ts`, `dto/sales-order.dto.ts`, and `sales-orders.service.ts`
- `src/purchase-orders/purchase-orders.controller.ts`, `dto/purchase-order.dto.ts`, and `purchase-orders.service.ts`
- `src/outgoing-deliveries/dto/outgoing-delivery.dto.ts` and `outgoing-deliveries.service.ts`
- `src/incoming-deliveries/dto/incoming-delivery.dto.ts` and `incoming-deliveries.service.ts`
- `src/stock-items/stock-items.controller.ts`, `dto/set-reorder-threshold.dto.ts`, and `stock-item.mapper.ts`
- `src/employees/employees.controller.ts`, `src/employee-jobs/employee-jobs.controller.ts`, `src/users/users.controller.ts`, and `src/auth/auth.controller.ts`

## Optional capability requiring a product decision

### Supplier/product reference prices

- **Classification:** Missing API capability; the requirement to expose it is unconfirmed. This does not block current PO line pricing.
- **Priority:** Low until the feature is approved.
- **Module/feature:** Purchases, supplier reference costs.
- **Expected behavior if approved:** Store and retrieve a supplier-specific reference cost for a product, separately from the agreed price on an individual PO.
- **Actual backend behavior:** Supplier CRUD and PO line `unitPrice` are supported. The inspected supplier controller has no nested product-price GET/PUT routes; the inspected schema and purchasing code contain no `latestUnitCost` contract.
- **Relevant frontend contract:** Unused `src/features/logistics/supplier-pricing.api.ts` assumes `GET /suppliers/:supplierId/products` and `PUT /suppliers/:supplierId/products/:inventoryItemId` with `{ latestUnitCost }`. These are unsupported assumptions, not callable backend endpoints.
- **Evidence/reproduction:** Compare that API file with backend `src/suppliers/suppliers.controller.ts`, `src/suppliers/dto/supplier.dto.ts`, and `prisma/schema.prisma`. Search frontend callers: `SupplierPricesModal` and `usePurchaseOrderForm` are not connected to active screens. The active `PurchaseModal` uses the supported purchase-order entry hook.
- **Frontend impact:** Reference-price management and automatic supplier quotes cannot be enabled. Users can still enter agreed PO unit costs.
- **Recommended backend change:** First confirm whether reference pricing is required and who may change it. If approved, define persistence, nullable decimal precision, role permissions, and read/write DTOs before wiring the dormant UI. Preserve historical agreed PO line prices when reference costs change.

## Environment dependencies and unverified behavior

### Production API origin

- **Classification:** Environment/configuration dependency, not a backend defect.
- **Priority:** High for deployment; does not block local development through the existing proxy.
- **Expected behavior:** Production builds receive the actual HTTPS backend origin in `VITE_API_BASE_URL`.
- **Actual behavior/evidence:** The backend has not been deployed, as confirmed by the project owner; no production HTTPS origin exists yet. Without an origin, `npm run build` passes `tsc -b`, then Vite rejects configuration. With owner approval, a command-scoped `VITE_API_BASE_URL=https://example.invalid` allowed TypeScript and Vite production compilation to pass. The previous environment value was restored afterward; no placeholder was saved in configuration.
- **Relevant contract:** Frontend `vite.config.ts` requires an exact HTTPS origin without a trailing slash or path; `.env.example` documents the setting.
- **Impact:** Production compilation is verified, but the generated example-origin bundle cannot communicate with a real production API and is not deployment-ready. Vite also reports a JavaScript chunk exceeding 500 kB; bundle optimization is deferred from this integration pass.
- **Recommendation:** Continue local development through the existing `/api` proxy to `http://localhost:3000`. After backend deployment, supply the real HTTPS origin in the build environment and rebuild before deploying. Preserve the existing API configuration.

### Authenticated runtime and safe mutation testing

- **Classification:** Unverified environment/runtime behavior, not a confirmed backend defect.
- **Priority:** High before operational sign-off.
- **Evidence:** `http://localhost:3000/auth/profile` responds with HTTP 401 without credentials. This confirms reachability and rejection of that unauthenticated request, not successful login or database health.
- **Impact:** No live customer/order/staff mutation, reservation, receiving, dispatch, cancellation, or duplicate-completion workflow was exercised. No safe test database or test account was established for this pass.
- **Recommendation:** Run the dedicated QA pass with approved role-specific accounts and a designated test database. Verify concurrent allocation/completion, real cache reconciliation, session expiry, and deployed API-version parity. Do not reset shared data.

### Node runtime

- **Classification:** Environment version mismatch.
- **Priority:** Medium.
- **Evidence:** Verification ran on Node `v26.7.0`; `package.json` and `.nvmrc` specify Node 22.
- **Impact/recommendation:** Repeat deployment checks on Node 22 before release. Passing local checks do not prove identical behavior on the specified runtime.

## Verification boundary

| Final checkpoint | Result |
| --- | --- |
| `tsc --project tsconfig.app.json --noEmit --incremental false` | Passed. |
| Targeted domain unit tests across Sales, Purchases, stock, deliveries, and vehicles | 47 passed; none failed. |
| Five affected component suites: inventory notifications, order composer, suppliers, staffing registration, outgoing scheduling | 67 passed; none failed. |
| `git diff --check` | Passed; Git emitted line-ending conversion warnings only. |
| `npm run build` | Passed with owner-authorized, command-scoped `https://example.invalid`; environment restored afterward. Compilation only: generated bundle is not deployment-ready. Vite reported a chunk-size warning. |
| Earlier focused module checks | Business: 86 component tests and 20 unit tests passed. Logistics: 94 component tests and 27 unit tests passed. Targeted ESLint passed. These overlap the final checkpoint and must not be added together as unique tests. |

Focused frontend tests use the existing test-only HTTP adapter; passing results are not live backend verification. Earlier module passes covered business workflows, staffing permissions, authentication, delivery history, quantities, and vehicle assignment. The final checkpoint rechecks affected inventory/notifications, order entry, supplier permissions, staffing registration, and outgoing source selection, plus targeted domain unit tests and TypeScript.

Full browser QA, live mutation workflows, and concurrency testing are deferred. The frontend can proceed to that QA pass after environment prerequisites are supplied; it is not signed off for production.

## Parallel integration merge review

The subsequent merge review found that local `main`, `feat/codex-logistics`, and `feat/copilot-business` all point to `7412feb89316067748dd7016a071c76cb7f469fd`. Both feature worktrees are clean, and both branch diffs against main are empty. A read-only remote check found `origin/main` at that same commit and neither named feature branch published.

Consequently there are no feature commits to merge. The integration work exists as uncommitted changes in the main worktree. No merge was started, no index changes were made, and no commits or pushes were performed. Recording those changes on feature branches requires approval before normal merges can be prepared; merging the current empty branches would not record the integration work.

The reviewed pending tracked diff spans 26 files, with 427 inserted and 1,382 removed lines, plus this untracked report. It includes stock warning/threshold integration, inventory refresh, PO drafts and permissions, response typing, regression coverage, shared dropdown loading/disabled support, and six legacy file deletions. Searches found no remaining imports of the deleted legacy implementations; active order entry uses the separate shared `components/order-entry/OrderItemsTable.tsx`.

Sales-to-outgoing and purchase-to-incoming request fields were compared with the backend DTOs again. Order IDs and line IDs are passed through; outgoing source selection uses per-line stock IDs, while incoming preparation carries the destination warehouse and decimal-string receipt quantities. No additional frontend contract fix was required during this review.

| Merge-review verification | Result |
| --- | --- |
| Full configured unit suite | 48 passed. |
| Full component suite | 29 files, 286 tests passed. A concurrent test-only update was subsequently rechecked: all 38 tests in `order-delivery-workflow.component.test.tsx` passed, including supplier-less draft creation and supplier-required confirmation. |
| TypeScript application check | Passed. |
| Full `npm run lint` | Passed. |
| Production build | Passed with command-scoped `https://example.invalid`; original environment restored. Compilation only, not deployment-ready; chunk-size warning remains. |
| Diff whitespace/conflict checks | Passed; no unresolved index conflicts. |
| Real backend | Unauthenticated profile GET returned 401. Authenticated reads and safe-database mutations remain unverified. |

Remaining dependencies are unchanged: deployed API origin, approved test accounts/database, Node 22 verification, and a product decision before implementing supplier reference-price APIs. Normal merges remain pending source commits and user approval.
