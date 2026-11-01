# Graph Report - src  (2026-11-01)

## Corpus Check
- 323 files · ~198,066 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 3 file(s) not represented in the graph (top: .css 3)

## Summary
- 1668 nodes · 8676 edges · 68 communities (60 shown, 8 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 79 edges (avg confidence: 0.85)
- Recorded external API tokens: 0 input · 0 output; host-agent token usage unavailable.

## Community Hubs (Navigation)
- Delivery Forms and Errors
- Dashboard Routing and Reports
- Delivery Runs and Dispatch
- Dashboard Actions and Menus
- Shared Tables and Navigation
- Customers and Cursor Lookups
- Integration Test Dependencies
- Management Lists and Pagination
- Order Entry and Pricing
- Inventory Catalog and Stock
- Staffing Mutations
- Order Forms and Discounts
- Purchase Pricing and Suppliers
- Dashboard Cards and Boundaries
- Delivery Details and Utilities
- Sales Order Contracts
- API Error Handling Tests
- Staffing Contracts and API
- Outgoing Balances and Quantities
- Suppliers and Purchase Receipts
- Delivery Vehicles API
- Authentication and Roles
- Incoming Deliveries API
- Outgoing Deliveries API
- Delivery and Purchase Tables
- Purchase Scheduling and Presentation
- Outgoing Completion Workflow
- Stock Items and Precision
- Order Query Mutations
- Products and Wholesale Pricing
- Quarantine API and Contracts
- Stock Alerts and Warnings
- Delivery Hub Workflow
- Outgoing Delivery Planning
- Warehouse API and Hooks
- Application Bootstrap and Errors
- Stock Display and Dispatch
- Incoming Receiving Workflow
- Delivery Confirmation Tests
- Order Delivery Workflow Tests
- Outgoing Scheduling Tests
- Quarantine Lot Action Tests
- Stock Alert Contract Tests
- Quarantine Tag Coordination
- Inventory Notification Tests
- Vehicle Assignment Rules
- Stock Status Badges
- Order Composer Tests
- Outgoing Completion Tests
- Outgoing Dispatch Tests
- Master Data Contract Tests
- Quarantine Selector Tests
- Order Selector Pagination Tests
- Quick Dispatch Contracts
- Sales Order Draft Tests
- Sales Delivery Presentation
- Stock Condition Report Tests
- Warehouse Management Tests
- Stock Adjustment Tests
- Order List Pagination Tests
- Inventory Master Paging Tests
- Hero Illustration Layers
- React Logo Asset
- Vite Logo Asset

## God Nodes (most connected - your core abstractions)
1. `getErrorMessage()` - 208 edges
2. `Button` - 167 edges
3. `cn()` - 110 edges
4. `parseStockCents()` - 103 edges
5. `Input` - 101 edges
6. `DataTable()` - 93 edges
7. `Alert` - 83 edges
8. `AlertDescription` - 81 edges
9. `DialogContent` - 73 edges
10. `DialogTitle` - 72 edges

## Surprising Connections (you probably didn't know these)
- `stock()` --calls--> `parseStockCents()`  [EXTRACTED]
  components/inventory/inventory-notifications.component.test.tsx → features/logistics/stock-display.ts
- `confirm()` --calls--> `getErrorMessage()`  [EXTRACTED]
  components/purchases/PurchaseOrderDetailModal.tsx → lib/api-client.ts
- `submit()` --calls--> `getErrorMessage()`  [EXTRACTED]
  features/logistics/use-outgoing-completion.ts → lib/api-client.ts
- `fetchEmployeeJobsByJobApi()` --calls--> `extractArray()`  [EXTRACTED]
  features/staffing/staffing.api.ts → lib/api-client.ts
- `AppContent()` --calls--> `AuthCard()`  [EXTRACTED]
  App.tsx → components/auth/AuthCard.tsx

## Import Cycles
- None detected.

## Communities (68 total, 8 thin omitted)

### Community 0 - "Delivery Forms and Errors"
Cohesion: 0.06
Nodes (139): AccountProfileModal(), AccountProfileModalProps, handleLoginSubmit(), LoginForm(), LoginFormProps, useFormValidation(), DeliveryFilter(), dateText() (+131 more)

### Community 1 - "Dashboard Routing and Reports"
Cohesion: 0.08
Nodes (54): DashboardOutletContext, MainDashboard(), Details(), FinancialReportsPage(), labels, ReportSession(), Results(), tabs (+46 more)

### Community 2 - "Delivery Runs and Dispatch"
Cohesion: 0.08
Nodes (57): fetchClientByIdApi(), fetchSalesOrderByIdApi(), cancelDeliveryRunApi(), cancelRunMemberApi(), changeRunMembersApi(), createDeliveryRunApi(), decimal(), dispatchDeliveryRunApi() (+49 more)

### Community 3 - "Dashboard Actions and Menus"
Cohesion: 0.10
Nodes (37): InventoryItemCatalogProps, DashboardLayout(), DashboardLayoutProps, NAV_GROUPS, NavGroup, DeliveryNavigation(), links, StockNotifications() (+29 more)

### Community 4 - "Shared Tables and Navigation"
Cohesion: 0.07
Nodes (40): OrderSummary(), OrderSummaryProps, CellContext, ColumnAlign, DataTable(), DataTableProps, getAlignmentClass(), getCellValue() (+32 more)

### Community 5 - "Customers and Cursor Lookups"
Cohesion: 0.10
Nodes (37): ClientList(), ClientFormContent(), ClientModal(), ClientModalProps, mount(), mount(), AlertTitle, ClientPageFilter (+29 more)

### Community 6 - "Integration Test Dependencies"
Cohesion: 0.12
Nodes (13): mount(), state, mount(), { mutateAsync }, mount(), state, ServerTable(), StockWarning (+5 more)

### Community 7 - "Management Lists and Pagination"
Cohesion: 0.17
Nodes (31): VehicleList(), ArchiveCheck, summarizeWarehouseStock(), WarehouseList(), WarehouseStockSummary, WarehouseProducts(), ProductListModal(), ProductListModalProps (+23 more)

### Community 8 - "Order Entry and Pricing"
Cohesion: 0.16
Nodes (30): useSalesOrderEntry(), fetchLatestDraft(), submit(), isStaleSalesOrderRevision(), usePurchaseOrderEntry(), draftLines(), fetchLatestDraft(), reloadLatestDraft() (+22 more)

### Community 9 - "Inventory Catalog and Stock"
Cohesion: 0.16
Nodes (29): InventoryHub(), InventoryItemCatalog(), ProductLocations(), StockIndicator(), StockPagingControls(), StockPagingControlsProps, InventoryItemModal(), InventoryStockList() (+21 more)

### Community 10 - "Staffing Mutations"
Cohesion: 0.08
Nodes (38): assignEmployeeJobApi(), deactivateEmployeeApi(), deactivateJobApi(), deactivateUserApi(), fetchEmployeesForJobApi, fetchJobsApi(), fetchJobsForEmployeeApi, fetchUsersApi() (+30 more)

### Community 11 - "Order Forms and Discounts"
Cohesion: 0.14
Nodes (29): DeliveryQuantityRow, DeliveryQuantityTable(), Editor(), mount(), OrderAdditionalDetails(), OrderDecimalInput, OrderField(), ProductIdentity() (+21 more)

### Community 12 - "Purchase Pricing and Suppliers"
Cohesion: 0.13
Nodes (27): LineInput(), Props, PurchaseItemsTable(), currency(), Props, PurchaseOrderDetailModal(), confirm(), formatPurchaseMoney() (+19 more)

### Community 13 - "Dashboard Cards and Boundaries"
Cohesion: 0.14
Nodes (24): AuthCard(), AuthCardProps, Props, State, ExecutiveDashboard(), POPULAR_PURCHASES, PurchaseItem, RECENT_TRANSACTIONS (+16 more)

### Community 14 - "Delivery Details and Utilities"
Cohesion: 0.10
Nodes (18): deliveryFixture, mount(), orderFixture, runFixture, stamps, DeliveryDetailField(), DeliveryDetailModalProps, DeliveryStatusBadgeProps (+10 more)

### Community 15 - "Sales Order Contracts"
Cohesion: 0.10
Nodes (30): reloadLatestDraft(), EditableSalesOrder, OrderFormValues, SalesOrderDraftProps, SalesOrderFormLine, buildSalesOrderDraftPayload(), buildSalesOrderPayload(), salesDraftLines() (+22 more)

### Community 16 - "API Error Handling Tests"
Cohesion: 0.07
Nodes (21): orders, warehouses, auth, baseLot, baseStock, httpError(), mount(), mount() (+13 more)

### Community 17 - "Staffing Contracts and API"
Cohesion: 0.08
Nodes (30): creations, lookups, createEmployeeApi(), createJobApi(), EmployeeFilter, fetchEmployeeByEmailApi(), fetchEmployeeJobApi(), fetchEmployeeJobsByEmployeeApi() (+22 more)

### Community 18 - "Outgoing Balances and Quantities"
Cohesion: 0.15
Nodes (21): addProduct(), line, deliveryQuantityError(), remainingDeliveryQuantity(), sumDeliveryQuantities(), OutgoingDeliveryLineCommand, canPrepareOutgoing(), OutgoingItemBalance (+13 more)

### Community 19 - "Suppliers and Purchase Receipts"
Cohesion: 0.12
Nodes (27): createSupplierApi(), deleteSupplierApi(), fetchSupplierByCodeApi(), fetchSupplierByIdApi(), fetchSuppliersApi(), reactivateSupplierApi(), updateSupplierApi(), SUPPLIERS_QUERY_KEY (+19 more)

### Community 20 - "Delivery Vehicles API"
Cohesion: 0.12
Nodes (24): mount(), VehicleModal(), createVehicleApi(), deactivateVehicleApi(), fetchAvailableVehiclesApi(), fetchDeliveryVehiclesApi(), fetchVehicleByPlateNumberApi(), reactivateVehicleApi() (+16 more)

### Community 21 - "Authentication and Roles"
Cohesion: 0.15
Nodes (25): submitLogin(), submitSignup(), RoleBadgeProps, getProfileApi(), loginApi(), registerApi(), AuthRequest, AuthTokensResponse (+17 more)

### Community 22 - "Incoming Deliveries API"
Cohesion: 0.12
Nodes (20): auth, dates, mount(), cancelIncomingDeliveryApi(), completeIncomingDeliveryApi(), createIncomingDeliveryApi(), fetchIncomingDeliveriesApi(), fetchIncomingDeliveryByIdApi() (+12 more)

### Community 23 - "Outgoing Deliveries API"
Cohesion: 0.14
Nodes (26): cancelOutgoingDeliveryApi(), createOutgoingDeliveryApi(), createOutgoingDeliveryDraftApi(), fetchOutgoingDeliveryByNumberApi(), fetchOutgoingPlanningOptionsApi(), readyOutgoingDeliveryApi(), reopenOutgoingDeliveryApi(), updateOutgoingDeliveryDraftApi() (+18 more)

### Community 24 - "Delivery and Purchase Tables"
Cohesion: 0.16
Nodes (19): actions, DeliveryTable(), DeliveryStatusBadge(), IncomingDeliveryStatusBadge(), SalesOrderProgress(), Props, PurchaseOrdersTable(), PurchaseOrderStatusBadge() (+11 more)

### Community 25 - "Purchase Scheduling and Presentation"
Cohesion: 0.14
Nodes (19): mount(), ScheduleIncomingDeliveryModal(), ScheduleIncomingDeliveryModalProps, DeliveryFormFooter(), incomingOrderRemainingQuantity(), usePurchaseOrderById(), PURCHASE_ORDER_STATUS, purchaseReceivingProgress() (+11 more)

### Community 26 - "Outgoing Completion Workflow"
Cohesion: 0.16
Nodes (20): useSalesOrderById(), useAllDeliveryVehicles(), useIncomingDeliveries(), blankReconciliation(), CompletionRow, outgoingCompletionRows(), ReconciliationDraft, ReconciliationField (+12 more)

### Community 27 - "Stock Items and Precision"
Cohesion: 0.19
Nodes (19): FlatWarehouseStockItem, createStockAdjustmentApi(), createStockItemApi(), deleteStockItemApi(), fetchStockItemByIdApi(), setReorderThresholdApi(), StockPageFilter, useDeleteStockItem() (+11 more)

### Community 28 - "Order Query Mutations"
Cohesion: 0.12
Nodes (18): cancelSalesOrderApi(), confirmSalesOrderApi(), fetchSalesOrderByNumberApi(), fetchSalesOrdersApi(), SALES_ORDERS_QUERY_KEY, useSalesOrderByNumber(), useSalesOrders(), cancelPurchaseOrderApi() (+10 more)

### Community 29 - "Products and Wholesale Pricing"
Cohesion: 0.21
Nodes (17): InventoryWholesalePrice(), finishEditing(), savePrice(), createProductApi(), deactivateProductApi(), fetchProductByNameApi(), fetchProductsApi(), priceValue() (+9 more)

### Community 30 - "Quarantine API and Contracts"
Cohesion: 0.22
Nodes (18): correctQuarantineConditionApi(), createManualQuarantineApi(), resolveQuarantineApi(), validateRevision(), QUARANTINE_QUERY_KEY, refreshStockConditionQueries(), useCorrectQuarantineCondition(), useManualQuarantineTag() (+10 more)

### Community 31 - "Stock Alerts and Warnings"
Cohesion: 0.15
Nodes (12): buildStockAlerts(), useStockAlerts(), product(), products, warehouses, buildStockWarnings(), useStockWarnings(), InventoryFocusTarget (+4 more)

### Community 32 - "Delivery Hub Workflow"
Cohesion: 0.23
Nodes (16): mount(), DeliveriesHub(), DeliveriesHubProps, DeliverySubTab, purchaseOrderStatusLabels, IncomingDeliveryDetailModal(), buildDeliveryRows(), DELIVERY_STATUS_LABELS (+8 more)

### Community 33 - "Outgoing Delivery Planning"
Cohesion: 0.26
Nodes (16): formatQuantity(), OutgoingPlanningForm(), ScheduleDeliveryModal(), ScheduleDeliveryModalProps, fetchOutgoingDeliveryByIdApi(), useOutgoingDeliveryById(), OutgoingDeliveryRecord, outgoingOrderRemaining() (+8 more)

### Community 34 - "Warehouse API and Hooks"
Cohesion: 0.19
Nodes (16): fetchOutgoingDeliveriesApi(), fetchStockByItemApi(), fetchStockItemsApi(), createWarehouseApi(), deactivateWarehouseApi(), fetchWarehouseByNameApi(), fetchWarehousesApi(), reactivateWarehouseApi() (+8 more)

### Community 35 - "Application Bootstrap and Errors"
Cohesion: 0.15
Nodes (8): App(), AppContent(), queryClient, ErrorBoundary, Toaster(), ToasterProps, AuthMode, mount()

### Community 36 - "Stock Display and Dispatch"
Cohesion: 0.24
Nodes (12): buildDispatchPlan(), DispatchPlanRow, validateDispatchLoad(), saveError(), thresholdChanged(), ThresholdDraft, thresholdError(), useStockAlertEditors() (+4 more)

### Community 37 - "Incoming Receiving Workflow"
Cohesion: 0.25
Nodes (14): useCompleteIncomingDelivery(), useIncomingDeliveryById(), CompleteIncomingDeliveryPayload, IncomingReceiptCounts, incomingReceiptLines(), validateIncomingReceipt(), setup(), ReceiptOutcome (+6 more)

### Community 38 - "Delivery Confirmation Tests"
Cohesion: 0.18
Nodes (9): departure(), dispatchValue(), incoming, outgoing, overrideGet(), receiptAuth, reconcile(), setupDispatch() (+1 more)

### Community 39 - "Order Delivery Workflow Tests"
Cohesion: 0.16
Nodes (9): auth, fillComposer(), line, mount(), mountDashboard(), orderDates, purchaseFixture, salesFixture (+1 more)

### Community 40 - "Outgoing Scheduling Tests"
Cohesion: 0.16
Nodes (7): dates, finishHubSchedule(), mount(), mountHub(), order(), quantity(), selectWarehouse()

### Community 41 - "Quarantine Lot Action Tests"
Cohesion: 0.18
Nodes (10): auth, lot, setup(), tag(), auth, chooseAction(), correction(), mount() (+2 more)

### Community 42 - "Stock Alert Contract Tests"
Cohesion: 0.15
Nodes (8): auth, dates, products, warehouses, fetchPurchaseOrdersApi(), failure(), lists, response()

### Community 43 - "Quarantine Tag Coordination"
Cohesion: 0.23
Nodes (13): fetchQuarantineLotsApi(), useCreateManualQuarantine, useQuarantineLots(), useRefreshQuarantine(), CreateManualQuarantinePayload, useItemStock(), useWarehouseStock(), useQuarantineTag() (+5 more)

### Community 44 - "Inventory Notification Tests"
Cohesion: 0.18
Nodes (8): auth, dates, mount(), mountDashboard(), Movements(), stock(), stockResponse(), warehouses

### Community 45 - "Vehicle Assignment Rules"
Cohesion: 0.26
Nodes (10): VehicleCondition, ACTIVE_ASSIGNMENT_STATUSES, getVehicleAssignments(), getVehicleAvailabilityStatus(), getVehicleCondition(), isActiveDeliveryStatus(), delivery, vehicle (+2 more)

### Community 46 - "Stock Status Badges"
Cohesion: 0.29
Nodes (8): StockBalanceSummary(), StockStatusBadge(), BadgeProps, dots, StatusBadge(), StatusBadgeProps, StatusBadgeTone, tones

### Community 47 - "Order Composer Tests"
Cohesion: 0.20
Nodes (9): clients, Launcher(), products, purchaseProps, salesProps, stocks, suppliers, timestamps (+1 more)

### Community 48 - "Outgoing Completion Tests"
Cohesion: 0.31
Nodes (8): auth, button(), choose(), dates, fill(), input(), mount(), submit()

### Community 49 - "Outgoing Dispatch Tests"
Cohesion: 0.33
Nodes (8): auth, button(), fill(), loaded(), mount(), ready(), submit(), weight()

### Community 50 - "Master Data Contract Tests"
Cohesion: 0.19
Nodes (6): auth, RecordFixture, surfaces, dispatch, member, reconcile

### Community 51 - "Quarantine Selector Tests"
Cohesion: 0.25
Nodes (3): mount(), stock, warehouses

### Community 52 - "Order Selector Pagination Tests"
Cohesion: 0.29
Nodes (5): chooseParty(), dates, parties, partyButton(), products

### Community 53 - "Quick Dispatch Contracts"
Cohesion: 0.62
Nodes (6): OrderDetailDrawerProps, QuickDispatchModalProps, SalesOrderRecord, DeliveryVehicle, Warehouse, Employee

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

### Community 58 - "Stock Adjustment Tests"
Cohesion: 0.50
Nodes (4): mount(), product, stock, StockAdjustModal()

### Community 63 - "Hero Illustration Layers"
Cohesion: 0.67
Nodes (3): Layered Hero Illustration, Lower Purple Layer, Upper Outlined Layer

## Knowledge Gaps
- **4 isolated node(s):** `Upper Outlined Layer`, `Lower Purple Layer`, `React SVG logo`, `Vite Logo SVG`
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 363 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **8 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions

- Why does `getErrorMessage()` bridge forms, reports, delivery workflows, and order entry?
- How does `parseStockCents()` connect inventory, purchasing, and delivery quantities?
- Should `Delivery Forms and Errors` be split into smaller modules? Its cohesion is 0.0554683411826269.

## Extraction Limitations

- Scope: frontend/src only; 323 detected files (320 code, 3 images). CSS files are not modeled by this extractor.
- AST parser reported a syntax-error region at line 17 of components/inventory/quarantine-lot.component.test.tsx; seven symbols were extracted, so coverage may be partial. This is an extractor diagnostic, not a TypeScript compiler result.
- 31 code files yielded no modeled symbols. features/financial-reports/report-test-fixtures.json was skipped by the code extractor.
- React and Vite SVG source was inspected completely, but rendered vision verification was unavailable. The PNG hero illustration was visually inspected.
- Graph health: 118 dangling-endpoint relationships and 240 same-endpoint relationship collapses in the undirected export. Raw extraction health details are preserved in health.json; these counts are not application defects.
- Recorded external API extraction tokens: 0 input / 0 output. Host-session and image-agent token usage was not exposed by the tools and is unknown; zero recorded API tokens does not mean zero session cost.
- graphify-out/ was written into the frontend working tree. Unless ignored, it appears in git status; outputs can be ignored or selectively committed according to team needs.
