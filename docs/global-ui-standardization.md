# Management page UI standardization

This frontend-only pass uses Inventory as the structural reference: a plain page canvas, consistent heading, compact record filters, wrapping search/action toolbar and one canonical DataTable surface. Domain filters, statuses, permissions and operations remain separate. Backend files, contracts, schemas and inventory rules were not modified.

## Shared patterns

- New `src/components/ui/ManagementPage.tsx` provides `ManagementPage`, `PageHeader` and `PageToolbar`. The page shell supplies existing dashboard summary values through context so feature pages need no new forwarding props. Summaries sit beneath the heading as quiet label/value pairs.
- `ArchiveTabNav.tsx` now reuses `StatusTabNav.tsx`. Both use the same compact segmented controls, count treatment, selected indicator and focus states. Archived records retain their context and Back to Active action without the former amber banner, icon tile, repeated border and shadow.
- `data-table.tsx` adds opt-in `appearance="management"`. Shared styles in `src/index.css` set 13px medium headers at 44px, 13px primary and secondary text, matching the Outgoing Deliveries button reference, at least 56px rows, consistent separators and visible sorting/action focus. Composer and detail tables retain their domain sizing. Two-line identities naturally produce taller rows.
- Toolbars use 36px controls with 13px text and consistently sized search icons. Search/filter controls stay left; the last action stays right when space allows. Narrow layouts wrap. Coarse-pointer controls and table actions have 44px minimum targets.
- Shared Dialog, Input, Label, Select and SearchableDropdown defaults now align heading/body spacing, form text and touch sizing. Dialog defaults have viewport margins and a bounded scroll area. Feature-specific sizing and complex form grouping remain supported.
- Brand green remains #80B918. Default green buttons use white text and icons, matching the user's follow-up preference; the existing darker green variant also retains white text. The light-theme secondary text token is darker so it remains readable on neutral surfaces.

## Pages and files

| Area                  | Files (under src/components)                                                                                                                                                                      | Result                                                                                                                                                                                                        |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Dashboard             | `dashboard/MainDashboard.tsx`                                                                                                                                                                     | Removes the outer padded management card for every domain and replaces nine large summary cards with inline summaries; existing calculations and navigation callbacks are retained.                           |
| Inventory             | `inventory/InventoryHub.tsx`, `InventoryItemCatalog.tsx`                                                                                                                                          | Shared heading, toolbar and management table; stock/location controls and inline wholesale editing retained.                                                                                                  |
| Customers             | `crm/ClientList.tsx`                                                                                                                                                                              | Shared heading, archive controls, toolbar and management table.                                                                                                                                               |
| Sales orders          | `orders/OrdersView.tsx`                                                                                                                                                                           | Shared heading, filters, toolbar and management table; canonical pagination added, supported primary/overflow actions retained.                                                                               |
| Purchases / suppliers | `purchases/PurchasesView.tsx`                                                                                                                                                                     | Purchase Orders heading added; both sections use shared patterns. Purchase pagination uses DataTable. No navigation instruction banner is added back. Confirmation, cancellation and incoming handoff remain. |
| Warehouses            | `operations/WarehouseList.tsx`                                                                                                                                                                    | Shared heading, toolbar, archive controls and table; exact stock checks before archiving retained.                                                                                                            |
| Vehicles              | `operations/VehicleList.tsx`                                                                                                                                                                      | Add Vehicle moved beside search/filter controls; large metric tiles flattened to inline counts; operational vehicle states and actions retained.                                                              |
| Deliveries            | `deliveries/DeliveriesHub.tsx`, `DeliveryTable.tsx`                                                                                                                                               | Shared headings and toolbar, schedule action moved alongside search/date controls, consistent management table for incoming/outgoing/history. Direction-specific filters and transitions retained.            |
| Staffing              | `staffing/EmployeeList.tsx`, `JobList.tsx`, `UserRolesList.tsx`                                                                                                                                   | Shared headings, toolbar and table; User Roles & Access heading added, redundant table wrapper removed, meaningful account/role information retained.                                                         |
| Shared UI             | `ui/ManagementPage.tsx`, `ArchiveTabNav.tsx`, `StatusTabNav.tsx`, `data-table.tsx`, `dialog.tsx`, `input.tsx`, `label.tsx`, `select.tsx`, `SearchableDropdown.tsx`, `button.tsx`; `src/index.css` | Shared structure, sizing, focus and contrast.                                                                                                                                                                 |

Existing DataTableActions, Button, Input, Select, SearchableDropdown, Dialog, order composers, confirmation modals and notification services are reused. No dependency or competing table was added. This pass builds on the earlier delivery form/detail and management cleanup reports without replacing those workflows.

## Piece units

The user's follow-up requests `piece(s)` everywhere a product is measured in pieces. New `src/lib/product-unit.ts` normalizes display labels for piece, pieces, pc and pcs (including common dotted forms). Other units and unknown-unit fallbacks retain their meaning. Stored values, request payloads, quantities and calculations are unchanged. Mixed-product aggregate totals remain generic units rather than being incorrectly labeled pieces.

Display updates cover:

- Inventory quantities, location quantities, wholesale price captions and stock notifications: `inventory/InventoryItemCatalog.tsx`, `InventoryWholesalePrice.tsx`, `operations/WarehouseInventory.tsx`, `layout/StockNotifications.tsx`.
- Product identity, catalog availability and source descriptions: `order-entry/OrderEntryFields.tsx`, `OrderProductCatalog.tsx`, `orders/SalesOrderSources.tsx`. Both composers and shipment quantity tables reuse ProductIdentity.
- Order/delivery detail quantities: `orders/OrderDetailDrawer.tsx`, `purchases/PurchaseOrderDetailModal.tsx`, `deliveries/shared/DeliveryDetailModal.tsx`, `IncomingDeliveryDetailModal.tsx`.
- Product/stock price captions and stock adjustment feedback: `products/ProductListModal.tsx`, `operations/InventoryItemModal.tsx`, `InventoryStockList.tsx`, `StockAdjustModal.tsx`.
- The existing inline-price HTTP-adapter test in `inventory/inventory-notifications.component.test.tsx` now uses a piece product and still checks the exact price-only request without any per-unit label.

## Verification

- Unit tests: 47 pass.
- Full components: 90 pass across seven suites with `npx vitest run --maxWorkers=1 --testTimeout=15000 --reporter=dot`. Assertions and repository timeout settings were not changed. The existing split-source composer interaction exceeds the default five-second timeout in this environment, including when run alone; the default-timeout run was 89 pass / one timeout.
- Final follow-up checks cover all 40 inventory and delivery workflow cases across runs: 39 passed with the default timeout; one purchase composer draft interaction timed out. The focused rerun of both matching sales/purchase draft cases passed with the 15-second allowance.
- TypeScript / production build, ESLint, targeted Prettier and git diff whitespace checks pass. The final bundle is approximately 886 kB before gzip.
- Existing tests exercise searching, record filters, sorting, pagination, permissions, inventory editing/archiving/restoration, sales and purchase creation/confirmation/retry, cancellation and delivery handoffs, shipment quantities and delivery state actions.

Computer-use inventory returned no apps or browser sessions. No rendered visual inspection was possible at 1920, 1440, 1280, 1024 or 768px. JSDOM tests cannot verify clipping, alignment, actual contrast, popover placement or touch geometry. Responsive wrapping, scroll containment and target sizes are implemented, but rendered desktop/tablet QA remains outstanding. Live authenticated business operations were not performed. The existing production bundle-size warning remains.

Changes remain uncommitted; nothing was pushed. Earlier unrelated workspace changes are retained.

## Follow-up typography preference

The user requested one regular text size matching Outgoing Deliveries. The shared `--text-ui` token is 13px. Management pages, DataTables (including dates, totals, badges and pagination), buttons, dialog body text and portal menus use this size. Page and dialog headings keep their larger sizes. Secondary information uses quieter color and weight rather than smaller lettering. Green button text and icons remain white.
