# Outgoing delivery details refinement

The View Delivery modal now presents the delivery number and compact status first, followed by customer/address, progress, delivery details and cargo. This replaces the four timeline cards and four detail cards with a compact stepper and a plain two-column grid. Existing typography, colors, Dialog, Badge and Button controls are retained.

## Presentation and data

- `src/components/deliveries/shared/DeliveryDetailModal.tsx` keeps one scrolling body between a fixed header and footer. Close remains available during loading and errors. Long names, addresses and notes wrap. The details grid uses one column on narrow screens and two from 640 px.
- `src/components/deliveries/shared/DeliveryTimeline.tsx` uses four connected steps: Draft Created, Scheduled, In Transit and Delivered. Completed, current and future steps are distinct, with the current step exposed through `aria-current`. Only reached steps display recorded timestamps. It is horizontal from 640 px and vertical below that width. Cancelled shipments show their cancellation and creation dates without implying completion.
- Cargo now uses the canonical DataTable with domain-owned Item and Quantity to Deliver columns. Product name, variety, exact quantity string and unit are retained; allocation references appear as subdued text beneath each product. Notes remain visible without another card.
- Warehouse/address, schedule, driver/contact, vehicle/type/model/capacity, customer/address and sales-order reference remain available. Existing supported include-inactive queries resolve archived references in historical deliveries. Missing records retain their saved IDs; unknown units and capacities are identified rather than invented. Failed linked queries have a separate retry action.
- The modal retains its existing Close action and Escape behavior. No operational action, API mutation, delivery state transition, backend contract or inventory rule was added or changed. Incoming delivery details were outside this refinement.

## Verification

`src/components/deliveries/delivery-details.component.test.tsx` adds 10 tests for all five delivery states, reached timestamps, historical linked records, exact fractional cargo quantities, allocation references, missing assignments, empty cargo, linked-data retry, delivery-record retry, loading and keyboard close. Modal tests use real services and query hooks through a test-only HTTP adapter.

- The new suite and existing order/delivery workflow suite passed together: 37 component tests. The final cancellation-date addition and test typing correction were followed by another passing run of all 10 new tests.
- `npm run build`: TypeScript and production build pass; the existing Vite bundle-size warning remains.
- `npm run lint`, targeted Prettier and `git diff --check`: pass.

The computer-use inventory returned no apps or browser sessions. Desktop/tablet geometry, rendered overflow, focus appearance and footer placement therefore remain unverified in a browser. JSDOM checks do not establish visual correctness. No live authenticated requests or business records were used for QA.

These frontend changes remain uncommitted. Nothing was pushed, and backend files were not modified.
