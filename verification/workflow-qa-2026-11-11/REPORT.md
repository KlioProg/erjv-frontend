# ERJVPOS workflow QA — 11 November 2026

**Consultation readiness: not yet verified end to end.** No authenticated business workflow or persisted stock movement was exercised. A warehouse transfer/trip contract mismatch is confirmed in the current source. Existing application code, backend files, and the two previously untracked tests were preserved. No commits, pushes, migrations, seeds, production requests, or inventory writes were performed.

## Workflow results

Results below describe end-to-end readiness; automated component coverage is reported separately.

| Workflow | Result | Important findings |
| --- | --- | --- |
| Sales → Outgoing → Trip → Results | Not Tested | Authenticated browser/API unavailable. Mocked checks cover order context, partial loading, duplicate submission guards, per-delivery results, and history. Trip management passes in isolation; ten departure assertions remain failing. |
| Purchase → Incoming → Receipt | Not Tested | Mocked checks cover PO context, actual received/damaged quantities, partial receipts, confirmation, history, and exhausted-order guards. Persisted inventory was not checked. |
| Warehouse Transfer → Receipt | Blocked | Current frontend sends a direct dispatch request that the current backend rejects. Existing already-dispatched transfers have a backend receipt compatibility endpoint, but live receipt and stock effects were not tested. |
| Warehouse Transfer → Trip | Blocked | **BLOCKED — Mandatory Warehouse Transfer Delivery Trip integration.** Backend implementation exists; frontend membership, transfer loads, and linked trip context are missing. |

## Environment and evidence

- Frontend commit: `caefeac`; backend commit: `9386c24`. Backend working tree was clean. Frontend began with untracked `customer-phone.component.test.tsx` and `shared/delivery-dates.component.test.tsx`; both remain untouched.
- Started the existing Vite development frontend at `http://127.0.0.1:5173`, using its existing `/api` → `http://localhost:3000` proxy. Frontend HTML returned HTTP 200.
- `http://127.0.0.1:3000/auth/profile` refused connection. The frontend's `/api/auth/profile` returned HTTP 502. See [environment.json](environment.json) and [vite.log](vite.log).
- Configured development database: `localhost:5433/erjv`; connection refused. A read-only connection probe to local port 5432 using the configured development identity returned PostgreSQL `28P01`. No alternative credentials were guessed and no database was changed.
- User confirmed there is no verified staging site or dedicated test account. No existing authorized, usable development session was available. No login credentials were invented, no authentication guard was bypassed, and no security checks were disabled.
- Chrome successfully rendered the unauthenticated desktop sign-in page at 1440 × 1000. [Screenshot](login-desktop.png). This verifies only that page's rendering, not successful sign-in, protected navigation, responsive workflow layouts, or accessibility compliance. Initial sandboxed Chrome crashed; the permitted retry outside the execution sandbox succeeded with an isolated temporary profile.
- Execution runtime was Node `v24.19.0`; frontend specifies Node 22.x and backend specifies `>=22.23.4 <23`. These checks therefore do not certify compatibility with the required Node runtime.
- Graphify CLI was unavailable (`command not found`). Read the existing graph JSON for scoped file locations instead; no application code was changed, so no graph rebuild was needed.
- No UX gates MCP tool was exposed. No protected-screen visual QA or automated accessibility audit was completed.

## Verification results

| Check | Actual result |
| --- | --- |
| TypeScript (`npx tsc -b`) | Pass, exit 0. |
| Existing unit suite (`npm run test:unit`) | 81 passed, 0 failed. |
| Initial targeted component run | 517 passed, 30 failed out of 547. |
| Isolated trip/paging/scheduling/transfer recheck (`--maxWorkers=1`) | 179 passed, 0 failed. The eight initial failures in these files did not reproduce. |
| Isolated order/departure/load-validation recheck (`--maxWorkers=1`) | 108 passed, 10 failed out of 118. All 58 order workflow cases and nine load-validation cases passed; 41/51 departure cases passed. Five initial composer failures did not reproduce. |
| Latest result per component file, including rechecks | **539 passed, 17 failed out of 556 unique cases.** This combines the latest evidence per file, not a single fresh all-file run. |
| Existing backend transfer/trip service tests | 9 passed, 0 failed. Unit/service checks with stubs; not authenticated API or database checks. |
| Authenticated browser and persisted stock scenarios | Not Tested / Blocked, as listed above. |

No assertions, test timeouts, application code, or test fixtures were changed to obtain these results. Serial rechecks reduced execution contention. Full failure names, commands, and per-file results are in [TEST-RESULTS.md](TEST-RESULTS.md).

## Confirmed P1: warehouse transfer dispatch cannot finish

Expected: save a transfer draft, assign it to a compatible trip, depart through that trip, then receive it once.

Actual current-source path:

1. `src/components/warehouse-transfers/WarehouseTransfersPage.tsx` offers **Review & Send** for a draft.
2. `src/components/warehouse-transfers/TransferForms.tsx` submits a `dispatch` command with only `expectedRevision`.
3. `src/features/warehouse-transfers/warehouse-transfers.api.ts` sends `PATCH /warehouse-transfers/:id/dispatch`.
4. Backend `src/warehouse-transfers/warehouse-transfers.service.ts:45` unconditionally rejects direct dispatch of an existing transfer with HTTP 409, code `TRANSFER_TRIP_REQUIRED`, message **Dispatch this transfer from its delivery run**.
5. Backend trip DTOs/controller support `warehouseTransfers`, `transferLoads`, `PATCH /delivery-runs/:id/warehouse-transfers`, and transfer reconciliation within a run.
6. Frontend `delivery-runs.types.ts` and `delivery-runs.api.ts` expose only sales delivery members/loads. `use-outgoing-dispatch.ts` loads only sales deliveries and blocks departure without them. Transfer types do not expose the backend's `runId`, `runNumber`, or `runStatus`.

Reproduction when the authenticated development API is restored: create or reopen an isolated transfer draft → Review & Send → Send Goods. Expect the backend's 409 response; the current UI has no way to complete the mandatory trip assignment. This reproduction is **source verified, not executed against the live API**.

The frontend transfer component fixtures accept direct dispatch and can pass while the real backend rejects it. They are not evidence of integration success. Adding the complete trip integration would be a feature change involving several contracts and stock-sensitive steps, beyond this checkpoint's low-risk regression-fix policy. No bypass or fabricated trip was added.

## Scenario evidence and remaining manual checks

All authenticated browser scenarios below are **Not Tested**. Each automated result uses isolated in-memory fixtures and mocked HTTP responses; it does not prove database persistence, real authorization, inventory ledgers, or exactly-once stock updates. Exact assertion outcomes and failures are in the JSON logs and [TEST-RESULTS.md](TEST-RESULTS.md).

| Scenario / actual automated action | Expected | Evidence and limit |
| --- | --- | --- |
| Sales: save draft, confirm saved ID, open planning from order | Keep order context; no automatic stock dispatch | All 58 order workflow assertions pass in the isolated recheck. |
| Sales: reopen outgoing draft and schedule its current revision | Resume without duplicate creation or repeated order selection | Passing order workflow and outgoing scheduling assertions; saved-record search case required recheck. |
| Sales: add compatible members to one trip | Assignment does not dispatch stock; reject incompatible/changed selections | Trip component assertions pass in the isolated recheck and exercise membership requests. No real stock comparison. |
| Sales: load a partial quantity, enter measured weight, send | Exact quantities/revisions; reject excessive loads and repeated submission | Passing outgoing-dispatch serialization/partial-load and pending-lock assertions. Additional review/recovery assertions fail; see test results. |
| Sales: record each delivery's full or exceptional outcome | Balance loaded goods; trip completes only after all members settle | Passing outgoing completion assertions, including independent member results and backend completion true/false. Stock impact unverified. |
| Sales: open related order from terminal history | Completed record and correct order remain accessible | Passing history/order-link assertions. Browser readability unverified. |
| Purchase: confirm and arrange from selected PO | Preserve PO/supplier and valid quantities; require destination | Passing PO handoff, receiving-selector, incoming scheduling, and isolated composer assertions. |
| Purchase: reopen saved incoming record | Resume saved revision without duplicate arrival | Passing incoming scheduling/order workflow assertions, including failed-schedule recovery. |
| Purchase: full, partial, damaged, or wholly damaged receipt | Submit actual counts and PO item IDs; damage must not count as good stock | Passing incoming receiving assertions, including partial damaged receipts. Database accepted/good/quarantine quantities unverified. |
| Purchase: click save twice or retry uncertain receipt | Block duplicate pending submits; refresh authoritative state | Passing incoming receipt pending/uncertain-response assertions. Real replay/inventory behavior unverified. |
| Purchase: fully received or fully arranged order | Prevent invalid additional scheduling | Passing exhausted-order and empty-picker assertions. Real concurrent capacity checks unverified. |
| Transfer: select source, add products, change source | Confirm before clearing products; preserve changes until explicit save | Passing source-change/reset assertions; catalog variant required recheck. |
| Transfer: save a valid draft | Distinct warehouses, valid exact quantities, no stock movement | Passing validation/serialization assertions; manager creation required recheck. No persisted stock comparison. |
| Transfer: send draft | Use mandatory delivery trip and dispatch once | **Blocked:** frontend direct dispatch conflicts with current backend; see reproduction above. |
| Transfer: receive all or mixed good/damaged/returned/missing goods | Balance outcomes and record completion once | Passing mocked reconciliation/uncertain-receipt assertions. Cannot validate new transfer chain past blocked dispatch. |
| Transfer: view completed/cancelled records | Preserve history and actual event dates | Passing transfer status/detail assertions. Linked trip details are absent from frontend contract. |

## UX Honeycomb review

This is a source/component review; protected screens were not visually inspected. No invented usability scores or click counts are assigned.

| Dimension | Finding |
| --- | --- |
| Useful | Sales planning, receipt counts, and transfer exception forms support the intended employee tasks in component checks. Transfer departure cannot achieve its purpose with the current backend. |
| Usable | Order-context handoffs and reopening saved drafts reduce repeated selection. Full receipt shortcuts retain an explicit review; actual task completion and desktop/tablet interaction remain unverified. |
| Desirable | Only the sign-in page was visually inspected; it renders without obvious clipping at the captured desktop size. No protected-screen appearance verdict. |
| Findable | Shared next-action columns, details, history, and related-order links have automated coverage. Transfers do not expose the required linked trip or an assignment action. |
| Accessible | Existing tests exercise labels, roles, and some keyboard dismissal. No full keyboard, focus, contrast, screen-reader, or tablet audit was run. |
| Credible | Transfer wording promises departure through Send Goods while the server requires a trip. Passing direct-dispatch mocks conceal this mismatch. |
| Valuable | Purchase and sales checks support continued demonstration preparation, but the complete inventory-sensitive workflows cannot yet be represented as verified. |

Confirmed friction: warehouse-transfer employees are directed to a backend-rejected action with no available trip assignment path. This creates an unavoidable dead end and retry effort. Duplicate order selection is specifically guarded by passing context-handoff tests; no additional unnecessary selections were measured in a real browser.

## Inventory, status, and known-test findings

- No persisted stock, financial, or authorization defect was confirmed, because authenticated/database checks were unavailable. No successful stock movement, exactly-once inventory update, scheduling neutrality, or trip departure deduction is claimed.
- Source and automated fixtures distinguish planning/assignment from departure and final receipt. Real transaction/ledger and concurrency behavior still require the database-backed checks.
- The seven known `backend-change-integration.component.test.tsx` failures reproduced: six invalid replacement-job-ID cases and one receipt-detail column assertion (`Damaged at receipt`). The first six concern staffing, outside these workflows; the last affects confidence in historical receipt/damage presentation and should be reviewed before demonstrating receipt history. They were recorded without unrelated fixes.
- Additional failures and isolated rechecks are recorded in [TEST-RESULTS.md](TEST-RESULTS.md). Assertions expecting **Refresh trip data** do not match the current **Refresh trip and review current data** label. The departure modal also no longer exposes the separately expected **Review Departure** action. These are verified assertion/implementation differences, not proof by themselves of failed stock handling or safe recovery.

## Manual authenticated browser checklist

Use an existing authorized development account and isolated non-operational records. Capture record IDs, quantities, statuses, screenshots, and stock before/after each stock-affecting step. Stop if API/database identity is not confirmed as development/test.

1. **Sales:** create and confirm an order; Plan Outgoing; verify order/customer/warehouse/quantity context; save and reopen the draft; mark Ready; put two compatible outgoing deliveries on one trip. Confirm stock has not changed through assignment. Send the trip with explicit partial quantities and measured weight; compare on-hand/in-transit stock. Record results per delivery, including partial delivery and an exception; check the remaining order balance, final stock, related links, and History. Reopen/retry safely and verify no duplicate departure or completion movement.
2. **Purchase:** create/confirm a PO; Schedule Arrival; verify supplier/PO context and required receiving warehouse. Confirm stock stays unchanged through scheduling; reopen the saved arrival. Receive full, partial, and damaged goods using actual counts; Save Receipt; compare accepted/sellable/quarantined quantities, remaining PO balance, and History. Verify fully received POs cannot create invalid arrivals; repeat/refresh an uncertain confirmation without duplicating stock.
3. **Transfer:** create a draft; add products; change source and cancel/accept the clearing confirmation; verify destination and exact quantities. Compare stock before/after draft save. **Stop at departure until the missing frontend trip integration is implemented.** Then validate compatible assignment, same-source eligibility, trip departure, mixed receipt outcomes, linked history, and exactly-once source/transit/destination stock changes. Include duplicate dispatch/receipt and stale-revision requests.
4. At every step confirm: record identity; products/quantities; origin/destination; what happened; next action. Exercise keyboard-only controls and desktop/landscape-tablet layouts. Confirm staff/manager/admin actions match existing permissions; do not relax them to finish a scenario.

## Top three before consultation

1. Complete the missing **frontend warehouse-transfer trip integration** against the existing backend contract, with matched contract tests and database-backed stock/replay checks.
2. Resolve/reconcile the ten reproducible trip departure assertions with the intended employee interaction, including zero-stock guidance, confirmation, refresh, and safe recovery; retain meaningful coverage rather than weakening assertions. Review the known receipt-history assertion before demonstrating historical damage.
3. Restore the configured local development database/API and use an existing authorized development account on the required Node 22 runtime, then execute and capture the authenticated checklist.

**Genuinely ready to show:** the captured sign-in page and the explicitly labeled automated validations. Sales/purchase workflows have substantial component evidence but no authenticated end-to-end demonstration has been verified; warehouse-transfer departure is blocked.

Production build was not repeated: no application code changed and no real HTTPS API origin was configured. The earlier placeholder-origin build is historical evidence only. Full repository lint/test suites, database-backed integration/concurrency tests, and protected browser workflows were not run; scope, unavailable API/database/authentication, and the checkpoint brief determine these limits. QA-only local processes are stopped after evidence collection.
