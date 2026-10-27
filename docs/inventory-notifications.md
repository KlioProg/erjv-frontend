# Inventory cleanup and global stock warnings

Inventory opens directly to its canonical DataTable. The page hierarchy is Inventory, Active/Archived, Search/Register Product, then Product, Wholesale Price, Total Stock, Available, Locations and permitted Actions. Existing responsive column visibility and mobile product actions are preserved.

The extra outer inventory card border/padding and the stock-breakdown cards are removed. Product registration, editing, archiving, restoration, searching, employee-selected sorting, pagination and location navigation still use their existing services and controls. Archive failures now keep the confirmation open for correction/retry. Staff retain read-only access.

Warehouse Locations, Total Stored Units and Catalog Products remain in the existing Warehouses workspace with their existing calculations. Vehicle availability remains in the existing Vehicles workspace and its existing Available metric. No new dashboard or service was introduced.

## Stock conditions

Phase 4 uses backend `availableQuantity` and `stockStatus` as authoritative. The frontend does not subtract reservations or damage to recreate availability. Quantities and totals reuse the existing exact two-decimal utilities. Missing or malformed balances display as an em dash, separately from zero. A complete empty product stock list has zero physical total and no reported availability; it does not invent any warehouse association.

A product whose tracked locations all report OUT gets the existing destructive row treatment. An OUT location with stock elsewhere gets a location warning without declaring the whole product depleted. Expanded Locations and warehouse inventory tables show physical, reserved, damaged and available balances. Shared status badges distinguish NORMAL, LOW, OUT, UNCONFIGURED (Threshold not set), and missing status (Stock status unavailable). Archived products retain their balances without active shortage indicators.

Default ordering sorts the full returned product array by OUT, LOW, NORMAL, UNCONFIGURED, UNKNOWN condition, then name and ID before DataTable pagination. Explicit employee sorting takes precedence; search still operates on the full list. Notification navigation clears the previous workspace filters and opens the page containing the requested product.

**Backend contract:** read-only inspection of the stock response DTO and mapper confirms `quantity`, `reservedQuantity`, `damagedQuantity`, `availableQuantity`, `reorderThreshold`, and `stockStatus`. LOW and OUT come exclusively from that status; missing statuses remain unknown. No threshold defaults, transfer workflows, or allocation controls were introduced.

## Shared header notifications

The shared header now has a stock notification bell. The former Product Catalog shortcut duplicated Inventory access and is removed. ADMIN Mode was a role label, not an operational switch; permissions and the existing sidebar account/profile menu remain. The profile trigger is a keyboard-accessible button, and Sign Out remains available.

Each warning identifies an active product, active warehouse/store, quantity, unit and severity. IDs use product ID, location ID and condition, and duplicate alerts are removed. Missing, archived and malformed source records do not produce invented notifications. Selecting an alert navigates to Inventory, opens the correct product's Locations, selects its pagination page and focuses/highlights the affected location. Removed/archived products and missing locations have safe explanatory fallbacks.

The bell shares the inventory catalog's all-products query and the existing stock-items and warehouses caches. Existing mutation invalidations refresh warnings after supported stock operations. Opening the menu refreshes those queries without cancelling/refetching an already pending request; entries pause during refresh. No polling was added. All Warnings includes LOW + OUT only. Severity and warehouse filters determine both the displayed count and the View All inventory destination. The bell badge remains the global unresolved warning count.

The badge counts unresolved shortages, not unread messages. Reading does not remove a warning; changing its authoritative stock balance does. Loading, failure/retry and empty states are distinct. No notification endpoint, localStorage business state, persistent read/unread behavior or unsupported delivery notification category was introduced.

## Phase 4 files

- Inventory: `src/components/inventory/InventoryItemCatalog.tsx`, new `StockBalanceSummary.tsx`.
- Warehouses: `src/components/operations/WarehouseInventory.tsx`, `WarehouseProducts.tsx`, `WarehouseModal.tsx`.
- Warning popover/cache: `src/components/layout/StockNotifications.tsx`, `src/features/logistics/stock-warnings.ts`, `stock-warnings.hooks.ts`, `stock-alerts.hooks.ts`.
- Stock contract and catalog aggregation: `src/features/logistics/stock-items.types.ts`, `src/features/products/products.catalog.utils.ts`.
- Tests: `src/features/products/products.catalog.test.mjs`, `src/features/logistics/stock-warnings.test.mjs`, `src/components/inventory/inventory-notifications.component.test.tsx`, `src/components/layout/stock-notifications.component.test.tsx`, new `src/components/operations/warehouse-modal.component.test.tsx`.

The warehouse form now blocks duplicate submission during its asynchronous name lookup. Failed restoration keeps the form open with a visible API error and a retry action. Existing listing, details, create/edit API mappings, archive stock checks, and backend restrictions remain in place. Existing stock and delivery mutation invalidations were inspected and exercised by the inventory integration tests; no delivery workflow edits were needed.

## Phase 3 handoff audit

Baseline: merged HEAD `5a7f3ae`, including `2d83794` (PO-SO Implementation). The initial working tree had changes to `skills-lock.json` and untracked `.codex/skills/`; these were preserved. No pre-existing Phase 3 verification log was found in the relevant repository documentation. Fresh baseline logs were captured before implementation in `.phase4-baseline-tests.log`, `.phase4-baseline-build.log`, and `.phase4-baseline-lint.log` (local ignored artifacts).

The baseline component run had 134 passes, six failures, and one unhandled purchase-confirmation rejection. Four failures look for the old purchase composer button label `Confirm Order`; merged purchase code uses `Confirm & Export Receipt`. The rejection comes from the purchase list confirmation path. The other two baseline failures were a Sales composer timeout and an asynchronous zero-total assertion; they pass in the final reduced-concurrency run. Full lint reported the purchase view's `react-hooks/preserve-manual-memoization` error. TypeScript/build reported 46 diagnostics, including obsolete stock-alert polling arguments and mismatches in legacy order/delivery components.

Historical inspection of `018b2c7` confirms the stock-alert call mismatch, old OrderItemsTable field references, and missing delivery-workflow exports already existed before `2d83794`. The purchase label and confirmation callback changed in `2d83794`, which also includes delivery-planning changes. This establishes that the remaining blockers predate Phase 4; it does not establish that every blocker predates all Phase 3 work. No regression was isolated to the Phase 3 delivery-planning changes. Purchase workflow changes remain outside the explicit Phase 4 edit scope.

## Phase 4 verification

- `npm run test:unit`: **51/51 pass**.
- Focused component run covering inventory, warnings, warehouse form, suppliers, deliveries, routing, and Sales Order drafts with `--maxWorkers=2`: **160 pass, four fail, one unhandled rejection** across nine files (164 tests). The four failures and rejection are the purchase issues reproduced before implementation. All affected inventory/warehouse/warning tests and the outgoing-planning/Sales Order draft/routing suites pass.
- The first consolidated component run under default concurrency hit additional five-second timeouts. The bounded-concurrency rerun removed those timing failures without changing timeouts or disabling assertions.
- Changed-source ESLint and targeted Prettier: **pass**.
- `npm run lint`: **blocked by the same existing PurchasesView memoization error**.
- `npm run build` (includes `tsc -b`): **blocked by 43 existing TypeScript diagnostics**, down from 46 after correcting the three stock-alert hook calls. Diagnostic comparison found no newly introduced errors. Vite production bundling does not run because TypeScript fails.
- `git diff --check`: **pass**.

Local final logs: `.phase4-unit.log`, `.phase4-components-limited.log`, `.phase4-lint.log`, `.phase4-build.log`. The entire component suite was not run; the targeted regression selection above covers the affected modules and requested order/delivery checks.

No browser/computer automation tool was available. Rendered desktop/tablet geometry, overflow, popover placement, and live authenticated backend behavior remain unverified. JSDOM tests establish DOM behavior, not visual QA. No production readiness claim is made while broader checks remain blocked.

The integration depends on the existing backend stock endpoints supplying the published balances and status. Missing values remain explicitly unavailable; no new backend endpoint is required. Backend files, authentication, API contracts, excluded order/delivery workflows, branches, commits, and pushes were not changed.

## Inventory and quarantine navigation finalization

Products remain the default Inventory view, with Active / Archived as the primary product filter. Quarantined Stock is a secondary heading action, with a Back to Products action that preserves catalog filters. Warehouse-row View Quarantine actions open existing lots only. Incoming damaged receiving and damaged outgoing returns are explained in the lot view and empty state. Existing CLEAR/REMOVE permissions, confirmations, and authoritative cache refreshes are preserved.

The subsequent API integration audit verified current backend support for warehouse inspection quarantine. Quarantined Stock now offers the supported manual tag operation with a stable request UUID, current available-stock limits, condition, and inspection reason. Staff can tag stock; managers and admins (including Super Admins) can correct an open lot's condition and resolve CLEAR/REMOVE. Lot details expose the supplied audit history. An uncertain tag requires review and uses the same request ID for any deliberate retry. No quantity-editing workaround or client-side stock mutation is used. See `api-integration-coverage.json` and `api-integration-report.md` for current verification and remaining backend findings.
