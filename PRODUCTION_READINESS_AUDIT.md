# ERJVPOS production readiness audit

Date: 4 November 2026, Asia/Manila. Verdict: **NOT READY**. The accessible local audit, corrections and automated verification are complete. Production approval remains blocked by environment, final-version integration and acceptance evidence.

## Scope and evidence

This pass audited the local React/TypeScript frontend and Nest/Prisma backend for concurrent office, warehouse and delivery staff. Frontend baseline: `main`, `6f2f48115a961100bf16eff614980ce39f758a2c`; backend baseline: `main`, `4bd398424acc7a9e3f0b2743472374bbb8d5b1e6`. Both began clean. Local source, rather than older handoff documents or an assumed remote version, was authoritative.

Critical source paths, controller/DTO contracts, domain hooks, shared pagination, forms, authorization, ledger transactions, reporting arithmetic and deployment configuration were inspected. The [endpoint companion](ENDPOINT_INTEGRATION_AUDIT.md) records all 144 declared routes across 23 controllers, their permissions and frontend callers.

Tests use three different boundaries: frontend HTTP adapters are simulated; backend HTTP tests validate routing/DTOs with mocked services; backend database suites execute real PostgreSQL transactions and selected HTTP workflows. None establishes that the deployed frontend and final production backend work together.

No commit, push, deployment, production-data mutation, schema redesign, new direct dependency or backend contract change was made. A new guard-approved `erjv_audit_test` database was created on the repository's local Docker PostgreSQL service at `localhost:5433`, after confirming it did not exist. Existing databases were not reset or migrated. The audit database remains available for follow-up; no database was dropped. Secrets were not printed.

An unrelated untracked `src/components/deliveries/shared/ERJVPOS_UX_FRAMEWORK.md` appeared during the pass. It was left untouched and is not included among these corrections. Graphify's generated changes were retained as required by repository instructions.

## A. System health

| Area | Status | Evidence | Remaining issues |
| --- | --- | --- | --- |
| Frontend | PARTIALLY VERIFIED | Source review, domain/form regressions, unit/component checks, lint/types and compilation | Browser acceptance and deployed connectivity |
| Backend | PARTIALLY VERIFIED | Unit, HTTP and PostgreSQL suites; build and schema checks | Deployed version/configuration and operational acceptance |
| API integration | PARTIALLY VERIFIED | 144-route matrix; request/response/revision/permission review and contract tests | No authenticated browser-to-server walkthrough |
| Authentication | PARTIALLY VERIFIED | JWT/role source review; profile, expiry, revocation, role and protected-route tests | Deployed role matrix, headers and abuse-policy acceptance |
| Orders | PARTIALLY VERIFIED | Decimal/date/draft/revision and order-delivery tests; backend workflow validation | Complete browser sales/purchase lifecycle on final backend |
| Deliveries | PARTIALLY VERIFIED | Receiving, dispatch, reconciliation, run and concurrency suites | Browser operations, physical warehouse reconciliation and final version parity |
| Inventory | PARTIALLY VERIFIED | Stock/quarantine/transfer invariants and DB races; replay defect corrected | Production ledger reconciliation and operational acceptance |
| Financial reports | PARTIALLY VERIFIED | BigInt/rational cost allocation, Manila boundaries, report reader/API/transfer costing tests | Business-owner acceptance against reconciled reference records |
| UI/UX | PARTIALLY VERIFIED | Form interaction corrections and DOM/keyboard/paging tests | Rendered overflow, zoom, responsive and accessibility acceptance unavailable |
| Database integrity | PARTIALLY VERIFIED | Existing migrations applied to a new empty database; real transaction/concurrency suites | Upgrade of a representative existing database, production drift, backup/restore |
| Security | PARTIALLY VERIFIED | Authorization/session checks; runtime dependency audits report zero advisories after fixes | Remaining development-tool advisories and deployment controls |
| Production configuration | FAIL | Frontend build correctly rejects missing HTTPS API origin | Real origin, CORS/edge/TLS verification and final deployment configuration |

## B. Confirmed defects and corrections

### 1. P1: duplicate creation requests from five forms — fixed

Files: [ClientModal.tsx](src/components/crm/ClientModal.tsx), [SupplierModal.tsx](src/components/purchases/SupplierModal.tsx), [EmployeeModal.tsx](src/components/staffing/EmployeeModal.tsx), [JobModal.tsx](src/components/staffing/JobModal.tsx), [RegisterUserModal.tsx](src/components/staffing/RegisterUserModal.tsx).

Two submit events before an asynchronous save settled sent two POST requests. React's next pending render did not synchronously lock the handler. Customer creation also awaited a duplicate-name lookup before mutation state existed. Duplicate employee rows were possible because different people may legitimately share a name; uniqueness checks on other resources do not make duplicate requests correct.

Each affected handler now sets a synchronous ref guard for its entire async operation and releases it in `finally`. Customer pending UI includes the preflight lookup; supplier saving state does not depend on its parent's next render. Validation, permissions, payloads, server errors and input retention remain intact.

Regression: [form-submission.component.test.tsx](src/features/form-submission.component.test.tsx) reproduced two writes in each original form, then verified one write, a failed-save message, preserved input and an explicit successful retry. Scope: one mounted form. This does not provide server idempotency across reloads, devices or uncertain network outcomes.

### 2. P2: receipt replay accepted a different stock pool — fixed

Files: [Prisma stock repository](../erjv-backend/src/stock-items/infrastructure/prisma-stock-items.repository.ts), [ledger regressions](../erjv-backend/src/stock-items/infrastructure/prisma-stock-ledger.repository.spec.ts).

`applyReceipt` compared replay quantities against a saved movement while passing the saved stock ID back into the equality helper. That check could not establish whether the new command still targeted the original product and warehouse. Reusing the receipt-line ID and counts with a changed product/warehouse incorrectly returned prior success.

The replay path now reads the saved movement's stock-pool dimensions and rejects a mismatch with `RECEIPT_REPLAY_MISMATCH`. It adds no writes. Two regression cases failed before the correction and pass afterward; matching replay remains covered. Normal HTTP completion derives these IDs from persisted deliveries, so this pass did not demonstrate an externally exploitable inventory-corruption path.

### 3. P2: employee hire date defaulted to yesterday after Manila midnight — fixed

File: [EmployeeModal.tsx](src/components/staffing/EmployeeModal.tsx). The new-record default took the UTC calendar date. At `2026-11-03T16:30:00Z`, the business date is 4 November in Manila but the form showed 3 November.

The default now explicitly formats `Asia/Manila`; existing saved-date serialization is unchanged. The frozen-time regression failed with `2026-11-03` before the fix and passes with `2026-11-04`.

### 4. P1, exposure-dependent: high-severity dependency advisories — corrected compatible versions

File: [package-lock.json](package-lock.json). Registry audit initially identified four high-severity package entries: `follow-redirects`, Vite, Undici and Zod. Compatible updates changed `follow-redirects` 1.16.0 → 1.16.2, Vite 8.2.1 → 8.3.5, Undici 8.11.2 → 8.12.3, and Zod 4.4.3 → 4.6.7, together with required transitive resolutions. The existing React Router declaration was also reconciled from installed 8.4.0 to declared-compatible 8.5.0. No new direct package was added; lifecycle scripts were disabled during the update.

The subsequent full frontend audit reports **12 moderate, zero high/critical**; its runtime-only audit reports **zero**. Backend audit reports **33 moderate and three low**, all in development-tool chains; runtime-only audit reports **zero**. Counts are affected package entries, not unique CVEs or demonstrated application exploits.

The original credential-forwarding issue affects the Node redirect adapter, and the Vite issue concerns development-server/editor exposure; this is not a claim that the browser app leaked credentials. Supporting advisories: [follow-redirects credential stripping](https://github.com/advisories/GHSA-q3jh-wrc6-jgq8), [Windows launch-editor/Vite issue](https://github.com/advisories/GHSA-587h-7wmj-h5pm). The remaining minimatch advisory is [glob amplification](https://github.com/advisories/GHSA-g3hv-75wg-m249). Its fixed major is outside several current toolchain ranges. Forced downgrades/major overrides were not applied without compatibility work.

### 5. P2: four existing logistics unit suites were excluded from CI's unit command — fixed

File: [package.json](package.json). `test:unit` omitted delivery quantities, stock alerts, purchase pricing and purchase presentation tests. An assertion comparing existing `.test.mjs` files with the command reproduced all four omissions.

The command now includes those suites using its existing explicit-path convention. The assertion passes and the configured command runs **78 tests instead of 56**. No new test framework or glob behavior was introduced.

## C. Endpoint integration

Full method/path, role, caller and source evidence is in [ENDPOINT_INTEGRATION_AUDIT.md](ENDPOINT_INTEGRATION_AUDIT.md): **123 source-linked routes, 15 helper-only routes, three backend capabilities and three infrastructure routes**. Source-linked is not a live end-to-end success claim.

No confirmed required active UI operation was found calling an absent backend method/path. No speculative endpoint or screen was added. Backend capabilities without an active UI connection are `GET /audit-events`, `PATCH /incoming-deliveries/:id/draft` and `PATCH /incoming-deliveries/:id/reschedule`; the existing incoming UI has no edit/reschedule action. These require a product-scope decision before being called required/disconnected. Supplier reference-price endpoints remain intentionally unsupported; direct PO agreed costs are supported.

Current checks preserve backend-owned business timing: scheduling/READY/run assignment do not dispatch or create stock; receipt/dispatch/reconciliation post movements under revisions and transactions. Warehouse-specific sellable availability, quarantine as a subset of on-hand, exact reconciliation totals, damage/missing reasons, driver/vehicle eligibility and run capacity are server-owned. Serializability and bounded conflict retries are present; automated races were exercised on the isolated database.

## D. UI and module coverage

Actual UI corrections: duplicate-submit prevention in five forms, pending feedback spanning customer validation/supplier saves, retained fields and retry after failed writes, and Manila hire-date default. No overflow, clipping, layout or contrast fix is claimed because no rendered defect was reproduced.

| Module/page | Inspection and automated evidence | Browser workflow |
| --- | --- | --- |
| Dashboard | Bounded cursor previews, partial-data labels, report permissions; dashboard tests | NOT VERIFIED |
| Sales Orders | Entry/draft/confirm/cancel/revisions, exact totals, delivery handoff, cursor paging; composer/draft/workflow tests | NOT VERIFIED |
| Purchase Orders | Optional draft supplier, required confirmed supplier, pricing/discounts, replacement lines, dates/revisions; purchase/composer/document tests | NOT VERIFIED |
| Customers | CRUD/archive/reactivation/paging source and tests; duplicate-submit/error retry correction | NOT VERIFIED |
| Suppliers | CRUD/archive/contact clears/permissions source and tests; duplicate-submit correction | NOT VERIFIED |
| Inventory | Catalog/wholesale pricing, bounds, stock buckets, thresholds, adjustments, alerts and quarantine source/tests; existing wholesale guard reused | NOT VERIFIED |
| Warehouses | CRUD/archive eligibility, stock detail/source selection, modal/paging tests | NOT VERIFIED |
| Incoming Deliveries | Schedule/partial/all/no receipt, damaged counts, stale revisions, parent lifecycle, retries; component + PostgreSQL race tests | NOT VERIFIED |
| Outgoing Deliveries | Warehouse/line allocation, loads, READY distinction, dispatch/reconciliation and returns; component/domain/DB tests | NOT VERIFIED |
| Delivery Runs | Assignment without dispatch, eligibility/capacity/member revisions, dispatch/reconcile/cancel; component/HTTP/DB tests | NOT VERIFIED |
| Delivery History | Combined bounded batches, separate cursors, stable visited pages, source-error handling; paging/detail tests | NOT VERIFIED |
| Warehouse Transfers | Source/destination conservation, CAS/replay/rollback/cost provenance; component and DB concurrency/report suites | NOT VERIFIED |
| Vehicles | Lookup/type/capacity validation, operational status/assignment and errors; vehicle component/domain tests | NOT VERIFIED |
| Financial Reports | Query validation, snapshots, grouping/breakdowns, periods, warnings, authoritative totals; report API/reader/costing/Manila tests | NOT VERIFIED |
| Staff Directory | CRUD/profile/account linkage/drive eligibility/permissions; duplicate-submit and date regressions | NOT VERIFIED |
| Employee Job Assignments | Replacement semantics and retained assignedAt; component/HTTP/DB assignment-history tests | NOT VERIFIED |
| Job Positions | Reserved names, CRUD/archive/errors and permissions; duplicate-submit regression | NOT VERIFIED |
| User Roles and Access | Privileged-target/last-admin protections, account lifecycle, linking/partial success, registration guard; component/HTTP/DB security tests | NOT VERIFIED |
| Authentication/navigation | Login/profile validation, expiry/revocation, stale role handling, protected routes, redirects, session cache cleanup | NOT VERIFIED |
| Shared UI | DataTable, cursor controls/lookups, search menu keyboard/focus, confirmations, route and error handling tests | NOT VERIFIED |

No browser or native-app surfaces were available through the computer-use tool; opening the in-app browser returned `Browser is not available: iab`. Therefore 1920/1440/1366/1024/768/390px render checks, zoom, long-content layout, real focus/contrast/target-size measurements and every-control visual acceptance were **not executed**. DOM tests do not establish rendered layout correctness. The optional UX toolkit's gates were inventoried; no render gate is reported passed.

## E. Tests and build evidence

The machine initially used Node 26.7.0. An official portable **Node 22.23.4** archive was downloaded into a temporary folder and verified against its published SHA-256 (`cbc74b5e0982c9dbb41525fd8fb5dcd32fbee237863f7829072f4639a1ce5f20`). Only audit subprocesses used it; system Node and project settings were not replaced. Commands below use that runtime by putting its directory first in the subprocess PATH, unless specified otherwise.

| Command/check | Result | Boundary/log |
| --- | --- | --- |
| Initial frontend `npm test` on Node 26 | FAILED: 21/1,215 component tests; unit command passed | Busy parallel baseline; `.readiness-frontend-tests.log` |
| Limited-worker pre-update frontend sweep | 1,215 preexisting component tests passed; six new tests saw earlier transformed code while edits were in progress | Not final acceptance; `.readiness-frontend-components-isolated.log` |
| Post-update Node 26 component sweep | 1,220 passed, one 5-second vehicle test timeout | Not hidden or counted as a full pass; `.readiness-frontend-final-components.log` |
| New form regressions, isolated | PASSED: six tests | Five duplicate-submit/failure/retry cases plus Manila date |
| Node 22 `npm run test:unit` | PASSED: 78 tests | `.readiness-node22-frontend-unit.log` |
| Node 22 `npm run test:components -- --maxWorkers=2` | PASSED: 91 suites, 1,221 tests | `.readiness-node22-frontend-components.log`; exit 0, 379.55 seconds |
| Node 22 frontend `npm run lint` | PASSED | `.readiness-node22-frontend-lint.log` |
| Node 22 `tsc -b --pretty false` | PASSED | `.readiness-node22-frontend-types.log` |
| Frontend `npm run build` without origin | BLOCKED as designed: missing `VITE_API_BASE_URL` | `.readiness-frontend-build.log` |
| Node 22 frontend compilation with command-scoped `VITE_API_BASE_URL=https://example.invalid`, `npm run build -- --outDir dist/readiness-audit` | PASSED, compilation only | Environment restored; audit-only example-origin output removed afterward; `.readiness-node22-frontend-build.log` |
| Node 22 backend `npm test -- --runInBand` | PASSED: 86 suites, 582 tests | `.readiness-node22-backend-unit.log` |
| Node 22 backend `npm run test:e2e -- --runInBand` | PASSED: eight suites, 93 tests | Mock-service HTTP boundary; `.readiness-node22-backend-http.log` |
| Node 22 backend DB runner with guarded `TEST_DATABASE_URL` | PASSED: 23 suites, 242 tests; one opt-in seed test skipped | `.readiness-node22-backend-db.log`; PostgreSQL transactions and selected HTTP workflows |
| Node 22 backend `npm run test:db-rebuild-guard` | PASSED: 25 tests | No database rebuild executed; `.readiness-node22-backend-db-guards.log` |
| Node 22 backend `npm run lint` | PASSED | ESLint plus TypeScript; `.readiness-node22-backend-lint.log` |
| Node 22 backend `npm run build` | PASSED | Prisma generate + Nest compile; `.readiness-node22-backend-build.log` |
| Node 22 `prisma validate` | PASSED | `.readiness-node22-prisma.log` |
| Existing migrations into fresh audit DB | PASSED: 11 migrations | No schema changes made; `.readiness-backend-db.log` |
| `npm audit --json` / `--omit=dev` | Frontend: 12 moderate / runtime zero; backend: 36 low/moderate / runtime zero | Full audits exit 1 for remaining advisories; audit JSON logs retained |
| `git diff --check`, both repositories | PASSED at final checkpoint | No commit/push; both report files' local links also verified |
| `graphify update .`, both repositories | PASSED, including final frontend refresh after unit-command change | AST-only; existing extraction limitations below |

The DB suite's skipped test is the opt-in demo-opening-stock seed report test, which requires its separate dedicated seed target. Expected injected `audit unavailable`/unknown-Prisma errors are logged by failure-path tests; passing suite assertions, rather than an absence of logs, determine their result. No test was disabled and timeouts were not increased. The final frontend pass ran with two workers, after other expensive checks finished; unconstrained concurrent-run timing is not certified by that result. A fresh-context final review found no critical or important introduced defect in the changed source, callers, regressions or lockfile; the reviewer did not claim independent browser or deployment verification.

Compilation warns about the existing approximately 1.18 MB minified / 331 kB gzipped single JS chunk. This was recorded rather than solved with an unrelated routing redesign. Graphify reports a partial extraction for one existing TSX test and no SQL extraction because its SQL parser is not installed; graph output is a navigation aid, not validation of SQL constraints.

## F. Pending backend integration and release blockers

All six named behaviors are present in the accessible local backend. They must not be reported as absent merely because an older handoff called them pending:

| Anticipated change | Current local evidence | Release integration state |
| --- | --- | --- |
| SO/PO `orderedAt` | Current DTO/service business-date validation; date transport/service/report tests | Locally present/tested; final shared/deployed version parity pending |
| Warehouse ID validation | Current order/delivery DTO reference checks and validation tests | Locally present/tested; final endpoint acceptance pending |
| Incoming receipt idempotency | Completed-payload comparison, CAS/transaction controls, replay regression and DB concurrency suites | Locally present/tested, with pool provenance fix in this pass |
| Outgoing `fulfillmentOutcome` | Current mapper/response projection derives NONE/PARTIAL/FULL from reconciliation | Locally present/tested; final response/UI acceptance pending |
| Employee assignment timestamps | Retained assignment rows preserve assignedAt; assignment-history DB suite | Locally present/tested; final version parity pending |
| SUPERADMIN inheritance | ADMIN inheritance in RolesGuard, current DB role on JWT validation, role tests | Locally present/tested; deployed role matrix pending |

The separate document titled "Frontend-facing endpoint changes" and an authoritative final unpushed diff were not supplied in this session. No remote fetch/pull or synchronization was assumed. **PENDING BACKEND INTEGRATION remains BLOCKED for release approval** until the developer's final intended version is available, compared with these audited commits and retested. A clean local tree at the start does not prove the developer has no additional changes elsewhere.

Other release work:

1. Supply the actual HTTPS backend origin, build the real frontend, and verify deployed CORS, deep links, TLS, headers and health/readiness configuration. `https://example.invalid` is only a compilation probe and must never be deployed.
2. Run authenticated desktop/tablet/mobile browser acceptance on the final frontend/backend, with approved roles and safe data. Include duplicate clicks, stale revisions, failures, long values, keyboard controls, zoom and session expiry.
3. Complete business acceptance: partial/damaged/no receipts; load/dispatch/reconcile/return/missing stock; eligibility/capacity; transfers; cancellation and concurrent retries. Automated database races reduce risk but do not replace operator acceptance.
4. Reconcile financial examples with accepted purchases and reconciled sales, moving weighted-average acquisition cost, missing-cost warnings and Manila period cutoffs. Estimated gross profit is not net profit or sales minus purchases.
5. Verify representative existing-data migrations, deployed schema status, database constraints/drift, backup restore and operational recovery. Fresh migration success does not verify a production upgrade; the dedicated migration-upgrade and opt-in seed suites were not run against their separate databases.
6. Resolve or explicitly accept the remaining development-tool advisory exposure through tested compatible toolchain upgrades. Review edge security headers and login throttle/lockout policy; source observations alone did not prove a deployed exploit and were not changed speculatively.
7. Review the recorded bundle warning and retain an honest performance baseline on target devices. No measured production load or capacity limit is certified by this pass.

## G. Release gates and direct answers

| Gate | Status | Reason |
| --- | --- | --- |
| Functional | PARTIALLY VERIFIED | Automated components/domain/API/DB paths; browser acceptance missing |
| Integration | PARTIALLY VERIFIED | Current contracts traced; final deployed pair not exercised |
| Data integrity | PARTIALLY VERIFIED | Isolated transaction/race/report tests; production data/upgrade/recovery absent |
| Security | PARTIALLY VERIFIED | Session/permission/runtime dependency evidence; deployment and dev-tool review outstanding |
| UI quality | NOT VERIFIED for rendered acceptance | Browser unavailable; no overflow/accessibility-render claim |
| Reliability | PARTIALLY VERIFIED | Guards/replay/conflict/failure tests; final operator/network acceptance pending |
| Build/test | PARTIALLY VERIFIED | All executed supported-runtime automated checks pass; real-origin production build remains blocked |
| Deployment | BLOCKED | Real API origin and deployed operational evidence missing |
| Pending backend integration | BLOCKED | Final developer/shared/deployed version not established |

1. **Bugs found:** five-form duplicate requests, receipt replay provenance mismatch, Manila hire-date default, four high advisory package entries, and four omitted unit suites. Remaining toolchain advisories and environment limitations are separate from these corrected defects.
2. **Bugs fixed:** all five correction groups in section B, with reproduced failures, focused regressions or before/after configuration/security checks. Their stated verification limits still apply.
3. **Required disconnected endpoints:** none confirmed. Three backend capabilities lack UI by current scope; they are not automatically defects.
4. **Verified integrations:** current source contracts and automated adapter/HTTP/DB boundaries in the matrix and test table; no deployed browser integration is certified.
5. **Modules tested through real workflows:** backend PostgreSQL tests exercise selected auth/security, orders, receipts, stock/quarantine, transfer/concurrency and report API workflows. No module received a real browser walkthrough.
6. **Financial/inventory sufficiency:** sufficient for the recorded automated regression checks, insufficient for production acceptance without reconciled records, final deployment and operational sign-off.
7. **UI overflow/interactions:** confirmed form interaction defects were corrected; rendered overflow/responsiveness remains unverified.
8. **Remaining critical failures:** no additional P0 application defect was confirmed in executed checks; deployment and pending-version gates still block release. Earlier Node 26 timeouts are recorded; the final supported-runtime frontend suite passed completely with two workers.
9. **What the pending push blocks:** final contract/version parity and a release-level integration verdict, not independent local maintenance.
10. **Exact remaining deployment work:** the seven items in section F, followed by final integrated acceptance on the actual release versions. The local automated final checkpoint is green within its documented boundaries.

**Final verdict: NOT READY for release.** Local tests and source evidence do not establish full production readiness.
