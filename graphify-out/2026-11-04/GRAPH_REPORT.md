# Graph Report - src  (2026-11-02)

## Corpus Check
- 335 files · ~207,994 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 3 file(s) not represented in the graph (top: .css 3)

## Summary
- 1758 nodes · 9160 edges · 70 communities (63 shown, 7 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 79 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- Delivery Forms and Errors
- FinancialReportsPage.tsx
- Delivery Runs and Dispatch
- ref_lucide_react
- Shared Tables and Navigation
- Customers and Cursor Lookups
- Integration Test Dependencies
- Management Lists and Pagination
- Order Entry and Pricing
- InventoryItemCatalog.tsx
- Staffing Mutations
- Order Forms and Discounts
- Purchase Pricing and Suppliers
- Dashboard Cards and Boundaries
- Delivery Details and Utilities
- sales-orders.hooks.ts
- ref_axios
- api-contracts.component.test.tsx
- Outgoing Balances and Quantities
- Suppliers and Purchase Receipts
- Delivery Vehicles API
- Authentication and Roles
- use-incoming-receiving.ts
- Outgoing Deliveries API
- DashboardLayout.tsx
- useAuth
- Outgoing Completion Workflow
- Stock Items and Precision
- purchase-orders.types.ts
- Products and Wholesale Pricing
- Quarantine API and Contracts
- use-stock-notification-records.ts
- Delivery Hub Workflow
- PurchasesView.tsx
- Warehouse API and Hooks
- Application Bootstrap and Errors
- Stock Display and Dispatch
- purchase-receipt.ts
- Delivery Confirmation Tests
- Order Delivery Workflow Tests
- Outgoing Scheduling Tests
- Quarantine Lot Action Tests
- Stock Alert Contract Tests
- Quarantine Tag Coordination
- Inventory Notification Tests
- OrderLineDiscount.tsx
- Stock Status Badges
- incoming-receiving.component.test.tsx
- OutgoingDeliveryRecord
- Outgoing Dispatch Tests
- quarantine.component.test.tsx
- Quarantine Selector Tests
- Order Selector Pagination Tests
- stock-display.ts
- Sales Order Draft Tests
- Sales Delivery Presentation
- Stock Condition Report Tests
- Warehouse Management Tests
- UnifiedNavbar.tsx
- OrdersView.tsx
- stock-alerts.test.mjs
- api-client.ts
- Hero Illustration Layers
- React Logo Asset
- Vite Logo Asset
- stock-notifications.component.test.tsx
- vehicle-modal.component.test.tsx

## God Nodes (most connected - your core abstractions)
1. `getErrorMessage()` - 211 edges
2. `Button` - 175 edges
3. `cn()` - 110 edges
4. `parseStockCents()` - 106 edges
5. `Input` - 103 edges
6. `DataTable()` - 95 edges
7. `Alert` - 86 edges
8. `AlertDescription` - 84 edges
9. `apiClient` - 75 edges
10. `DialogContent` - 73 edges

## Surprising Connections (you probably didn't know these)
- `ReportSession()` --calls--> `CursorLookup()`  [EXTRACTED]
  components/financial-reports/FinancialReportsPage.tsx → src/components/ui/CursorLookup.tsx
- `Results()` --calls--> `CursorPageControls()`  [EXTRACTED]
  components/financial-reports/FinancialReportsPage.tsx → src/components/ui/CursorPageControls.tsx
- `Results()` --calls--> `ManagementPage()`  [EXTRACTED]
  components/financial-reports/FinancialReportsPage.tsx → src/components/ui/ManagementPage.tsx
- `Results()` --calls--> `PageOverview()`  [EXTRACTED]
  components/financial-reports/FinancialReportsPage.tsx → src/components/ui/ManagementPage.tsx
- `ReportSession()` --calls--> `PageToolbar()`  [EXTRACTED]
  components/financial-reports/FinancialReportsPage.tsx → src/components/ui/ManagementPage.tsx

## Import Cycles
- None detected.

## Communities (70 total, 7 thin omitted)

### Community 0 - "Delivery Forms and Errors"
Cohesion: 0.06
Nodes (150): AccountProfileModal(), AccountProfileModalProps, LoginForm(), LoginFormProps, useFormValidation(), DeliveryFilter(), DeliveryQuantityRow, DeliveryQuantityTable() (+142 more)

### Community 1 - "FinancialReportsPage.tsx"
Cohesion: 0.06
Nodes (97): auth, mount(), Details(), FinancialReportsPage(), labels, ReportSession(), Results(), tabs (+89 more)

### Community 2 - "Delivery Runs and Dispatch"
Cohesion: 0.07
Nodes (62): fetchClientByIdApi(), fetchSalesOrderByIdApi(), cancelDeliveryRunApi(), cancelRunMemberApi(), changeRunMembersApi(), createDeliveryRunApi(), decimal(), dispatchDeliveryRunApi() (+54 more)

### Community 3 - "ref_lucide_react"
Cohesion: 0.21
Nodes (14): StockNotifications(), NotificationBell(), NotificationPanel(), NotificationPanelProps, StockAlertItem(), EmployeePositionSelector(), EmployeePositionSelectorProps, DropdownMenuCheckboxItem (+6 more)

### Community 4 - "Shared Tables and Navigation"
Cohesion: 0.08
Nodes (33): OrderSummary(), OrderSummaryProps, CellContext, ColumnAlign, DataTableProps, getAlignmentClass(), getCellValue(), getColumnId() (+25 more)

### Community 5 - "Customers and Cursor Lookups"
Cohesion: 0.16
Nodes (25): ClientFormContent(), ClientModal(), ClientModalProps, AlertTitle, ClientPageFilter, createClientApi(), deactivateClientApi(), fetchClientsApi() (+17 more)

### Community 6 - "Integration Test Dependencies"
Cohesion: 0.13
Nodes (11): mount(), mount(), mount(), { mutateAsync }, mount(), state, ServerTable(), mount() (+3 more)

### Community 7 - "Management Lists and Pagination"
Cohesion: 0.16
Nodes (29): ClientList(), auth, RecordFixture, surfaces, ArchiveCheck, summarizeWarehouseStock(), WarehouseList(), WarehouseStockSummary (+21 more)

### Community 8 - "Order Entry and Pricing"
Cohesion: 0.16
Nodes (25): useSalesOrderEntry(), fetchLatestDraft(), reloadLatestDraft(), submit(), buildSalesOrderDraftPayload(), salesDraftLines(), usePurchaseOrderEntry(), draftLines() (+17 more)

### Community 9 - "InventoryItemCatalog.tsx"
Cohesion: 0.21
Nodes (17): InventoryItemCatalog(), InventoryItemCatalogProps, ProductLocations(), StockIndicator(), StockPagingControls(), StockPagingControlsProps, columns, useStockItemByPair() (+9 more)

### Community 10 - "Staffing Mutations"
Cohesion: 0.06
Nodes (65): assignEmployeeJobApi(), createEmployeeApi(), createJobApi(), deactivateEmployeeApi(), deactivateJobApi(), deactivateUserApi(), EmployeeFilter, fetchEmployeeJobsByEmployeeApi() (+57 more)

### Community 11 - "Order Forms and Discounts"
Cohesion: 0.09
Nodes (41): clients, Launcher(), products, purchaseProps, salesProps, stocks, suppliers, timestamps (+33 more)

### Community 12 - "Purchase Pricing and Suppliers"
Cohesion: 0.10
Nodes (34): LineInput(), Props, PurchaseItemsTable(), currency(), Props, PurchaseOrdersTable(), PurchaseOrderStatusBadge(), PURCHASE_ORDER_STATUS (+26 more)

### Community 13 - "Dashboard Cards and Boundaries"
Cohesion: 0.20
Nodes (19): AuthCard(), handleLoginSubmit(), AuthCardProps, Props, State, ExecutiveDashboard(), POPULAR_PURCHASES, PurchaseItem (+11 more)

### Community 14 - "Delivery Details and Utilities"
Cohesion: 0.09
Nodes (18): DeliveryStatusBadge(), DeliveryStatusBadgeProps, DeliveryTimeline(), VehicleStatusBadgeProps, DeliveryRunMember, DeliveryUtils, VehicleCondition, VehicleStatus (+10 more)

### Community 15 - "sales-orders.hooks.ts"
Cohesion: 0.14
Nodes (25): cancelSalesOrderApi(), confirmSalesOrderApi(), createSalesOrderApi(), fetchSalesOrderByNumberApi(), fetchSalesOrdersApi(), fetchSalesOrdersPageApi(), isStaleSalesOrderRevision(), updateSalesOrderDraftApi() (+17 more)

### Community 16 - "ref_axios"
Cohesion: 0.08
Nodes (13): mount(), mount(), orders, warehouses, mount(), product, stock, draft (+5 more)

### Community 17 - "api-contracts.component.test.tsx"
Cohesion: 0.22
Nodes (8): creations, lookups, fetchEmployeeByEmailApi(), fetchEmployeeJobApi(), fetchJobByNameApi(), fetchUserByEmailApi(), fetchUserByIdApi(), useUserByEmail()

### Community 18 - "Outgoing Balances and Quantities"
Cohesion: 0.12
Nodes (28): formatQuantity(), addProduct(), line, deliveryQuantityError(), remainingDeliveryQuantity(), sumDeliveryQuantities(), incomingOrderRemainingQuantity(), OutgoingDeliveryLineCommand (+20 more)

### Community 19 - "Suppliers and Purchase Receipts"
Cohesion: 0.20
Nodes (17): createSupplierApi(), deleteSupplierApi(), fetchSupplierByCodeApi(), fetchSupplierByIdApi(), fetchSuppliersApi(), reactivateSupplierApi(), updateSupplierApi(), SUPPLIERS_QUERY_KEY (+9 more)

### Community 20 - "Delivery Vehicles API"
Cohesion: 0.12
Nodes (28): createVehicleApi(), deactivateVehicleApi(), fetchAvailableVehiclesApi(), fetchDeliveryVehiclesApi(), fetchVehicleByPlateNumberApi(), reactivateVehicleApi(), updateVehicleDetailsApi(), updateVehicleStatusApi() (+20 more)

### Community 21 - "Authentication and Roles"
Cohesion: 0.15
Nodes (25): submitLogin(), submitSignup(), RoleBadgeProps, getProfileApi(), loginApi(), registerApi(), AuthRequest, AuthTokensResponse (+17 more)

### Community 22 - "use-incoming-receiving.ts"
Cohesion: 0.11
Nodes (32): cancelIncomingDeliveryApi(), completeIncomingDeliveryApi(), createIncomingDeliveryApi(), fetchIncomingDeliveryByIdApi(), fetchIncomingDeliveryByNumberApi(), scheduleIncomingDeliveryApi(), INCOMING_DELIVERIES_QUERY_KEY, useCompleteIncomingDelivery() (+24 more)

### Community 23 - "Outgoing Deliveries API"
Cohesion: 0.12
Nodes (36): cancelOutgoingDeliveryApi(), createOutgoingDeliveryApi(), createOutgoingDeliveryDraftApi(), fetchOutgoingDeliveryByIdApi(), fetchOutgoingDeliveryByNumberApi(), fetchOutgoingPlanningOptionsApi(), readyOutgoingDeliveryApi(), reopenOutgoingDeliveryApi() (+28 more)

### Community 24 - "DashboardLayout.tsx"
Cohesion: 0.12
Nodes (21): DashboardOutletContext, MainDashboard(), DashboardLayout(), DashboardLayoutProps, NAV_GROUPS, NavGroup, DeliveryNavigation(), links (+13 more)

### Community 25 - "useAuth"
Cohesion: 0.20
Nodes (19): InventoryHub(), useAuth(), isNavItemKey(), ROUTES, AppRoutes(), DashboardNotFound(), DefaultRoute(), DeliveriesRoute() (+11 more)

### Community 26 - "Outgoing Completion Workflow"
Cohesion: 0.14
Nodes (22): useSalesOrderById(), useSalesOrders(), useAllDeliveryVehicles(), buildDeliveryRows(), useIncomingDeliveries(), blankReconciliation(), CompletionRow, outgoingCompletionRows() (+14 more)

### Community 27 - "Stock Items and Precision"
Cohesion: 0.16
Nodes (21): FlatWarehouseStockItem, createStockAdjustmentApi(), createStockItemApi(), deleteStockItemApi(), fetchStockByItemApi(), fetchStockItemsApi(), setReorderThresholdApi(), StockPageFilter (+13 more)

### Community 28 - "purchase-orders.types.ts"
Cohesion: 0.13
Nodes (27): cancelPurchaseOrderApi(), confirmPurchaseOrderApi(), createPurchaseOrderApi(), fetchPurchaseOrderByIdApi(), fetchPurchaseOrderByNumberApi(), fetchPurchaseOrdersApi(), fetchPurchaseOrdersPageApi(), updatePurchaseOrderDraftApi() (+19 more)

### Community 29 - "Products and Wholesale Pricing"
Cohesion: 0.24
Nodes (14): createProductApi(), deactivateProductApi(), fetchProductByNameApi(), fetchProductsApi(), priceValue(), reactivateProductApi(), updateProductDetailsApi(), updateProductPriceApi() (+6 more)

### Community 30 - "Quarantine API and Contracts"
Cohesion: 0.20
Nodes (20): correctQuarantineConditionApi(), createManualQuarantineApi(), fetchQuarantineLotApi(), resolveQuarantineApi(), validateRevision(), QUARANTINE_QUERY_KEY, refreshStockConditionQueries(), useCorrectQuarantineCondition() (+12 more)

### Community 31 - "use-stock-notification-records.ts"
Cohesion: 0.52
Nodes (4): buildStockAlerts(), useStockAlerts(), useStockWarnings(), useStockNotificationRecords()

### Community 32 - "Delivery Hub Workflow"
Cohesion: 0.17
Nodes (24): mount(), DeliveriesHub(), DeliveriesHubProps, DeliverySubTab, purchaseOrderStatusLabels, actions, DeliveryTable(), IncomingDeliveryDetailModal() (+16 more)

### Community 33 - "PurchasesView.tsx"
Cohesion: 0.19
Nodes (10): PurchaseSection, purchaseStatusBadgeClassNames, PurchasesViewProps, PurchaseTabFilter, ArchiveTabNavProps, ArchiveTabType, StatusTab, StatusTabAccent (+2 more)

### Community 34 - "Warehouse API and Hooks"
Cohesion: 0.19
Nodes (18): QuickDispatchModalProps, createWarehouseApi(), deactivateWarehouseApi(), fetchWarehouseByNameApi(), fetchWarehousesApi(), reactivateWarehouseApi(), updateWarehouseDetailsApi(), useCreateWarehouse() (+10 more)

### Community 35 - "Application Bootstrap and Errors"
Cohesion: 0.15
Nodes (8): App(), AppContent(), queryClient, ErrorBoundary, Toaster(), ToasterProps, AuthMode, mount()

### Community 36 - "Stock Display and Dispatch"
Cohesion: 0.30
Nodes (10): buildDispatchPlan(), DispatchPlanRow, validateDispatchLoad(), saveError(), thresholdChanged(), ThresholdDraft, thresholdError(), useStockAlertEditors() (+2 more)

### Community 37 - "purchase-receipt.ts"
Cohesion: 0.24
Nodes (11): documentText(), item, order, product, supplier, createPdf(), exportPurchaseReceiptPdf(), line() (+3 more)

### Community 38 - "Delivery Confirmation Tests"
Cohesion: 0.18
Nodes (9): departure(), dispatchValue(), incoming, outgoing, overrideGet(), receiptAuth, reconcile(), setupDispatch() (+1 more)

### Community 39 - "Order Delivery Workflow Tests"
Cohesion: 0.17
Nodes (8): auth, line, mount(), mountDashboard(), orderDates, purchaseFixture, salesFixture, stamps

### Community 40 - "Outgoing Scheduling Tests"
Cohesion: 0.18
Nodes (7): dates, finishHubSchedule(), mount(), mountHub(), quantity(), selectWarehouse(), ScheduleDeliveryModal()

### Community 41 - "Quarantine Lot Action Tests"
Cohesion: 0.18
Nodes (10): auth, lot, setup(), tag(), auth, chooseAction(), correction(), mount() (+2 more)

### Community 42 - "Stock Alert Contract Tests"
Cohesion: 0.17
Nodes (7): auth, dates, products, warehouses, failure(), lists, response()

### Community 43 - "Quarantine Tag Coordination"
Cohesion: 0.19
Nodes (15): fetchQuarantineLotsApi(), useCreateManualQuarantine, useQuarantineConditionChanges(), useQuarantineLots(), useQuarantineResolutions(), useRefreshQuarantine(), CreateManualQuarantinePayload, useItemStock() (+7 more)

### Community 44 - "Inventory Notification Tests"
Cohesion: 0.18
Nodes (8): auth, dates, mount(), mountDashboard(), Movements(), stock(), stockResponse(), warehouses

### Community 45 - "OrderLineDiscount.tsx"
Cohesion: 0.38
Nodes (8): Editor(), OrderLineAmounts(), OrderLineDiscount(), LineDiscount, orderLineTotals(), PricedOrderLine, savedOrderTotals(), sumLineAmounts()

### Community 46 - "Stock Status Badges"
Cohesion: 0.29
Nodes (8): StockBalanceSummary(), StockStatusBadge(), BadgeProps, dots, StatusBadge(), StatusBadgeProps, StatusBadgeTone, tones

### Community 47 - "incoming-receiving.component.test.tsx"
Cohesion: 0.20
Nodes (5): auth, dates, Integration(), mount(), order()

### Community 48 - "OutgoingDeliveryRecord"
Cohesion: 0.13
Nodes (18): deliveryFixture, mount(), orderFixture, runFixture, stamps, auth, button(), choose() (+10 more)

### Community 49 - "Outgoing Dispatch Tests"
Cohesion: 0.33
Nodes (8): auth, button(), fill(), loaded(), mount(), ready(), submit(), weight()

### Community 50 - "quarantine.component.test.tsx"
Cohesion: 0.29
Nodes (5): auth, baseLot, baseStock, httpError(), mount()

### Community 51 - "Quarantine Selector Tests"
Cohesion: 0.25
Nodes (3): mount(), stock, warehouses

### Community 52 - "Order Selector Pagination Tests"
Cohesion: 0.29
Nodes (5): chooseParty(), dates, parties, partyButton(), products

### Community 53 - "stock-display.ts"
Cohesion: 0.30
Nodes (10): ProductPickerOption(), OrderProductCatalog(), PagedOrderProductCatalog(), OrderDetailDrawerProps, availableStockCents(), stockSortKey(), StockItem, buildCatalogStockMap() (+2 more)

### Community 54 - "Sales Order Draft Tests"
Cohesion: 0.29
Nodes (5): clients, draft, products, setup(), timestamps

### Community 55 - "Sales Delivery Presentation"
Cohesion: 0.43
Nodes (5): formatDeliveryDate(), getSalesOrderDeliveryDisplay(), salesDeliveryProgress(), delivery, order

### Community 56 - "Stock Condition Report Tests"
Cohesion: 0.40
Nodes (4): cacheWarehouses(), setup(), stock, update()

### Community 57 - "Warehouse Management Tests"
Cohesion: 0.40
Nodes (4): change(), fillProduct(), warehouse, WarehouseModal()

### Community 58 - "UnifiedNavbar.tsx"
Cohesion: 0.25
Nodes (7): ArchiveNoticeBanner(), ArchiveNoticeBannerProps, NavBadgeVariant, NavTabGroup, NavTabItem, UnifiedNavbar(), UnifiedNavbarProps

### Community 59 - "OrdersView.tsx"
Cohesion: 0.16
Nodes (15): fillComposer(), VehicleStatusBadge(), VehicleList(), VehicleRow, getSalesOrderPrimaryAction(), OrdersView(), OrdersViewProps, OrderTabFilter (+7 more)

### Community 60 - "stock-alerts.test.mjs"
Cohesion: 0.33
Nodes (3): product(), products, warehouses

### Community 61 - "api-client.ts"
Cohesion: 0.12
Nodes (9): surfaces, auth, scope, ApiErrorBody, ApiIssue, formatErrorDetails(), humanizeErrorMessage(), IncludeInactive (+1 more)

### Community 63 - "Hero Illustration Layers"
Cohesion: 0.67
Nodes (3): Layered Hero Illustration, Lower Purple Layer, Upper Outlined Layer

## Knowledge Gaps
- **4 isolated node(s):** `React SVG logo`, `Vite Logo SVG`, `Lower Purple Layer`, `Upper Outlined Layer`
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 382 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **7 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `getErrorMessage()` connect `Delivery Forms and Errors` to `FinancialReportsPage.tsx`, `Delivery Runs and Dispatch`, `ref_lucide_react`, `Customers and Cursor Lookups`, `Management Lists and Pagination`, `Order Entry and Pricing`, `InventoryItemCatalog.tsx`, `Staffing Mutations`, `Purchase Pricing and Suppliers`, `Dashboard Cards and Boundaries`, `sales-orders.hooks.ts`, `Suppliers and Purchase Receipts`, `Delivery Vehicles API`, `Authentication and Roles`, `use-incoming-receiving.ts`, `Outgoing Deliveries API`, `Outgoing Completion Workflow`, `Stock Items and Precision`, `purchase-orders.types.ts`, `Products and Wholesale Pricing`, `Delivery Hub Workflow`, `PurchasesView.tsx`, `Warehouse API and Hooks`, `Stock Display and Dispatch`, `Stock Alert Contract Tests`, `Quarantine Tag Coordination`, `OutgoingDeliveryRecord`, `stock-display.ts`, `OrdersView.tsx`, `api-client.ts`?**
  _High betweenness centrality (0.128) - this node is a cross-community bridge._
- **What connects `React SVG logo`, `Vite Logo SVG`, `Lower Purple Layer` to the rest of the system?**
  _4 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Delivery Forms and Errors` be split into smaller, more focused modules?**
  _Cohesion score 0.059028575806328046 - nodes in this community are weakly interconnected._
- **Why does `Button` connect `Delivery Forms and Errors` to `Delivery Hub Workflow`, `FinancialReportsPage.tsx`, `PurchasesView.tsx`, `ref_lucide_react`, `Shared Tables and Navigation`, `Customers and Cursor Lookups`, `Management Lists and Pagination`, `Outgoing Scheduling Tests`, `InventoryItemCatalog.tsx`, `Order Forms and Discounts`, `Purchase Pricing and Suppliers`, `Dashboard Cards and Boundaries`, `OrderLineDiscount.tsx`, `stock-display.ts`, `DashboardLayout.tsx`, `useAuth`, `UnifiedNavbar.tsx`, `OrdersView.tsx`?**
  _High betweenness centrality (0.043) - this node is a cross-community bridge._
- **Should `FinancialReportsPage.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.0579047619047619 - nodes in this community are weakly interconnected._
- **Why does `apiClient` connect `Integration Test Dependencies` to `Delivery Forms and Errors`, `FinancialReportsPage.tsx`, `Delivery Runs and Dispatch`, `Customers and Cursor Lookups`, `Management Lists and Pagination`, `Staffing Mutations`, `Order Forms and Discounts`, `sales-orders.hooks.ts`, `ref_axios`, `api-contracts.component.test.tsx`, `Suppliers and Purchase Receipts`, `Delivery Vehicles API`, `Authentication and Roles`, `use-incoming-receiving.ts`, `Outgoing Deliveries API`, `useAuth`, `Stock Items and Precision`, `purchase-orders.types.ts`, `Products and Wholesale Pricing`, `Quarantine API and Contracts`, `Warehouse API and Hooks`, `Delivery Confirmation Tests`, `Order Delivery Workflow Tests`, `Outgoing Scheduling Tests`, `Quarantine Lot Action Tests`, `Stock Alert Contract Tests`, `Inventory Notification Tests`, `incoming-receiving.component.test.tsx`, `OutgoingDeliveryRecord`, `Outgoing Dispatch Tests`, `quarantine.component.test.tsx`, `Quarantine Selector Tests`, `Order Selector Pagination Tests`, `Sales Order Draft Tests`, `Stock Condition Report Tests`, `Warehouse Management Tests`, `OrdersView.tsx`, `api-client.ts`, `vehicle-modal.component.test.tsx`?**
  _High betweenness centrality (0.023) - this node is a cross-community bridge._
- **Should `Delivery Runs and Dispatch` be split into smaller, more focused modules?**
  _Cohesion score 0.07229832572298325 - nodes in this community are weakly interconnected._