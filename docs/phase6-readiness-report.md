# Phase 6 frontend readiness review — 2026-10-26

## Overall Verdict

**Blocked for production release.** The scoped SO/PO, inventory, warehouse, warning, quarantine, and outgoing planning paths were reviewed against the local backend source. Verified frontend defects were corrected, but TypeScript and the production build remain blocked by deferred delivery code. No live API, browser, visual, or device verification was performed.

## Baseline and boundaries

- Baseline: clean working tree at `3e56bff` (`Quarantine & Damaged Inventory Integration`), with no staged, unstaged, or untracked changes.
- Read repository AGENTS.md, existing Phase 4 evidence in `docs/inventory-notifications.md`, and relevant backend DTOs, controllers, service logic, and record types.
- Backend files remained read-only; backend working tree verified clean. No branch, worktree, dependency, lockfile, commit, or push changes.
- Phase 5 capabilities present: quarantine listing/details, stock context, CLEAR/REMOVE, role restrictions, destructive confirmation, duplicate guards, uncertain-result refresh, cache invalidation, and warehouse/inventory entry points. The original Phase 5 acceptance document was not supplied, so completion of that entire phase is not certified. Backend manual tagging and condition correction capabilities have no corresponding frontend action in the inspected integration; this QA pass does not implement them.

## Critical Issues Fixed

- **P0 — Misleading PO fulfillment:** receiving progress now uses backend `acceptedQuantity`; received damaged goods do not count toward fulfillment. Missing accepted quantities stay unknown. The existing receiving-progress component is connected to PO details, including loading/error/retry states.
- **P0 — Uncertain mutation duplicates:** SO/PO composer requests that lose their response, or return server errors with uncertain outcomes, block another submission and retain entered data. Outgoing planning similarly requires review; a lost create response requires finding the saved draft before another create.
- **P0 — Stock precision:** stock creation, adjustments, and reorder thresholds preserve exact decimal strings and reject invalid precision before sending. Removed `parseFloat(...).toFixed(2)` rounding.
- **P1 — PO confirmation rejection:** PO details catch rejected confirmation, display its error, retain the dialog, and prevent duplicate requests or dismissal while pending. List confirmation promises are handled. Confirmation validates the returned ID and status before exporting a receipt.
- **P1 — SO fixed draft discounts:** removed an obsolete capability guard after verifying current backend `UpdateSalesOrderDraftDto`, `SalesOrderLineDto`, and `prepareItems` support `discountAmount`. Full replacement retains intended lines and exclusive discount fields.
- **P1 — Repeated PO additions:** functional updates increment the selected product rather than ignoring repeated clicks or creating duplicate lines during rapid additions. Existing cost and invalid quantity text are preserved.

## UX Improvements

- SO/PO, warehouse, and quarantine forms ask before discarding unsaved entries.
- Warehouse forms cannot be dismissed during lookup/save/restore.
- Supplier product pickers honor disabled state, including if they become disabled while open.
- PO lists/details use exact backend monetary totals and show a meaningful unassigned-supplier label.
- Canonical DataTable remains in place. Removed the unused legacy SO allocation table only after verifying both order composers use `components/order-entry/OrderItemsTable` and exercising those consumers.

## Integration Verification

| Area | Evidence and limits |
| --- | --- |
| Sales Orders | Revision-bearing full draft replacement, refreshed revision, deliberate stale-revision reload, line identity preservation, create/confirm/cancel, status permissions, quantities, and flat/percentage discounts exercised by unit/component tests. Fulfillment helper uses confirmed `deliveredQuantity`, never loaded quantity. |
| Purchase Orders | Supplier-optional draft payloads, full line replacement, costs/discounts/tax/notes, ADMIN-only confirmation, rejection recovery, cancellation conflict dialogs, accepted receipt progress, and exact totals checked. Backend owns status transitions. |
| Inventory | Physical/reserved/damaged/quarantined/available values remain backend sourced. Missing fields remain unknown. Decimal stock serialization and product interactions covered. |
| Warehouses | Existing backend quantities and status remain authoritative; archive stock pre-check, stock visibility, threshold display, form submission, restore failure, pending/unsaved dismissal covered. |
| Stock Warnings | Existing shared caches and invalidations retained. ALL = LOW + OUT; warehouse filters, counts, backend classifications, UNCONFIGURED distinction, navigation, loading/error states covered. |
| Quarantine | Local controller verifies ADMIN/MANAGER resolution and ADMIN/MANAGER/STAFF listing. Action/quantity/reason payloads match. CLEAR/REMOVE, conflicts, unknown results, no optimistic stock changes, required refetches, role restrictions, duplicate guards, and discard behavior covered. |
| Existing planning | Header-only creation, one warehouse, planning-options mapping, plannedItems, expectedRevision, restoration, scheduling prerequisites, conflicts, and lost-create response guard covered. No allocation or stockItemId was added to draft planning. |

All integration checks above are source inspection and automated tests using test adapters, not live server verification. Existing shared table pagination/sorting, catalog search, accessible control names, focus, dialog guards, and mobile composer DOM behavior were exercised. Actual viewport geometry, contrast, screen-reader behavior, touch targets, and rendered overflow remain unverified because no browser tool was available.

## Files Changed

Paths below are relative to `src/` unless stated otherwise.

| Files | Purpose |
| --- | --- |
| `features/crm/sales-order-entry.utils.ts`, `features/crm/sales-orders.api.ts` | Allow the verified SO fixed-discount draft contract. |
| `features/crm/sales-order-entry.hooks.ts`, `features/logistics/purchase-order-entry.hooks.ts` | Detect unsaved edits; make PO catalog additions atomic and cumulative. |
| `hooks/use-order-submission.ts` | Retain data and block repeated requests after uncertain outcomes. |
| `components/order-entry/OrderEntryDialog.tsx`, `components/orders/OrderModal.tsx`, `components/purchases/PurchaseModal.tsx` | Wire unsaved-entry confirmation and uncertain-request submission locks. |
| `components/purchases/PurchasesView.tsx` | Recoverable confirmation, synchronous guard, exact totals, query state, compiler lint correction. |
| `components/purchases/PurchaseOrderDetailModal.tsx` | Confirmation recovery, pending dismissal guard, accepted receiving progress, exact money and supplier fallback. |
| `components/purchases/PurchaseReceivingProgress.tsx`, `features/logistics/purchase-orders.presentation.ts`, `features/logistics/incoming-deliveries.types.ts` | Show accepted goods rather than all received goods. Optional response fields preserve compatibility with existing delivery consumers. |
| `components/purchases/PurchaseOrdersTable.tsx`, `components/purchases/SupplierPricesModal.tsx` | Correct nullable supplier lookup and unsupported picker/overflow props. |
| `components/ui/SearchableDropdown.tsx` | Honor disabled state. |
| `components/operations/WarehouseModal.tsx`, `components/inventory/QuarantinedStock.tsx` | Unsaved-entry confirmation and warehouse pending-dismissal guard. |
| `features/logistics/stock-items.api.ts` | Preserve decimal strings; reject invalid precision. |
| `features/crm/sales-orders.presentation.ts`, `components/orders/SalesOrderProgress.tsx`, `features/logistics/outgoing-deliveries.types.ts` | Restore the missing SO progress helper using backend delivered quantities without changing delivery actions. |
| `components/orders/OrderItemsTable.tsx` (deleted) | Remove unused allocation-era table; active composers already use the shared canonical table wrapper. |
| `features/logistics/use-outgoing-planning.ts`, `components/deliveries/ScheduleDeliveryModal.tsx` | Require review after uncertain save/schedule outcomes. |
| `components/deliveries/DeliveriesHub.tsx` | Pass query loading/error/retry state to shared PO progress. |
| `features/logistics/purchase-entry.component.test.tsx`, `features/logistics/stock-precision.component.test.tsx` (new) | Rapid addition and exact decimal serialization regressions. |
| `features/crm/sales-order-draft.component.test.tsx`, `features/crm/sales-orders.presentation.test.mjs`, `features/logistics/purchase-orders.presentation.test.mjs`, `features/order-discounts.component.test.tsx`, `hooks/order-submission.component.test.tsx` | Discount, quantity, fulfillment, and unknown-outcome regressions; typed test mocks. |
| `components/order-entry/order-composer.component.test.tsx`, `components/deliveries/order-delivery-workflow.component.test.tsx` | Current confirmation labels, backend availability fixtures, discount serialization, unsaved data, confirmation errors, and shared progress assertions. |
| `components/deliveries/outgoing-scheduling.component.test.tsx`, `components/ui/searchable-dropdown.component.test.tsx` | Lost-create response and disabled picker regressions. |
| `components/inventory/inventory-notifications.component.test.tsx`, `components/inventory/quarantine.component.test.tsx`, `components/operations/warehouse-modal.component.test.tsx` | Explicit quarantine column expectation, unsaved data, and pending warehouse submission guards. |
| `docs/phase6-readiness-report.md` | This review and deferred delivery compatibility evidence. |

## Test Results

Final sequential component result: **390/390 tests passed across 35 files**, with zero failed tests and no reported unhandled rejection. Command: `npm run test:components -- --maxWorkers=1 --reporter=json --outputFile=phase6-final-tests.log`. The final package unit run (`npm run test:unit`) passed **52/52**.

- Before modifications: unit script **51/51 passed**; component run **359/372 passed**, **13 failed**, **one unhandled PO confirmation rejection**.
- Initial bounded baseline reproduced nine deterministic failures in the selected files: stale PO confirmation labels, a broad combobox assertion, and fixtures that omitted authoritative backend availability. Assertions were aligned to the published contract, not weakened by recalculating availability.
- Consolidated intermediate run: **374/387 passed**, **13 failed**; primarily five-second timeouts while checks ran concurrently, plus the stale warehouse column assertion.
- Sequential affected-file recheck: **113/114 passed**; the only failure expected six warehouse columns although the Phase 5 Quarantine column was present. Replaced it with an explicit seven-header assertion.
- Subsequent inventory/quarantine/warehouse run: **55/55 passed**.
- Expanded unit selection: **71 passed; one test-file load failure**. `features/logistics/delivery-quantities.test.mjs` imports removed `committedIncoming` (and related legacy exports), so its internal tests cannot run. It is outside the package's unit script and tied to deferred delivery integration; no tests were deleted or skipped.
- Local ignored evidence: `phase6-baseline-tests.log`, `phase6-focused-tests.log`, `phase6-consolidated-tests.log`, `phase6-recheck-tests.log`, `phase6-last-tests.log`, `phase6-final-tests.log`, `phase6-package-unit.log`, `phase6-unit.log`, `phase6-typescript.log`, `phase6-lint.log`, `phase6-build.log`.

## TypeScript / Lint / Build

- **Lint: PASS**, after correcting PurchasesView's captured memoized map and validating final edits.
- **TypeScript: FAIL**, 19 remaining diagnostics across `components/deliveries/DeliveriesTable.tsx`, `components/deliveries/ReceiveProductsModal.tsx`, `components/deliveries/shared/DeliveryItemsTable.tsx`, and `features/logistics/use-delivery-creation.ts`.
- **Production build: FAIL** at TypeScript; Vite bundling does not run. No claim is made about a production artifact.
- **Diff whitespace check: PASS.**

## Pre-existing vs New Failures

The working tree was clean before the baseline checks, establishing that the original PO rejection, lint error, 43 TypeScript diagnostics, and component failures existed at HEAD. The final 19 TypeScript diagnostics refer to untouched deferred delivery files and match baseline causes; scoped SO/PO/picker/test type blockers were removed. A sequential rerun distinguishes the timing failures from the one reproducible stale column expectation. The expanded unit-file failure is supported by its imports and the unmodified HEAD exports, rather than an assumption that an old failure is unrelated.

## Deferred Delivery Issues

These are release blockers for the corresponding actions. No excluded action was disabled or reimplemented.

| Severity / frontend | Current assumption | Required backend behavior / user impact | Future step |
| --- | --- | --- | --- |
| **P1 — `features/logistics/incoming-deliveries.api.ts`, `components/deliveries/ReceiveProductsModal.tsx`** | Completion sends no body; the older receive modal passes an object to a mutation that accepts a numeric ID. Creation sends line quantities that the current create DTO does not persist. | `CompleteIncomingDeliveryDto` requires `items` with purchaseOrderItemId, receivedQuantity, damagedQuantity; backend computes accepted quantities. Bodyless completion fails validation; the older modal can construct an invalid ID URL. | Separately integrate actual receipt entry, damage, zero/no-receipt outcomes, authoritative responses, and request types. |
| **P1 — `features/logistics/outgoing-deliveries.api.ts`, `components/deliveries/shared/DispatchDeliveryModal.tsx`** | Dispatch sends vehicle and driver only. | `DispatchOutgoingDeliveryDto` requires a nonempty items array with salesOrderItemId, stockItemId, loadedQuantity. The existing request fails validation. | Separately integrate load confirmation and source selection against current dispatch contracts. |
| **P1 — `features/logistics/outgoing-deliveries.api.ts`** | Outgoing completion sends no body. | `CompleteOutgoingDeliveryDto` requires a nonempty items array with outgoingDeliveryItemId, deliveredQuantity, returnedSellableQuantity, returnedDamagedQuantity, missingQuantity, and applicable discrepancyReason. Bodyless completion fails validation. | Separately integrate return confirmation and reconciliation; never infer actual outcomes from planned/loaded quantities. |
| **P1 — legacy delivery files listed under TypeScript** | Removed helper exports, SO allocations, old payloads, and obsolete component props still compile as though available. | Prevents building the app, including unrelated valid screens. | Separately reconcile or retire unused legacy delivery consumers after tracing live usage; do not restore removed allocations. |
| **Deferred — proof of delivery, driver accounts, truck-trip grouping** | No completed integration established in this review. | Not certified as ready; no replacement endpoints or business behavior invented. | Separate feature contracts and implementation. |

The user reported the “items must contain at least 1 elements / items must be an array” message during receive/complete delivery. Static inspection confirms missing item bodies in these actions; the exact live failing request was not captured. The min-size validation also exists on outgoing dispatch/completion, so the message alone is not proof of which endpoint failed.

## Remaining Risks

1. **Release blocking:** 19 deferred delivery TypeScript errors prevent production build.
2. **High:** legacy receipt, dispatch, and return actions are incompatible with current backend contracts. Recommend a separately authorized compatibility or feature-gating task before release.
3. **Medium:** no live authenticated backend testing, real revision concurrency, rendered responsive/accessibility checks, receipt popup/print verification, or production bundle validation.
4. **Medium:** expanded legacy delivery unit tests cannot load; package unit script does not include them.

## Production Readiness

SO/PO editing, inventory, warehouses, warnings, quarantine resolutions, and existing outgoing planning have automated evidence supporting the next controlled integration-testing step. They are not certified for production while the app cannot build and live/browser verification is outstanding. Incoming receipts, dispatch, returns, proof of delivery, driver accounts, and truck grouping remain explicitly deferred.
