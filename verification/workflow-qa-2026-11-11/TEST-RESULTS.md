# Test evidence — 11 November 2026

All component HTTP responses are mocked. Backend service tests use stubs. These results do not constitute authenticated end-to-end or persisted-inventory verification.

## Commands and outcomes

- Initial: `npm run test:components -- src/components/deliveries src/components/warehouse-transfers src/features/warehouse-transfers src/features/logistics/incoming-revision.component.test.tsx src/features/logistics/purchase-revision.component.test.tsx src/features/logistics/purchase-entry.component.test.tsx src/features/backend-change-integration.component.test.tsx src/features/integration-contracts.component.test.tsx --reporter=json --outputFile=verification/workflow-qa-2026-11-11/components.json` — exit 1, 517 passed / 30 failed.
- Serial recheck: `npm run test:components -- src/components/deliveries/delivery-runs.component.test.tsx src/components/deliveries/deliveries-hub-paging.component.test.tsx src/components/deliveries/outgoing-scheduling.component.test.tsx src/components/warehouse-transfers/transfer-product-catalog.component.test.tsx src/components/warehouse-transfers/warehouse-transfers.component.test.tsx --maxWorkers=1 --reporter=json --outputFile=verification/workflow-qa-2026-11-11/recheck.json` — exit 0, 179 passed / 0 failed.
- Critical recheck: `npm run test:components -- src/components/deliveries/order-delivery-workflow.component.test.tsx src/components/deliveries/outgoing-dispatch.component.test.tsx src/features/logistics/run-load-validation.component.test.tsx --maxWorkers=1 --reporter=json --outputFile=verification/workflow-qa-2026-11-11/critical-recheck.json` — exit 1, 108 passed / 10 failed.
- `npm run test:unit` — exit 0, 81 passed / 0 failed.
- `npx tsc -b` — exit 0.
- In backend cwd: `node node_modules/jest/bin/jest.js --runInBand --no-cache --runTestsByPath src/warehouse-transfers/warehouse-transfers.service.spec.ts src/delivery-runs/delivery-runs.service.spec.ts --json --outputFile=C:/Users/magno/Documents/Coding/erjv-frontend/verification/workflow-qa-2026-11-11/backend-services.json` — exit 0, 9 passed / 0 failed.

No tests, fixtures, assertion expectations, or configured timeouts were changed. Rechecks used one worker to reduce contention. Thirteen initial failures did not reproduce in serial rechecks. Do not treat the first run as 30 confirmed application defects.

## Latest result per component file

**539 passed / 17 failed / 556 unique cases** across 24 files. This combines the latest per-file run; it is not a single complete rerun.

| File | Passed | Failed | Evidence |
| --- | ---: | ---: | --- |
| src/features/backend-change-integration.component.test.tsx | 15 | 7 | [components.json](components.json) |
| src/features/integration-contracts.component.test.tsx | 19 | 0 | [components.json](components.json) |
| src/components/deliveries/deliveries-hub-paging.component.test.tsx | 21 | 0 | [recheck.json](recheck.json) |
| src/components/deliveries/delivery-confirmation-forms.component.test.tsx | 35 | 0 | [components.json](components.json) |
| src/components/deliveries/delivery-details.component.test.tsx | 18 | 0 | [components.json](components.json) |
| src/components/deliveries/delivery-runs.component.test.tsx | 60 | 0 | [recheck.json](recheck.json) |
| src/components/deliveries/delivery-table-toolbar.component.test.tsx | 5 | 0 | [components.json](components.json) |
| src/components/deliveries/history-trips.component.test.tsx | 23 | 0 | [components.json](components.json) |
| src/components/deliveries/incoming-receiving.component.test.tsx | 40 | 0 | [components.json](components.json) |
| src/components/deliveries/incoming-scheduling.component.test.tsx | 19 | 0 | [components.json](components.json) |
| src/components/deliveries/incoming-selectors.component.test.tsx | 16 | 0 | [components.json](components.json) |
| src/components/deliveries/order-delivery-workflow.component.test.tsx | 58 | 0 | [critical-recheck.json](critical-recheck.json) |
| src/components/deliveries/outgoing-completion.component.test.tsx | 41 | 0 | [components.json](components.json) |
| src/components/deliveries/outgoing-dispatch.component.test.tsx | 41 | 10 | [critical-recheck.json](critical-recheck.json) |
| src/components/deliveries/outgoing-scheduling.component.test.tsx | 41 | 0 | [recheck.json](recheck.json) |
| src/components/warehouse-transfers/transfer-product-catalog.component.test.tsx | 21 | 0 | [recheck.json](recheck.json) |
| src/components/warehouse-transfers/warehouse-transfers.component.test.tsx | 36 | 0 | [recheck.json](recheck.json) |
| src/features/logistics/incoming-revision.component.test.tsx | 5 | 0 | [components.json](components.json) |
| src/features/logistics/purchase-entry.component.test.tsx | 1 | 0 | [components.json](components.json) |
| src/features/logistics/purchase-revision.component.test.tsx | 3 | 0 | [components.json](components.json) |
| src/features/warehouse-transfers/warehouse-transfers.component.test.tsx | 5 | 0 | [components.json](components.json) |
| src/components/deliveries/shared/delivery-dates.component.test.tsx | 4 | 0 | [components.json](components.json) |
| src/components/deliveries/shared/status-badges.component.test.tsx | 3 | 0 | [components.json](components.json) |
| src/features/logistics/run-load-validation.component.test.tsx | 9 | 0 | [critical-recheck.json](critical-recheck.json) |

## Unresolved assertions

### src/features/backend-change-integration.component.test.tsx

- **rejects invalid replacement job IDs [] without any HTTP or deletion**: Error: promise resolved "undefined" instead of rejecting
- **rejects invalid replacement job IDs [ 2, 2 ] without any HTTP or deletion**: Error: promise resolved "undefined" instead of rejecting
- **rejects invalid replacement job IDs [ 0 ] without any HTTP or deletion**: Error: promise resolved "undefined" instead of rejecting
- **rejects invalid replacement job IDs [ -1 ] without any HTTP or deletion**: Error: promise resolved "undefined" instead of rejecting
- **rejects invalid replacement job IDs [ 1.5 ] without any HTTP or deletion**: Error: promise resolved "undefined" instead of rejecting
- **rejects invalid replacement job IDs [ NaN ] without any HTTP or deletion**: Error: promise resolved "undefined" instead of rejecting
- **shows the stored accepted quantity after quarantine clearance in receipt details**: TestingLibraryElementError: Unable to find an accessible element with the role "columnheader" and name "Damaged at receipt"

### src/components/deliveries/outgoing-dispatch.component.test.tsx

- **explains zero stock and permits a partial load of another stocked product in the same delivery**: TestingLibraryElementError: Unable to find an element with the text: Banana: No stock available at this warehouse.. This could be because the text is broken up by multiple elements. In this case, you can provide a function for your text matcher to make your matcher more flexible.
- **requires review before Send Trip and invalidates that review when an entered quantity changes**: TestingLibraryElementError: Unable to find an accessible element with the role "button" and name "Review Departure"
- **retains entries after 400 and requires explicit review before retry**: TestingLibraryElementError: Unable to find an accessible element with the role "button" and name "Refresh trip data"
- **retains entries after 403 and requires explicit review before retry**: TestingLibraryElementError: Unable to find an accessible element with the role "button" and name "Refresh trip data"
- **retains entries after 404 and requires explicit review before retry**: TestingLibraryElementError: Unable to find an accessible element with the role "button" and name "Refresh trip data"
- **retains entries after 409 and requires explicit review before retry**: TestingLibraryElementError: Unable to find an accessible element with the role "button" and name "Refresh trip data"
- **retains entries after network and requires explicit review before retry**: TestingLibraryElementError: Unable to find an accessible element with the role "button" and name "Refresh trip data"
- **never retries an uncertain departure when refresh shows the run already dispatched**: TestingLibraryElementError: Unable to find an accessible element with the role "button" and name "Refresh trip data"
- **recovers a run load failure by explicit refresh**: TestingLibraryElementError: Unable to find an accessible element with the role "button" and name "Refresh trip data"
- **preserves explicit quantities after current stock falls instead of clamping**: TestingLibraryElementError: Unable to find an accessible element with the role "button" and name "Refresh trip data"

## Interpretation

- Seven known failures remain unchanged: six staffing replacement-job-ID validation expectations, and one historical receipt column-name expectation. No unrelated staffing fixes were attempted.
- Ten departure failures reproduce with one worker. Eight stop on the old `Refresh trip data` accessible name while the implementation says `Refresh trip and review current data`. One expects a separate `Review Departure` action that the current confirmation modal does not expose. One expects a zero-stock explanatory message that is not rendered. These are specific implementation/assertion differences; recovery, review requirements, and zero-stock usability need confirmation against the approved interaction.
- Trip management, multi-member selection, catalog source-change confirmation, transfer draft creation, paging, outgoing scheduling, and all order workflow assertions pass in isolation.
- Passing mocked transfer direct-dispatch assertions do not reflect the backend requirement to depart through a delivery run. See REPORT.md for the independently confirmed frontend/backend contract mismatch.
