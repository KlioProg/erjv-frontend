# Final frontend QA

## Executive decision

**CONDITIONAL for a controlled academic presentation; NOT READY for production.** Core source integrations and regression suites are healthy after targeted repairs. A successful production build, supported Node runtime, rendered browser QA and business-write end-to-end verification remain outstanding. This is not a claim that the app is bug-free.

Audited 2026-10-27, one focused agent session. Frontend main **5a7f3ae29878e8c9e489895d383deae9c9f852e2** plus substantial existing unstaged/untracked work; no staged work was replaced. Backend main **ec2804ad395dd85c961ffddeb4733b74857f2340**, clean before/after inspection. No backend edits, migrations, seed/reset, business-data writes, commits or pushes. Existing local changes are newer working-tree implementations; HEAD alone is not the served UI. No claim about an unrefreshed remote branch was made.

## Scope and method

Reviewed reachable sales/customers, purchases/suppliers, incoming/outgoing/history, inventory/product/archive/quarantine/report condition/threshold, warehouses, vehicles, staff/jobs/access, auth/profile, shared DataTable/dropdowns/dialogs/navigation/notifications and their direct API dependencies. Source import graph starts at src/main.tsx; it contains 172 local source dependencies, 98 files with UI/surface tags and 113 explicit field occurrences. This inventory includes shared/type-only dependencies and does not prove every conditional control was rendered. Concrete inventories are appended below.

Reused the existing React/Tailwind/shadcn architecture and white-first design. No new dependency, replacement table, new API, backend change or broad redesign. Historical integration reports and current DTOs/controllers were compared with running OpenAPI. Impeccable's static component detector returned no findings; this is not a contrast/accessibility or browser pass.

## Environment and actual running integration

Vite on localhost:5173 serves /api requests through the configured localhost:3000 backend proxy. Both IPv4/IPv6 development listeners were observed; authenticated requests through port 5173 reached the expected local data. /api-json documents 122 operations. Quarantine-lots returned HTTP 200 with one open lot, confirming that the running instance now exposes the static route. No stale backend rebuild is indicated by that request. No browser assets, mounted DOM or visual output were inspected: Zen is unsupported by the available browser connection. Prior user instructions prohibit extracting its session and repeated connection attempts.

Existing safe development credentials were used only against the verified local disposable database target localhost:5433/erjv; no secrets are printed or stored in reports. Actual evidence: login 200 and 15 authenticated GETs, all 200. Full request list is in [API coverage](FRONTEND-API-COVERAGE.md). No mutation success is inferred from these reads.

The installed runtime is **Node 26.7.0 / npm 12.2.0**. Frontend requires Node 22.x; backend declares >=22.23.4 <23. Use the supported runtime before deployment and repeat checks. No production HTTPS API origin was supplied; no fake origin was injected.

## Confirmed defects and repairs

No destructive persisted-data event was observed in this audit. The silent default unit was a potential data-integrity problem and has been removed for future creation; previously created products require unit review. Findings below describe pre-fix behavior, expected behavior, root cause, fix and verification.

| Severity | Workflow / reproduction and expected vs actual | Files (under src/) | Root cause / fix | Evidence |
|---|---|---|---|---|
| P1 | New product registration: Enter a new product name, price and unit, then register. Before: coded missing-name 404 aborted creation; no unit control and silent kg fallback could mislabel non-kg products. Expected: expected lookup miss permits creation with explicit unit. | InventoryItemModal.tsx; products.api.ts | Only coded RESOURCE_NOT_FOUND 404 is treated as an expected miss. Unit is explicitly required, trimmed and preserved. 403/500/unstructured 404 remain blocking. Existing product units cannot be silently edited. | master-data-qa; inventory-notifications |
| P1 | New warehouse registration: Register a never-used warehouse name. Before: expected lookup 404 stopped registration. Expected: continue only for a genuine missing resource. | WarehouseModal.tsx | Coded expected miss handled without swallowing authorization/server errors; archived match still offers restoration. | master-data-qa |
| P1 | Duplicate master-data submission: Submit registration twice while lookup is pending. Before: create mutation had not yet become pending, allowing duplicate lookup/write attempts. | InventoryItemModal.tsx; WarehouseModal.tsx; VehicleModal.tsx | A synchronous submit lock and visible checking state span lookup through mutation and release in finally. | master-data-qa duplicate preflight test |
| P1 | Vehicle decimal validation: Enter -1, 1.234, nonnumeric text or 10000000000 capacity. Before: parseFloat/toFixed could round unsupported precision; invalid raw text was not reliably retained. | VehicleModal.tsx; delivery-vehicles.api.ts | Exact decimal parsing, nonnegative Decimal(12,2) bound, inline error, disabled submission and service boundary validation; null and genuine zero preserved. | vehicle-modal; api-contracts |
| P1 | Stock Alert Settings unreachable: Open warehouse inventory as Manager/Admin and try to configure a threshold. Before: the existing threshold modal had no mounted entry point. | WarehouseInventory.tsx; ReorderThresholdModal.tsx; stock-items.api.ts | Restored a labelled settings action beside product name without restoring stacked threshold text; exact decimal/null API validation; existing invalidation retained. | master-data-qa opens/saves/reopens settings; service rejects invalid precision/negative/overflow |
| P1 | Fixed-peso SO draft editing: Edit a draft containing a fixed-peso line discount. Before: frontend refused a backend-supported discount and disabled its option. | OrderModal.tsx; sales-order-entry.utils.ts; sales-orders.api.ts | Removed obsolete frontend-only restriction after verifying current DTO/service and tests; discount exclusivity and arithmetic remain. Revision 0 rejected. | sales-order-draft; order-discounts; 18 backend service/DTO tests |
| P1 | Restore failures: Attempt to reactivate an archived product while server returns an error. Before: async click handler could reject without useful inline recovery. | InventoryItemModal.tsx; WarehouseModal.tsx; VehicleModal.tsx; EmployeeModal.tsx; JobModal.tsx | Catch restoration failures, display the server error, retain dialog and retry path. | master-data-qa product restore rejection; other handlers inspected |
| P2 | Misleading warehouse totals: Open warehouse list containing kg and pieces. Before: mixed physical quantities were labelled units. | WarehouseList.tsx | Removed redundant mixed-unit Total Stock column; product count remains. Mobile/confirmation wording uses stock records, not a fabricated quantity. Archive safety gate remains. | active-app TypeScript; source inspection; rendered layout not verified |
| P1 build | Dropdown disabled/loading integration: Legacy callers supply disabled/isLoading; before: unsupported props failed TypeScript and disabling an open dropdown was undefined. | SearchableDropdown.tsx | Optional disabled/loading control prevents opening and suppresses an already-open menu while blocked; normal behavior unchanged. | searchable-dropdown |
| P1 build | Test mock typing: Run global TypeScript. Before: four invalid Vitest generic mock signatures. | order-discounts.component.test.tsx | Correct function signatures and typed payload assertions, without changing business test expectations. | active graph and focused tests |

## Regression and contract review

- Incoming scheduling remains header-only; read-only PO outstanding summary and later actual receipt quantities stay separate. Partial receiving/progress and completion arrays are covered by existing component/contract tests.
- Outgoing planning prevents zero/overallocated quantities, retains exact SO item/stock item identity, vehicle/driver/loaded quantities, and refreshes order/delivery caches. Product labels do not expose stock IDs in active dispatch UI. Invalid quantity and discount precision, non-finite values, date/state guards and server error recovery remain enforced.
- SO/PO line discounts/tax use existing exact arithmetic and backend contracts; draft revisions and confirm/cancel safeguards retained. Printing/document tests passed.
- Inventory physical/available/quarantined fields remain distinct and backend-authoritative. Quarantine release/removal/correction tests cover partial quantities, inline errors, confirmation, permission restrictions and invalidation; no quarantine lot was mutated live.
- Staff/job/user role routes and Manager/Admin restrictions are exercised in existing routing/component tests. Server authorization and concurrency are not certified by those tests. Auth client errors remain centrally handled; ErrorBoundary is retained.
- No active unsupported endpoint was found in the inspected source graph. Two legacy supplier-price URLs and an obsolete outgoing creation helper remain inactive and must not be remounted. Details are in the API matrix.

## Verification results

| Check | Baseline | Final / limitation |
|---|---|---|
| Unit tests, npm run test:unit | 48 passed | 48 passed |
| Full component/integration tests, npm run test:components -- --maxWorkers=2 | 518 passed / 39 files | 537 passed / 40 files, 150.44s |
| Focused regression runs | Relevant existing suites inspected | 115 tests passed during fixes; final targeted rerun: 49 passed / 2 files |
| ESLint, npm run lint | Passed | Passed; final lint + targeted command exited 0 |
| Full build, npm run build | Failed, 44 TS diagnostics | Failed, 38 TS diagnostics; Vite bundling not reached |
| Mounted app plus changed tests TypeScript program | Not substituted for full build | 0 diagnostics under tsconfig.app compiler options |
| Backend SO DTO/service tests (read-only, no cache) | Current backend source inspected | 18 passed; no server business writes |
| Running API | /api-json 200 | Login + 15 authenticated reads 200 via frontend proxy |
| Static design detector | Not a browser audit | No findings; does not certify rendered accessibility |
| Visual/responsive/keyboard/contrast | NOT VERIFIED | Unsupported signed-in Zen session; manual checklist required |
| Live create→complete / concurrency / >50 records | NOT VERIFIED in this pass | No business mutation performed; automated/source evidence only |

The 38 remaining global TypeScript diagnostics are concentrated in legacy DeliveriesTable, DeliveryItemsTable, old orders/OrderItemsTable, SalesOrderProgress, PurchaseOrdersTable, stock-alerts.hooks and use-delivery-creation. They reference removed allocation models, obsolete workflow exports or unsupported props. These implementations are outside the mounted import graph, but tsconfig includes them, so they remain real deployment blockers. Do not exclude files, invent old exports or delete untracked code to hide the failure. Retire/migrate the legacy implementations in a separately reviewed frontend repair.

## Backend handoff and production blockers

1. **Warehouse archive is not transactional.** Frontend rechecks positive physical stock, but warehouses.service deactivate/setActive delegates to repository prisma.warehouse.update without an atomic stock/reference guard. A concurrent receipt can race the UI precheck. Backend should reject archival with physical stock and incompatible active references inside the transaction. Do not demonstrate archiving a stocked warehouse. No backend change made.
2. **Build cannot ship:** resolve the 38 legacy TS diagnostics, then run build with the real production HTTPS API origin on Node 22. Reassess bundle size only after bundling succeeds; a historical bundle warning was not freshly reproduced.
3. **Environment and operational validation:** verify deployed API/CORS/auth/HTTPS/session handling, backup/restore, authorization, concurrent planning/receiving/dispatch/quarantine and audit retention. No production security or load-test claim is made.
4. **Historical unit review:** inspect existing product units, especially pieces products registered when the UI silently used kg; repair persisted data only through an authorized supported process. This audit does not relabel stored products.

## Manual browser checklist and presentation gate

Use the signed-in Zen session at localhost:5173; reload before testing and inspect Network. Use approved local test records for writes, preserve audit history and avoid destructive operations on important stock.

1. Register a non-kg product with an explicit unit and a new warehouse; verify one request per submit, inline server errors and archived restore retry. Reject missing unit. Verify invalid vehicle capacity text/precision/overflow is visibly rejected.
2. SO and PO: add two products, edit quantities/prices, switch percent/fixed discounts, save/reopen drafts, confirm, check exact totals and revision conflict recovery. Verify fixed-peso SO draft changes now persist. Print/download PO.
3. Schedule incoming: select confirmed PO, warehouse and date; inspect POST has only header fields and schedule PATCH has no unsupported items. Confirm list refresh; Receive Goods submits actual received/damaged items and preserves partial PO progress.
4. Schedule outgoing: exercise zero remaining, partial plan, invalid quantity and long product names; verify immediate table refresh and request IDs. Dispatch selects valid vehicle/driver, uses correct stockItemId/salesOrderItemId/loadedQuantity. Complete with actual delivered quantities. Refresh page to confirm persisted results.
5. Inventory/warehouse: verify kg and pieces separately, zero versus missing values, positive quarantine and long names; ensure physical/available are distinct. Open Stock Alert Settings, save/reopen threshold; clear only intentionally. No mixed-unit sum should be labelled units.
6. Quarantine: Warehouse→Product filtering, empty warehouse, over-available quantity and reason/confirmation guards. On disposable approved records test partial CLEAR, REMOVE destructive confirmation and condition-only correction; verify lists, available/physical stock, history and role restrictions after refresh.
7. Staff/jobs/access and auth: test allowed Manager/Admin controls, Staff restrictions, archived restore errors, logout/expiry and server errors. Do not elevate accounts merely to complete QA.
8. At 360/768/1024/1366/1920 widths, short viewport and 200% zoom: check no clipped footer/actions, readable tables and quantities, intentional table scrolling, dropdown truncation/tooltips, stacked selectors, visible focus, keyboard navigation, labels, inline error announcement and contrast. These remain NOT VERIFIED until performed.

**Presentation decision:** proceed only after these relevant manual checks pass, with supported local services already running and a rehearsed safe dataset. Otherwise remain CONDITIONAL. Production remains NOT READY until build/runtime/backend atomicity and broader operational checks are resolved.

## Files changed in this QA pass

Paths below identify audit edits only; other modified/untracked files predated this pass and were preserved.

- src/components/operations/InventoryItemModal.tsx
- src/components/operations/WarehouseModal.tsx
- src/components/operations/VehicleModal.tsx
- src/components/operations/WarehouseInventory.tsx
- src/components/operations/WarehouseList.tsx
- src/components/operations/ReorderThresholdModal.tsx
- src/components/staffing/EmployeeModal.tsx
- src/components/staffing/JobModal.tsx
- src/components/orders/OrderModal.tsx
- src/components/ui/SearchableDropdown.tsx
- src/features/products/products.api.ts
- src/features/logistics/stock-items.api.ts
- src/features/logistics/delivery-vehicles.api.ts
- src/features/crm/sales-orders.api.ts
- src/features/crm/sales-order-entry.utils.ts
- src/components/operations/master-data-qa.component.test.tsx
- src/components/operations/vehicle-modal.component.test.tsx
- src/components/inventory/inventory-notifications.component.test.tsx
- src/components/ui/searchable-dropdown.component.test.tsx
- src/features/order-discounts.component.test.tsx
- src/features/crm/sales-order-draft.component.test.tsx
- docs/qa/FINAL-FRONTEND-QA.md
- docs/qa/FRONTEND-API-COVERAGE.md

## Reachable UI/surface inventory (source, not rendered QA)

| Source | Related rendered surface/control tags |
|---|---|
| src/components/ui/card.tsx | — |
| src/components/ui/tabs.tsx | TabsPrimitive.List; TabsPrimitive.Trigger; TabsPrimitive.Content |
| src/components/ui/separator.tsx | — |
| src/components/ui/ErjvPosLogo.tsx | — |
| src/components/ui/input.tsx | — |
| src/components/ui/label.tsx | — |
| src/components/ui/checkbox.tsx | — |
| src/components/ui/button.tsx | — |
| src/components/ui/alert.tsx | — |
| src/components/ui/spinner.tsx | — |
| src/components/auth/useFormValidation.tsx | — |
| src/components/auth/LoginForm.tsx | — |
| src/features/auth/AuthContext.tsx | AuthContext.Provider |
| src/components/auth/AuthCard.tsx | Tabs; TabsContent; LoginForm |
| src/components/ui/sonner.tsx | — |
| src/components/common/ErrorBoundary.tsx | — |
| src/components/ui/ManagementPage.tsx | — |
| src/components/ui/dialog.tsx | DialogPrimitive.Overlay; DialogPortal; DialogOverlay; DialogPrimitive.Content; DialogPrimitive.Close; DialogPrimitive.Title; DialogPrimitive.Description |
| src/components/ui/badge.tsx | — |
| src/components/ui/avatar.tsx | — |
| src/components/ui/dropdown-menu.tsx | DropdownMenuPrimitive.SubTrigger; DropdownMenuPrimitive.SubContent; DropdownMenuPrimitive.Portal; DropdownMenuPrimitive.Content; DropdownMenuPrimitive.Item; DropdownMenuPrimitive.CheckboxItem; DropdownMenuPrimitive.ItemIndicator; DropdownMenuPrimitive.RadioItem; DropdownMenuPrimitive.Label; DropdownMenuPrimitive.Separator |
| src/components/layout/DeliveryNavigation.tsx | NavLink |
| src/components/ui/select.tsx | SelectPrimitive.Viewport |
| src/components/layout/StockNotifications.tsx | DropdownMenu; DropdownMenuTrigger; DropdownMenuContent; DropdownMenuGroup; DropdownMenuLabel; DropdownMenuRadioGroup; DropdownMenuRadioItem; DropdownMenuSeparator; DropdownMenuItem |
| src/components/layout/DashboardLayout.tsx | DeliveryNavigation; NavLink; DropdownMenu; DropdownMenuTrigger; DropdownMenuContent; DropdownMenuSeparator; DropdownMenuGroup; DropdownMenuItem; Dialog; DialogContent; DialogTitle; DialogTrigger; Menu |
| src/components/dashboard/MainDashboard.tsx | ManagementPage |
| src/components/ui/StatusTabNav.tsx | — |
| src/components/ui/ArchiveTabNav.tsx | StatusTabNav |
| src/components/ui/table.tsx | — |
| src/components/ui/skeleton.tsx | — |
| src/components/ui/data-table.tsx | Table; TableHeader; TableRow; TableHead; TableBody; TableCell |
| src/components/ui/DataTableActions.tsx | — |
| src/components/crm/customers-pilot.css | — |
| src/components/crm/ClientModal.tsx | DialogHeader; DialogTitle; DialogDescription; DialogFooter; Dialog; DialogContent; ClientFormContent |
| src/components/ui/ConfirmDeleteModal.tsx | Dialog; DialogContent; DialogHeader; DialogTitle; DialogDescription; DialogFooter |
| src/components/ui/OverflowValue.tsx | — |
| src/components/crm/ClientList.tsx | DataTableActions; PageHeader; ArchiveTabNav; PageToolbar; DataTable; ClientModal; ConfirmDeleteModal |
| src/components/deliveries/shared/DeliveryStatusBadge.tsx | — |
| src/components/deliveries/shared/VehicleDetailModal.tsx | Dialog; DialogContent; DialogHeader; DialogTitle; DialogDescription; DataTable |
| src/components/deliveries/shared/VehicleStatusBadge.tsx | — |
| src/components/deliveries/shared/DeliveryTimeline.tsx | — |
| src/components/deliveries/shared/DeliveryDetailModal.tsx | Dialog; DialogContent; DialogHeader; DialogTitle; DialogDescription; DataTable; DialogFooter |
| src/components/ui/SearchableDropdown.tsx | DropdownMenu; DropdownMenuTrigger; DropdownMenuContent; DropdownMenuGroup; DropdownMenuItem |
| src/components/operations/VehicleModal.tsx | DialogHeader; DialogTitle; DialogDescription; SearchableDropdown; DialogFooter; Dialog; DialogContent; VehicleFormContent |
| src/components/operations/VehicleList.tsx | DropdownMenu; DropdownMenuTrigger; DropdownMenuContent; DropdownMenuGroup; DropdownMenuItem; DropdownMenuSeparator; PageHeader; ArchiveTabNav; PageToolbar; DataTable; VehicleModal; VehicleDetailModal; DeliveryDetailModal; ConfirmDeleteModal |
| src/components/staffing/EmployeeModal.tsx | DialogHeader; DialogTitle; DialogDescription; DialogFooter; Dialog; DialogContent; EmployeeFormContent |
| src/components/staffing/EmployeePositionSelector.tsx | DropdownMenu; DropdownMenuTrigger; DropdownMenuContent; DropdownMenuLabel; DropdownMenuSeparator; DropdownMenuGroup; DropdownMenuCheckboxItem |
| src/components/staffing/EmployeeList.tsx | DataTableActions; PageHeader; ArchiveTabNav; PageToolbar; DataTable; EmployeeModal; ConfirmDeleteModal |
| src/components/ui/textarea.tsx | — |
| src/components/staffing/JobModal.tsx | DialogHeader; DialogTitle; DialogDescription; DialogFooter; Dialog; DialogContent; JobFormContent |
| src/components/staffing/JobList.tsx | DataTableActions; PageHeader; ArchiveTabNav; PageToolbar; DataTable; JobModal; ConfirmDeleteModal |
| src/components/staffing/RegisterUserModal.tsx | Dialog; DialogContent; DialogHeader; DialogTitle; DialogDescription; DialogFooter |
| src/components/staffing/UserRolesList.tsx | DropdownMenu; DropdownMenuTrigger; DropdownMenuContent; DropdownMenuLabel; DropdownMenuSeparator; DropdownMenuGroup; DropdownMenuItem; DataTableActions; PageHeader; ArchiveTabNav; PageToolbar; DataTable; ConfirmDeleteModal; RegisterUserModal |
| src/components/ui/DataTableExpandedSection.tsx | — |
| src/components/inventory/StockIndicator.tsx | — |
| src/components/inventory/InventoryWholesalePrice.tsx | — |
| src/components/operations/InventoryItemModal.tsx | DialogHeader; DialogTitle; DialogDescription; DialogFooter; ConfirmDeleteModal; Dialog; DialogContent; ItemFormContent |
| src/components/inventory/InventoryItemCatalog.tsx | DataTableActions; DataTableExpandToggle; DataTableExpandedSection; ArchiveTabNav; PageToolbar; DataTable; InventoryItemModal; ConfirmDeleteModal |
| src/components/inventory/QuarantineLotDialog.tsx | Dialog; DialogContent; DialogHeader; DialogTitle; DialogDescription; DialogFooter; ConfirmDeleteModal |
| src/components/inventory/QuarantinedStock.tsx | DataTableActions; SearchableDropdown; DataTable; QuarantineLotDialog |
| src/components/inventory/StockConditionReportModal.tsx | Dialog; DialogContent; DialogHeader; DialogTitle; DialogDescription; SearchableDropdown; DialogFooter |
| src/components/inventory/InventoryHub.tsx | PageHeader; StockConditionReportModal |
| src/components/operations/WarehouseProducts.tsx | DataTableExpandedSection; DataTable |
| src/components/operations/WarehouseModal.tsx | DialogHeader; DialogTitle; DialogDescription; DialogFooter; Dialog; DialogContent; WarehouseFormContent |
| src/components/operations/WarehouseList.tsx | DataTableExpandToggle; DataTableActions; PageHeader; ArchiveTabNav; PageOverview; PageToolbar; DataTable; WarehouseModal; Dialog; DialogContent; DialogHeader; DialogTitle; DialogDescription; DialogFooter |
| src/components/orders/SalesOrderCancelModal.tsx | ConfirmDeleteModal |
| src/components/order-entry/order-entry.css | — |
| src/components/order-entry/OrderEntryDialog.tsx | Dialog; DialogContent; DialogHeader; DialogTitle; DialogDescription; Tabs; TabsList; TabsTrigger; TabsContent; DialogFooter |
| src/components/order-entry/OrderEntryFields.tsx | — |
| src/components/order-entry/OrderItemsTable.tsx | DataTable |
| src/components/order-entry/OrderLineDiscount.tsx | Dialog; DialogContent; DialogHeader; DialogTitle; DialogDescription |
| src/components/order-entry/OrderProductCatalog.tsx | DataTableActions; DataTable |
| src/components/order-entry/OrderAdditionalDetails.tsx | — |
| src/components/orders/SalesOrderDetails.tsx | SearchableDropdown |
| src/components/orders/SalesOrderTotals.tsx | — |
| src/components/orders/OrderModal.tsx | OrderEntryDialog; OrderItemsTable |
| src/components/deliveries/shared/delivery-form.styles.ts | — |
| src/components/deliveries/shared/CompleteDeliveryModal.tsx | Dialog; DialogContent; DialogHeader; DialogTitle; DialogDescription; DialogFooter |
| src/components/deliveries/shared/DeliveryFormDialog.tsx | Dialog; DialogContent; DialogHeader; DialogTitle; DialogDescription; DialogFooter |
| src/components/deliveries/ScheduleDeliveryModal.tsx | DeliveryFormDialog; OutgoingPlanningForm; DeliveryFormFooter; SearchableDropdown; DataTable |
| src/components/deliveries/shared/DispatchDeliveryModal.tsx | Dialog; DialogContent; DialogHeader; DialogTitle; DialogDescription; DataTable; DialogFooter |
| src/components/orders/QuickDispatchModal.tsx | DispatchDeliveryModal; ScheduleDeliveryModal |
| src/components/orders/OrderDetailDrawer.tsx | Dialog; DialogContent; DialogHeader; DialogTitle; DialogDescription; SalesOrderCancelModal; CompleteDeliveryModal; QuickDispatchModal |
| src/components/orders/OrdersView.tsx | DropdownMenu; DropdownMenuTrigger; DropdownMenuContent; DropdownMenuGroup; DropdownMenuItem; DropdownMenuSeparator; PageHeader; StatusTabNav; PageToolbar; DataTable; SalesOrderCancelModal; OrderModal; Dialog; DialogContent; DialogHeader; DialogTitle; DialogDescription; CompleteDeliveryModal; OrderDetailDrawer; DeliveryDetailModal; QuickDispatchModal |
| src/components/purchases/PurchaseModal.tsx | OrderEntryDialog; SearchableDropdown; OrderItemsTable |
| src/components/purchases/PurchaseOrderDetailModal.tsx | Dialog; DialogContent; DialogHeader; DialogTitle; DialogDescription; DataTable |
| src/components/purchases/SupplierModal.tsx | Dialog; DialogContent; DialogHeader; DialogTitle; DialogDescription; DialogFooter |
| src/components/purchases/PurchasesView.tsx | DropdownMenu; DropdownMenuTrigger; DropdownMenuContent; DropdownMenuGroup; DropdownMenuItem; DropdownMenuSeparator; DataTableActions; PageHeader; StatusTabNav; PageToolbar; DataTable; ArchiveTabNav; PurchaseOrderDetailModal; PurchaseModal; SupplierModal; ConfirmDeleteModal |
| src/components/deliveries/shared/IncomingDeliveryDetailModal.tsx | Dialog; DialogContent; DialogHeader; DialogTitle; DialogDescription; DataTable |
| src/components/deliveries/DeliveryTable.tsx | DataTableActions; DataTable |
| src/components/deliveries/ScheduleIncomingDeliveryModal.tsx | DeliveryFormDialog; DataTable; DeliveryFormFooter |
| src/components/deliveries/ReceiveProductsModal.tsx | Dialog; DialogContent; DialogHeader; DialogTitle; DialogDescription; DataTable; DialogFooter |
| src/components/deliveries/DeliveriesHub.tsx | PageHeader; PageToolbar; DeliveryTable; ScheduleIncomingDeliveryModal; ScheduleDeliveryModal; ReceiveProductsModal; CompleteDeliveryModal; DispatchDeliveryModal; DeliveryDetailModal; IncomingDeliveryDetailModal; PurchaseOrderDetailModal; OrderDetailDrawer; ConfirmDeleteModal |
| src/routing/DashboardPages.tsx | OrdersView; PurchasesView; Navigate |
| src/components/operations/ReorderThresholdModal.tsx | Dialog; DialogContent; DialogHeader; DialogTitle; DialogDescription; DialogFooter |
| src/components/operations/WarehouseInventory.tsx | DataTable; StockConditionReportModal; ReorderThresholdModal |
| src/routing/AppRoutes.tsx | Navigate |
| src/App.tsx | AuthCard; AuthProvider |

## Field inventory (source occurrences)

This records the explicit inputs/selects/comboboxes/checkboxes and their source constraints. Labels and composed controls may be supplied by their shared wrappers. Presence of aria attributes or validation props is not proof of accessible rendered interaction. Domain behavior is supported by the regression suites above; not every field received a separate live test. No blanket “all fields passed” claim is made.

| Source | Control | Identity / label | Source constraints and accessibility |
|---|---|---|---|
| src/components/ui/input.tsx:7 | input | See labelled wrapper | type={type} |
| src/components/auth/LoginForm.tsx:107 | Input | "login-email" | type="email"; disabled={isSubmitting}; aria-invalid={emailVal.message \|\| isPasswordRejected ? true : undefined}; aria-describedby={ emailVal.message \|\| isPasswordRejected ? 'login-email-error' : undefined } |
| src/components/auth/LoginForm.tsx:152 | Input | "login-password" | type={showPassword ? 'text' : 'password'}; disabled={isSubmitting}; aria-invalid={passVal.message \|\| isPasswordRejected ? true : undefined}; aria-describedby={ passVal.message \|\| isPasswordRejected ? 'login-password-error' : undefined } |
| src/components/auth/LoginForm.tsx:198 | Checkbox | "rememberMe" | disabled={isSubmitting} |
| src/components/layout/StockNotifications.tsx:117 | Select | See labelled wrapper | — |
| src/components/ui/data-table.tsx:673 | select | "Rows per page" | — |
| src/components/crm/ClientModal.tsx:205 | Input | "client-name" | required=true; aria-invalid={errorField === 'name' \|\| undefined}; aria-describedby={errorField === 'name' ? 'client-name-error' : undefined} |
| src/components/crm/ClientModal.tsx:231 | Input | "client-address" | required=true; aria-invalid={errorField === 'address' \|\| undefined}; aria-describedby={ errorField === 'address' ? 'client-address-error' : 'client-address-hint' } |
| src/components/crm/ClientModal.tsx:260 | Input | "client-contact" | — |
| src/components/crm/ClientModal.tsx:270 | Input | "client-phone" | type="tel"; inputMode="tel"; aria-invalid={errorField === 'phone' \|\| undefined}; aria-describedby={ errorField === 'phone' ? 'client-phone-error' : 'client-phone-hint' } |
| src/components/crm/ClientModal.tsx:295 | Input | "client-email" | type="email"; aria-invalid={errorField === 'email' \|\| undefined}; aria-describedby={errorField === 'email' ? 'client-email-error' : undefined} |
| src/components/crm/ClientList.tsx:149 | Input | "Search customers" | — |
| src/components/deliveries/shared/VehicleDetailModal.tsx:102 | Select | See labelled wrapper | — |
| src/components/ui/SearchableDropdown.tsx:158 | Input | {searchPlaceholder} | type="search"; aria-invalid={tooLong \|\| undefined}; aria-describedby={tooLong ? validationId : undefined} |
| src/components/operations/VehicleModal.tsx:249 | Input | "v-plate" | required=true |
| src/components/operations/VehicleModal.tsx:268 | SearchableDropdown | "v-type" | — |
| src/components/operations/VehicleModal.tsx:292 | Input | "v-model" | — |
| src/components/operations/VehicleModal.tsx:308 | Input | "v-capacity" | type="text"; inputMode="decimal"; aria-invalid={!!capacityError}; aria-describedby={capacityError ? 'vehicle-capacity-error' : undefined} |
| src/components/operations/VehicleModal.tsx:333 | Select | See labelled wrapper | — |
| src/components/operations/VehicleList.tsx:339 | Input | "Search vehicles" | — |
| src/components/operations/VehicleList.tsx:348 | Select | See labelled wrapper | — |
| src/components/staffing/EmployeeModal.tsx:202 | Input | "emp-fname" | required=true |
| src/components/staffing/EmployeeModal.tsx:221 | Input | "emp-lname" | required=true |
| src/components/staffing/EmployeeModal.tsx:242 | Input | "emp-email" | type="email" |
| src/components/staffing/EmployeeModal.tsx:276 | Input | "emp-phone" | type="tel" |
| src/components/staffing/EmployeeModal.tsx:295 | Input | "emp-address" | — |
| src/components/staffing/EmployeeModal.tsx:312 | Input | "emp-hiredate" | type="date"; required=true |
| src/components/staffing/EmployeeModal.tsx:327 | Select | See labelled wrapper | disabled={isPending \|\| usersLoading \|\| !!usersError} |
| src/components/staffing/EmployeeList.tsx:260 | Input | "Search staff" | — |
| src/components/ui/textarea.tsx:7 | textarea | See labelled wrapper | — |
| src/components/staffing/JobModal.tsx:137 | Input | "job-name" | required=true |
| src/components/staffing/JobModal.tsx:162 | Textarea | "job-desc" | — |
| src/components/staffing/JobList.tsx:205 | Input | "Search job positions" | — |
| src/components/staffing/RegisterUserModal.tsx:167 | Input | "register-email" | type="email"; disabled={registerMutation.isPending} |
| src/components/staffing/RegisterUserModal.tsx:188 | Select | See labelled wrapper | disabled={registerMutation.isPending} |
| src/components/staffing/RegisterUserModal.tsx:242 | Select | See labelled wrapper | disabled={registerMutation.isPending} |
| src/components/staffing/RegisterUserModal.tsx:290 | Input | "register-password" | type={showPassword ? 'text' : 'password'}; disabled={registerMutation.isPending} |
| src/components/staffing/RegisterUserModal.tsx:322 | Input | "register-confirm" | type={showConfirmPassword ? 'text' : 'password'}; disabled={registerMutation.isPending} |
| src/components/staffing/UserRolesList.tsx:419 | Input | "Search user accounts" | — |
| src/components/inventory/InventoryWholesalePrice.tsx:74 | Input | {`Wholesale price for ${product.name}`} | type="text"; inputMode="decimal"; disabled={updatePrice.isPending}; aria-invalid={Boolean(error)}; aria-describedby={error ? `price-error-${product.id}` : undefined} |
| src/components/operations/InventoryItemModal.tsx:225 | Input | "item-name" | required=true |
| src/components/operations/InventoryItemModal.tsx:247 | Input | "item-variety" | — |
| src/components/operations/InventoryItemModal.tsx:264 | Input | "item-unit" | required={!isEditing} |
| src/components/operations/InventoryItemModal.tsx:290 | Input | "item-price" | type="number"; required=true; min="0"; step="0.01" |
| src/components/operations/InventoryItemModal.tsx:311 | Textarea | "item-desc" | — |
| src/components/inventory/InventoryItemCatalog.tsx:518 | Select | See labelled wrapper | — |
| src/components/inventory/InventoryItemCatalog.tsx:537 | Select | See labelled wrapper | — |
| src/components/inventory/InventoryItemCatalog.tsx:584 | Input | "Search inventory" | — |
| src/components/inventory/QuarantineLotDialog.tsx:418 | Select | See labelled wrapper | — |
| src/components/inventory/QuarantineLotDialog.tsx:447 | Input | "quarantine-quantity" | required=true; inputMode="decimal"; aria-invalid={!!quantityError}; aria-describedby={`quarantine-quantity-help${quantityError ? ' quarantine-quantity-error' : ''}`} |
| src/components/inventory/QuarantineLotDialog.tsx:477 | Input | "quarantine-reason" | required=true |
| src/components/inventory/QuarantineLotDialog.tsx:486 | input | See labelled wrapper | type="checkbox" |
| src/components/inventory/QuarantinedStock.tsx:70 | SearchableDropdown | "quarantine-stock-filter" | — |
| src/components/inventory/QuarantinedStock.tsx:91 | Select | See labelled wrapper | — |
| src/components/inventory/QuarantinedStock.tsx:109 | Select | See labelled wrapper | — |
| src/components/inventory/StockConditionReportModal.tsx:241 | SearchableDropdown | "condition-warehouse" | — |
| src/components/inventory/StockConditionReportModal.tsx:266 | SearchableDropdown | "condition-stock" | — |
| src/components/inventory/StockConditionReportModal.tsx:332 | Select | See labelled wrapper | — |
| src/components/inventory/StockConditionReportModal.tsx:349 | Input | "condition-quantity" | required=true; inputMode="decimal"; aria-invalid={!!quantityError}; aria-describedby={`condition-quantity-help${quantityError ? ' condition-quantity-error' : ''}`} |
| src/components/inventory/StockConditionReportModal.tsx:376 | Input | "condition-reason" | required=true |
| src/components/inventory/StockConditionReportModal.tsx:384 | input | See labelled wrapper | type="checkbox" |
| src/components/operations/WarehouseModal.tsx:197 | Input | "wh-name" | required=true |
| src/components/operations/WarehouseModal.tsx:218 | Input | "wh-address" | required=true |
| src/components/operations/WarehouseModal.tsx:248 | Input | "wh-phone" | type="tel" |
| src/components/operations/WarehouseList.tsx:336 | Input | "Search warehouses" | — |
| src/components/order-entry/OrderEntryFields.tsx:51 | Input | See labelled wrapper | type="text"; inputMode="decimal" |
| src/components/order-entry/OrderLineDiscount.tsx:54 | Select | See labelled wrapper | — |
| src/components/order-entry/OrderLineDiscount.tsx:70 | Input | {`Line discount for ${name}`} | type="text"; inputMode="decimal"; disabled={fixedDisabled && value.type === 'peso'}; aria-invalid={!!error}; aria-describedby={error ? `${id}-${compact ? 'editor-error' : 'error'}` : undefined} |
| src/components/order-entry/OrderProductCatalog.tsx:139 | Input | "Search inventory products" | — |
| src/components/order-entry/OrderAdditionalDetails.tsx:37 | Input | {referenceId} | — |
| src/components/order-entry/OrderAdditionalDetails.tsx:46 | Input | {notesId} | — |
| src/components/orders/SalesOrderDetails.tsx:33 | SearchableDropdown | "order-customer" | — |
| src/components/orders/SalesOrderDetails.tsx:53 | Input | "order-expected" | type="date" |
| src/components/orders/SalesOrderDetails.tsx:62 | Input | "order-address" | — |
| src/components/orders/SalesOrderTotals.tsx:12 | input | "Vat exempt" | type="checkbox"; disabled={form.busy} |
| src/components/deliveries/shared/CompleteDeliveryModal.tsx:247 | input | "delivery-outcome" | type="radio" |
| src/components/deliveries/shared/CompleteDeliveryModal.tsx:258 | input | "delivery-outcome" | type="radio" |
| src/components/deliveries/shared/CompleteDeliveryModal.tsx:331 | Input | {`${label} for ${row.product?.name \|\| 'unavailable product'} (${index + 1})`} | inputMode="decimal"; aria-invalid={invalid}; aria-describedby={`completion-balance-${row.item.id}`} |
| src/components/deliveries/shared/CompleteDeliveryModal.tsx:370 | Input | {`Discrepancy Reason for ${row.product?.name \|\| 'unavailable product'} (${index + 1})`} | required=true |
| src/components/deliveries/ScheduleDeliveryModal.tsx:195 | Input | {`Quantity to ship for ${product?.name \|\| `Product #${row.inventoryItemId}`}`} | type="text"; min="0"; max={option?.maximumPlannableQuantity}; step="0.01"; inputMode="decimal"; disabled={ readOnly \|\| !form.activeWarehouse \|\| form.planningLoading \|\| !option \|\| (maximum === 0n && quantity === 0n) }; aria-invalid={!!errors[field]}; aria-describedby={`delivery-${field}-hint${errors[field] ? ` delivery-${field}-error` : ''}`} |
| src/components/deliveries/ScheduleDeliveryModal.tsx:395 | Input | "delivery-sales-order" | — |
| src/components/deliveries/ScheduleDeliveryModal.tsx:402 | SearchableDropdown | "delivery-sales-order" | — |
| src/components/deliveries/ScheduleDeliveryModal.tsx:438 | Select | See labelled wrapper | disabled={readOnly} |
| src/components/deliveries/ScheduleDeliveryModal.tsx:556 | Input | "delivery-scheduled-at" | type="datetime-local"; aria-invalid={!!errors['scheduled-at']}; aria-describedby={ errors['scheduled-at'] ? 'delivery-scheduled-at-error' : undefined } |
| src/components/deliveries/ScheduleDeliveryModal.tsx:581 | Input | "delivery-notes" | — |
| src/components/deliveries/shared/DispatchDeliveryModal.tsx:421 | Input | {`Actually loaded for ${row.product?.name \|\| 'unavailable product'}`} | inputMode="decimal"; disabled={dispatchMutation.isPending \|\| unavailable}; aria-invalid={!!quantityError(row)}; aria-describedby={ quantityError(row) ? `dispatch-error-${row.id}` : undefined } |
| src/components/deliveries/shared/DispatchDeliveryModal.tsx:491 | Select | See labelled wrapper | — |
| src/components/deliveries/shared/DispatchDeliveryModal.tsx:531 | Select | See labelled wrapper | — |
| src/components/orders/OrdersView.tsx:516 | Input | "Search orders" | — |
| src/components/purchases/PurchaseModal.tsx:310 | SearchableDropdown | "po-supplier" | — |
| src/components/purchases/PurchaseModal.tsx:338 | Input | "po-expected" | type="date" |
| src/components/purchases/SupplierModal.tsx:85 | Input | "supplier-code" | — |
| src/components/purchases/SupplierModal.tsx:98 | Input | "supplier-name" | required=true |
| src/components/purchases/SupplierModal.tsx:114 | Input | "supplier-contact" | — |
| src/components/purchases/SupplierModal.tsx:127 | Input | "supplier-phone" | — |
| src/components/purchases/SupplierModal.tsx:141 | Input | "supplier-email" | type="email" |
| src/components/purchases/SupplierModal.tsx:155 | Input | "supplier-address" | — |
| src/components/purchases/PurchasesView.tsx:615 | Input | "Search purchase orders" | — |
| src/components/purchases/PurchasesView.tsx:711 | Input | "Search suppliers" | — |
| src/components/deliveries/ScheduleIncomingDeliveryModal.tsx:263 | Select | See labelled wrapper | disabled={isSubmitting \|\| unavailable \|\| eligiblePOs.length === 0} |
| src/components/deliveries/ScheduleIncomingDeliveryModal.tsx:308 | Select | See labelled wrapper | — |
| src/components/deliveries/ScheduleIncomingDeliveryModal.tsx:339 | Input | "sched-date" | type="datetime-local" |
| src/components/deliveries/ScheduleIncomingDeliveryModal.tsx:353 | Input | "supplier-ref" | — |
| src/components/deliveries/ScheduleIncomingDeliveryModal.tsx:397 | Input | "intake-notes" | — |
| src/components/deliveries/ReceiveProductsModal.tsx:126 | input | "receipt-outcome" | type="radio"; disabled={value !== 'none' && form.regularUnavailable} |
| src/components/deliveries/ReceiveProductsModal.tsx:223 | Input | {`${label} for ${row.product?.name ?? 'product'} (${index + 1})`} | inputMode="decimal"; aria-invalid={!!error}; aria-describedby={error ? errorId : undefined} |
| src/components/deliveries/ReceiveProductsModal.tsx:253 | Input | "no-receipt-reason" | required=true; disabled={form.disabled} |
| src/components/deliveries/DeliveriesHub.tsx:88 | Select | See labelled wrapper | — |
| src/components/deliveries/DeliveriesHub.tsx:308 | Input | "Search deliveries" | — |
| src/components/deliveries/DeliveriesHub.tsx:383 | Input | "delivery-date-from" | type="date" |
| src/components/deliveries/DeliveriesHub.tsx:395 | Input | "delivery-date-to" | type="date"; min={fromDate \|\| undefined} |
| src/components/operations/ReorderThresholdModal.tsx:70 | Input | "stock-reorder-threshold" | type="number"; min="0"; step="0.01"; disabled={mutation.isPending}; aria-invalid={!!error}; aria-describedby={error ? 'stock-reorder-threshold-error' : undefined} |
| src/components/operations/WarehouseInventory.tsx:296 | Input | "Search warehouse products" | — |

## Final served-source and build evidence

GET localhost:5173/src/components/operations/InventoryItemModal.tsx, WarehouseInventory.tsx and VehicleModal.tsx each returned 200 and contained their updated unit/settings/capacity validation markers. The Vite server therefore serves these updated modules. This does not establish whether an already-open browser tab applied HMR or whether its cached assets/DOM are current; reload and run the manual checklist.

Global build diagnostic inventory (not suppressed):

```text
src/components/deliveries/DeliveriesTable.tsx(17,3): error TS2724: '"@/features/logistics/delivery-workflow"' has no exported member named 'deliveryPrimaryAction'. Did you mean 'DeliveryAction'?
src/components/deliveries/DeliveriesTable.tsx(18,3): error TS2305: Module '"@/features/logistics/delivery-workflow"' has no exported member 'deliveryCanCancel'.
src/components/deliveries/DeliveriesTable.tsx(19,8): error TS2724: '"@/features/logistics/delivery-workflow"' has no exported member named 'DeliverySection'. Did you mean 'DeliveryAction'?
src/components/deliveries/DeliveriesTable.tsx(82,13): error TS2322: Type '{ value: string; href: string; onActivate: () => void; className: string; }' is not assignable to type 'IntrinsicAttributes & OverflowValueProps'.
src/components/deliveries/DeliveriesTable.tsx(157,47): error TS2322: Type '"DRAFT" | "SCHEDULED" | "COMPLETED" | "CANCELLED" | "DISPATCHED" | "DELIVERED"' is not assignable to type 'OutgoingDeliveryStatus'.
src/components/deliveries/DeliveriesTable.tsx(177,36): error TS7053: Element implicitly has an 'any' type because expression of type 'any' can't be used to index type '{ schedule: string; receive: string; dispatch: string; deliver: string; }'.
src/components/deliveries/DeliveriesTable.tsx(180,22): error TS7053: Element implicitly has an 'any' type because expression of type 'any' can't be used to index type '{ schedule: string; receive: string; dispatch: string; deliver: string; }'.
src/components/deliveries/DeliveriesTable.tsx(215,26): error TS7053: Element implicitly has an 'any' type because expression of type 'any' can't be used to index type '{ schedule: string; receive: string; dispatch: string; deliver: string; }'.
src/components/deliveries/shared/DeliveryItemsTable.tsx(6,15): error TS2724: '"@/features/logistics/delivery-quantities"' has no exported member named 'DeliveryQuantityRow'. Did you mean 'deliveryQuantityError'?
src/components/orders/OrderItemsTable.tsx(41,24): error TS2365: Operator '>=' cannot be applied to types 'string' and 'number'.
src/components/orders/OrderItemsTable.tsx(51,33): error TS2365: Operator '<=' cannot be applied to types 'string' and 'number'.
src/components/orders/OrderItemsTable.tsx(119,56): error TS2339: Property 'stockItemId' does not exist on type 'OrderLine'.
src/components/orders/OrderItemsTable.tsx(139,29): error TS2339: Property 'stockItemId' does not exist on type 'OrderLine'.
src/components/orders/OrderItemsTable.tsx(154,24): error TS2339: Property 'warehouseId' does not exist on type 'OrderLine'.
src/components/orders/OrderItemsTable.tsx(155,45): error TS2339: Property 'warehouseId' does not exist on type 'OrderLine'.
src/components/orders/OrderItemsTable.tsx(155,86): error TS2339: Property 'warehouseId' does not exist on type 'OrderLine'.
src/components/orders/OrderItemsTable.tsx(163,31): error TS2345: Argument of type 'string' is not assignable to parameter of type 'number'.
src/components/orders/OrderItemsTable.tsx(166,31): error TS2362: The left-hand side of an arithmetic operation must be of type 'any', 'number', 'bigint' or an enum type.
src/components/orders/OrderItemsTable.tsx(166,48): error TS2363: The right-hand side of an arithmetic operation must be of type 'any', 'number', 'bigint' or an enum type.
src/components/orders/OrderItemsTable.tsx(195,58): error TS2339: Property 'stockItemId' does not exist on type 'OrderLine'.
src/components/orders/OrderItemsTable.tsx(213,46): error TS2345: Argument of type 'string' is not assignable to parameter of type 'number'.
src/components/orders/OrderItemsTable.tsx(225,33): error TS2362: The left-hand side of an arithmetic operation must be of type 'any', 'number', 'bigint' or an enum type.
src/components/orders/OrderItemsTable.tsx(225,49): error TS2363: The right-hand side of an arithmetic operation must be of type 'any', 'number', 'bigint' or an enum type.
src/components/orders/SalesOrderProgress.tsx(6,10): error TS2305: Module '"@/features/logistics/delivery-quantities"' has no exported member 'salesDeliveryProgress'.
src/components/orders/SalesOrderProgress.tsx(98,28): error TS7006: Parameter 'row' implicitly has an 'any' type.
src/components/purchases/PurchaseOrdersTable.tsx(59,33): error TS2345: Argument of type 'number | null' is not assignable to parameter of type 'number'.
src/components/purchases/PurchaseOrdersTable.tsx(83,13): error TS2322: Type '{ value: string; href: string; onActivate: () => void; className: string; }' is not assignable to type 'IntrinsicAttributes & OverflowValueProps'.
src/features/logistics/stock-alerts.hooks.ts(11,47): error TS2554: Expected 0-1 arguments, but got 2.
src/features/logistics/stock-alerts.hooks.ts(12,40): error TS2554: Expected 0 arguments, but got 1.
src/features/logistics/stock-alerts.hooks.ts(13,44): error TS2554: Expected 0 arguments, but got 1.
src/features/logistics/use-delivery-creation.ts(7,3): error TS2305: Module '"./delivery-quantities"' has no exported member 'committedIncoming'.
src/features/logistics/use-delivery-creation.ts(8,3): error TS2305: Module '"./delivery-quantities"' has no exported member 'committedOutgoing'.
src/features/logistics/use-delivery-creation.ts(9,8): error TS2724: '"./delivery-quantities"' has no exported member named 'DeliveryQuantityRow'. Did you mean 'deliveryQuantityError'?
src/features/logistics/use-delivery-creation.ts(52,44): error TS2339: Property 'allocations' does not exist on type 'SalesOrderItemRecord'.
src/features/logistics/use-delivery-creation.ts(71,16): error TS18046: 'item.allocations' is of type 'unknown'.
src/features/logistics/use-delivery-creation.ts(73,14): error TS7006: Parameter 'allocation' implicitly has an 'any' type.
src/features/logistics/use-delivery-creation.ts(78,17): error TS7006: Parameter 'allocation' implicitly has an 'any' type.
src/features/logistics/use-delivery-creation.ts(156,13): error TS2322: Type '{ salesOrderAllocationId: any; quantity: string; }[]' is not assignable to type 'OutgoingDeliveryLineCommand[]'.
```

Final git diff --check passed (line-ending warnings only). Backend git status remained clean. Existing frontend work was preserved.
