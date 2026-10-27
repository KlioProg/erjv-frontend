# October 26 contract integration

Backend verified read-only at `8a3716d`; `59bcd64` is an ancestor. Both working trees were clean before work. Development requests use the Vite proxy to `http://localhost:3000`. A deployed backend revision is not established by this checkout.

The two named contract inventory documents were not found in either checkout. Current DTOs, controllers, repositories, and backend contract tests are the implementation reference pending their location.

## Implementation plan

- [ ] Add tested cursor traversal for the four workflow lists, retaining array-returning APIs for all existing TanStack Query consumers. Include filters in cache keys, abort cancelled reads, restart once on INVALID_CURSOR, and never publish a partial list as complete.
- [ ] Carry Purchase Order revisions through draft serialization and editing. On stale revision or state conflict, fetch authoritative values while preserving local input; require explicit reload before another save.
- [ ] Preserve structured API error code, message, and details; refresh affected workflow queries after conflicts without retrying mutations.
- [ ] Add Inventory stock condition reporting with frozen idempotent retry payloads, quarantine filters/history/corrections, and CLEAR/REMOVE actions using the verified stock endpoints. Reuse existing dialogs and DataTable; no sidebar changes or dependencies.
- [ ] Map condition quantities and authoritative available stock; invalidate shared stock/product/warehouse/warning caches after changes. Display shared warehouse planning capacity.
- [ ] Audit strict workflow DTOs and document remaining incompatible delivery writes. Existing partially migrated delivery code must not be patched with invented quantities or empty request bodies.
- [ ] Run focused tests, the full existing tests, TypeScript, lint, build, and available rendered UI checks. Report baseline failures separately.

## Scope and initial risks

Changes reach list services and hooks, PO API/types/editor/caller/tests, shared error formatting, stock APIs/types/hooks, Inventory and Warehouse controls, catalog availability, and outgoing planning display. Full nested order/delivery lines must remain intact. Stock is never changed optimistically; the backend owns all balances.

The baseline `tsc -b` fails in legacy delivery tables/creation/receiving, OrderItemsTable, SalesOrderProgress, PurchaseOrdersTable, SupplierPricesModal, stock-alert hooks, and order discount test typings. These failures predate this work. There is no quarantine view or quarantine API integration in the initial frontend despite the request referring to an existing view.

The current backend incoming create DTO accepts no items; incoming complete requires received and damaged quantities. Outgoing create accepts no vehicle, driver, or items; dispatch requires loaded item quantities and complete requires item reconciliation. Global/controller ValidationPipe configuration currently strips unknown fields (`whitelist: true`) rather than setting `forbidNonWhitelisted: true`; frontend payloads must still obey the DTOs.
