# Outgoing delivery scheduling refinement

Schedule Outgoing Delivery now follows a single sequence: searchable Sales Order selection, shipment quantities, source warehouse, scheduled date/time, optional vehicle/driver and instructions, then explicit Save Draft / Schedule Delivery actions. It reuses the existing dialog, SearchableDropdown, shipment DataTable, inputs and delivery services. No dependency was added.

## Order eligibility and quantities

The selector lists only CONFIRMED and PARTIALLY_DELIVERED orders with a positive remaining quantity on at least one order item. It omits fully arranged orders entirely, including those whose goods are still in draft, scheduled or dispatched shipments. Fully arranged is not a new order status and does not mean delivered. No order or delivery record is deleted, archived or changed to implement this filter.

Remaining quantities use the complete sales-orders and outgoing-deliveries responses, independently for each order item. Its saved allocation IDs associate shipment lines with that item. The inspected backend counts every delivery status except CANCELLED against an allocation, including saved drafts; the frontend uses the same rule. Cancelled shipments make their quantities available again after query refresh. Decimal strings use existing scaled-integer utilities, retaining fractional and very large balances. Different product units are never summed into a shipment total.

Options show order reference/customer once, followed by the count of remaining items. Search covers the full returned order list, including records beyond the first ten. No arbitrary first order is selected. Preselected orders remain identified if their eligibility changes; another order is never silently substituted. Empty and unavailable-balance explanations are compact text, without a Fully Scheduled dropdown badge or disabled order option. Unknown balances are not treated as zero; creation pauses until required data can be checked.

The selected order uses the canonical shipment quantity DataTable in its new optional compact mode: Product, Remaining, This Delivery. Secondary product text shows ordered and already-arranged quantities, plus the selected source's capacity. Fully arranged lines are omitted unless an employee's retained quantity still needs correction after a conflict. Zero skips a line. Incoming deliveries retain the table's existing columns and behavior.

## Warehouse and optional details

Source selection follows order selection and the quantity table. Each delivery uses one explicitly chosen warehouse. Options have positive capacity from that order's persisted allocations at active warehouses; no arbitrary warehouse is selected. Shipment quantities cannot exceed the order balance, source allocation balance or known physical source stock. Confirmed-order reservations already cover these allocations and are not subtracted from the same source a second time. Server validation and existing stock movements remain authoritative.

Vehicle & Driver (Optional) starts collapsed with Assign later at dispatch. Explicit selections appear in its summary, stay mounted when collapsed and use the existing availability helpers. The form refetches their data when a selected assignment is submitted. An assignment failure opens the section, associates the error with its selector and focuses it. Instructions have a separate compact disclosure; collapsing retains their values. Controls have visible focus styles and coarse-pointer target sizing.

The modal removes its decorative header icon, destination ribbon, allocation card/background layers, routine warning banners and schedule-after-saving checkbox. Form content scrolls within the height-bounded dialog; the action footer stays outside that scroll region.

## Saving, scheduling and conflicts

Save Draft makes only the existing create request. Schedule Delivery creates a draft, then schedules exactly the returned ID with the existing PATCH action. The create toast is suppressed for this composer; draft success is shown only after a valid Draft response, and scheduled success only after a matching-ID SCHEDULED response. No dispatch, completion or physical stock movement is added.

A synchronous lock covers fresh-data checks, creation, scheduling and retries. Fields and dismissal are guarded throughout. The form refetches complete order, delivery, warehouse and stock data immediately before creation. A changed status, exhausted balance, reduced source capacity or unavailable assignment blocks the stale request and explains how to recover. Explicitly entered quantities, order selection and optional values remain for correction. Backend creation failures also refresh affected information and retain the editable form.

Once creation succeeds, the saved ID is retained. A scheduling failure exposes Retry Schedule, which makes no second create request. Saved fields become read-only because there is no supported delivery-line update endpoint. A snapshot of the successfully saved shipment keeps its quantities and source visible even when its own draft consumes the final scheduling balance. This snapshot is presentation state in the mounted form, not additional business persistence; authoritative eligibility still counts the saved draft. Closing leaves it available in Outgoing Deliveries. Successful saving/scheduling refreshes balances and shows a concise result with Done. Reopening uses persisted responses; fully arranged orders no longer appear.

## Backend boundaries verified read-only

- `sales-orders.service.ts`: `requireDeliverable` permits CONFIRMED / PARTIALLY_DELIVERED only.
- `outgoing-deliveries.service.ts`: create accepts existing `salesOrderAllocationId` quantities at the chosen warehouse and checks their remaining balance; schedule accepts a saved DRAFT ID. Vehicle/driver assignment can be deferred to dispatch.
- `prisma-outgoing-deliveries.repository.ts`: `deliveredQuantity` includes every shipment except CANCELLED.
- Both inspected list repositories return complete arrays; the composer requests unfiltered outgoing records for balance calculations rather than using only the visible delivery table page.

**Sourcing dependency remains:** outgoing creation consumes allocations already saved on Sales Order items. It cannot assign a new stock source to an unallocated order through the current contract. This refinement does not move allocation persistence, change Sales Order confirmation, generate allocations or add multi-warehouse shipments. Choosing an available persisted source here is supported; sourcing previously unallocated orders requires a backend contract change.

Fresh checks reduce stale submissions; they do not provide server-side concurrency isolation or guarantee that no record changes between GET and POST. Existing backend checks remain responsible for that race. No optimistic business success, new endpoint or browser-only inventory state was added.

## Files

| Area                           | Files                                                                                                                                                                                                                     |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Scheduling UI                  | `src/components/deliveries/ScheduleDeliveryModal.tsx`                                                                                                                                                                     |
| Compatible shipment table      | `src/components/deliveries/DeliveryQuantityTable.tsx`                                                                                                                                                                     |
| Exact eligibility/source rules | New `src/features/logistics/outgoing-order-balance.ts`                                                                                                                                                                    |
| Existing mutation hooks        | `src/features/logistics/outgoing-deliveries.hooks.ts`                                                                                                                                                                     |
| Tests                          | New `src/features/logistics/outgoing-order-balance.test.mjs`, `src/components/deliveries/outgoing-scheduling.component.test.tsx`; updated `order-delivery-workflow.component.test.tsx` and unit command in `package.json` |

## Verification

- `npm test`: 47 unit tests and 67 component tests pass (114 total).
- `npm run build`: TypeScript and production build pass. The existing Vite chunk-size warning remains (approximately 894 kB JavaScript before gzip).
- `npm run lint`: passes.
- Targeted Prettier and `git diff --check`: pass.

New unit coverage checks deliverable states, all non-cancelled shipment statuses, independent per-item balances, cancelled release, fully arranged versus delivered, exact fractional/large values, unknown data, source capacity, and mapping only existing allocation IDs. Component coverage uses actual services/query hooks with a test-only HTTP adapter: searchable full-result eligibility, keyboard selection, compact columns, draft-only saving, optional values after collapsing, create-then-schedule sequencing, failed schedule and saved-ID retry, duplicate events in both phases, refreshed/reopened eligibility, concurrent exhaustion and partial conflicts, creation error retention, query recovery and disclosed optional-field errors. The former outgoing retry test now explicitly chooses its source and uses Done after success. Test assertions/timeouts were not loosened.

Computer-use inventory returned no apps or browser sessions. Desktop and landscape-tablet geometry, dropdown placement, clipping, scrolling and actual touch interaction remain unverified. Component tests run in JSDOM, not a rendered browser. Authenticated backend scheduling, reload persistence and simultaneous employee requests were not exercised live; no live business records were created.

All changes are frontend-only. Backend, schemas, migrations, Sales Order confirmation and stock business rules remain unchanged. Earlier frontend work is retained and committed locally on `main`; nothing was pushed.
