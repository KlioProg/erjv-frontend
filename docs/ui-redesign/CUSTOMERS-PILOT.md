# White-first redesign — Customers approval checkpoint

Historical checkpoint: the current Inter/brand-green foundation and review evidence are in [PREMIUM-PILOT.md](PREMIUM-PILOT.md). The earlier palette and screenshots below are retained as history.

15 October 2026. Scope for this checkpoint: repository audit and a contained Customers pilot. Application-wide rollout requires explicit visual approval. Earlier reports and screenshots in this folder describe pre-existing work, not approval or verification of this pilot.

## Audit and proposal

The application uses `MainDashboard` state and `DashboardLayout` navigation rather than URL routes. Its New York shadcn/Radix foundation, canonical DataTable, domain-owned column definitions, query hooks, and API services are reusable.

The current UI feels generic because hierarchy is inconsistent: IDs compete with names, broad management CSS enlarges secondary metadata to the same size as primary values, and forms mix bold labels, decorative field icons, animations, and unrelated radius utilities. Beige global tokens conflict with the approved white-first direction. Repeated bordered controls and disconnected filter/search/table groups fragment directory screens. Some request errors resemble legitimate empty states.

The pilot uses white `#FFFFFF`, graphite `#1C211D`, supporting text `#626A63`, secondary surface `#F7F8F6`, and separators `#E4E7E1`. Dark green `#507410` carries primary actions with white text; the existing `#80B918` brand remains available for restrained accents. Existing Segoe UI/system typography stays: 22px page heading, 20px dialog heading, 14px primary table values, 12px metadata/headers, 13px controls and labels. Rows target 52px with existing coarse-pointer touch targets preserved.

One directory surface groups active/archive counts, search, rows, and pagination. The primary action sits alongside the page identity. The form groups customer identity/address separately from optional contacts. No invented metrics, decorative content, font dependencies, UI frameworks, or business-data fixtures enter production.

## Implementation scope

- `ClientList`: page composition, domain columns, filters, empty/no-results recovery, loading, query error/retry, archive confirmation lifetime.
- `ClientModal`: grouped fields, quieter typography, accessible inline validation, existing create/edit/duplicate/reactivation flows.
- `customers-pilot.css`: scoped tokens and presentation; the Customers workspace and explicit portaled customer dialogs opt in. Shared/global CSS remains unchanged by this checkpoint.
- `ConfirmDeleteModal`: optional `className` passes through to its existing dialog; other callers keep their current presentation.
- Customer component tests: error recovery and validation behavior. Existing master-data tests cover edit/archive/restore and read-only permissions.

After approval, shared drivers should be ManagementPage/PageHeader/PageToolbar, DataTable, ArchiveTabNav/StatusTabNav, Buttons, form controls/labels, Dialog, ConfirmDeleteModal, Badge, menus, tooltips, and Sonner. Promote pilot tokens then remove redundant pilot CSS. Do not replace domain-specific layouts with one generic template.

## Repository screen checklist

Each rollout item includes loading, empty, no-results, error, permission, responsive, and relevant dialog/menu/confirmation states. Unchecked items have not received this new approved-direction rollout, regardless of earlier working-tree edits.

- [x] Audit actual navigation, shared primitives, and existing screen files.
- [x] Customers: directory, active/archive filters, search, pagination, row actions, create/edit, duplicate/reactivation, archive confirmation.
- [ ] Explicit visual approval of the Customers pilot before promoting styles or rolling out to other modules.
- [ ] Shell: sidebar, mobile navigation, breadcrumbs, account menu, stock notifications, footer.
- [ ] Authentication: AuthCard/LoginForm, auth loading/error, ErrorBoundary; profile form exists but is not mounted by current navigation.
- [ ] Sales Orders: OrdersView, OrderModal/OrderEntryDialog, product catalog, line items, additional details, totals, sources, detail drawer, cancellation, quick dispatch.
- [ ] Suppliers: PurchasesView supplier directory and SupplierModal, archive/restore.
- [ ] Purchase Orders: PurchasesView orders, PurchaseModal/shared order entry, PurchaseOrderDetailModal, delivery handoff.
- [ ] Inventory: InventoryHub/InventoryItemCatalog, item creation/editing, wholesale prices, stock indicators, stock notifications/focus.
- [ ] Stock and warehouses: WarehouseList, WarehouseInventory, InventoryStockList, WarehouseModal, StockAdjustModal, stock safeguards.
- [ ] Incoming deliveries: DeliveriesHub/DeliveryTable, scheduling, incoming details, quantities, allocation, timeline.
- [ ] Outgoing deliveries: scheduling, assignment, dispatch, DeliveryDetailModal, quantity and progress states.
- [ ] Delivery History: filters and existing incoming/outgoing detail views.
- [ ] Vehicles: VehicleList, VehicleModal, VehicleDetailModal, eligibility/status states.
- [ ] Staff Directory: EmployeeList, EmployeeModal, position selector, account-link states.
- [ ] Job Positions: JobList, JobModal, archive/restore.
- [ ] User Roles & Access: UserRolesList, RegisterUserModal, permission and account states.
- [ ] Shared overlays/feedback: search dropdowns, OverflowValue tooltips, selects, dropdown menus, toasts, confirmations.
- [ ] Dormant existing screens: ExecutiveDashboard, OperationsDashboard, StaffingDashboard, ProductListModal, SettingsView, FeedbackView. Audit their layouts if retained; do not add navigation or activate them as part of visual work.
- [ ] Final application-wide consistency and quality review, after rollout.

## Validation

- `npm run lint`: passes. Prettier checks pass on changed pilot files. `git diff --check` reports no whitespace errors.
- `npm run build`: passes, including TypeScript project compilation. Build-only `VITE_API_BASE_URL=https://example.test` satisfies the existing environment guard; it does not configure or validate a real backend. The existing JavaScript bundle warning above 500kB remains.
- `npm run test:unit`: all 47 unit tests pass. Six new Customers checks cover directory retry, field-associated phone validation, recoverable archive/reactivation failures, no-results recovery, and keyboard focus return. Existing master-data tests preserve permissions and edit/archive/restore behavior.
- A full parallel component run passed 104/105 but hit the existing five-second limit in a Sales composer draft test. Both matching Sales/Purchase draft tests passed in isolation. Full sequential rerun (`npx vitest run --no-file-parallelism`): all 105 component tests pass across all 9 files. No test timeout or application behavior was changed to obtain this result.
- Actual headless Microsoft Edge rendering at 1440×1000, 1024×844, and 390×844. Touch emulation preserves 44px controls. No document-level horizontal overflow. Tables scroll within their container; mobile filters fit and dialogs scroll inside the viewport. Computed sizes confirm 22px page titles, 14px primary cells, 12px metadata, and 13px labels. Mouse rows fit content at roughly 52–55px; touch rows accommodate their controls.
- Exercised canonical pagination, name sorting, active/archive filtering, search/clear search, create/edit dialogs, inline phone errors, Escape and return focus to Edit, and failed archive confirmation. Zero unhandled browser exceptions in this fixture run.
- [Desktop](customers-pilot/desktop.png), [customer registration](customers-pilot/create-dialog.png), [editing](customers-pilot/edit-dialog.png), [validation](customers-pilot/validation.png), [tablet](customers-pilot/tablet.png), [mobile](customers-pilot/mobile.png), [mobile dialog](customers-pilot/mobile-dialog.png), [mobile actions/pagination](customers-pilot/mobile-actions-pagination.png), [archive](customers-pilot/archived.png), [confirmation](customers-pilot/archive-confirmation.png), [no results](customers-pilot/no-results.png), [empty](customers-pilot/empty.png), [loading](customers-pilot/loading.png), [request error](customers-pilot/error.png). Raw typography, geometry, and interaction evidence: [checks.json](customers-pilot/checks.json).
- Fresh independent review inspected all 14 screenshots and scoped source: **ship the Customers pilot for visual approval**, no material pilot-specific findings. Its independent Customers/master-data suites passed 14/14. Sampled supporting/error text and primary action contrast exceeded 4.5:1; no full automated accessibility conformance claim is made.

All screenshot data is synthetic and isolated in a temporary read-only Vite/browser-test harness under ignored `node_modules/.cache/customers-pilot`. All HTTP is intercepted; writes are rejected. The production build contains no review fixture or authentication bypass. The standard application still requires its existing authentication and backend.

Not checked: live authentication/backend mutations, physical devices, full screen-reader conformance, or other application modules in this new direction. No commit, push, deployment, dependency addition, or backend modification. Existing unrelated working-tree changes remain in place.
