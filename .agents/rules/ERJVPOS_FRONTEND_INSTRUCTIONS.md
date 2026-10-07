# ERJVPOS Frontend Engineering Instructions

## Purpose

This file defines the frontend engineering rules for ERJVPOS.

The goal is to keep the frontend:

- compartmentalized
- reusable
- easy to debug
- easy to maintain
- easy to extend
- consistent
- responsive
- free from unnecessary duplication
- connected to the real backend instead of fake frontend state

The codebase should be organized so that each responsibility has a clear place.

> **Pages should compose components. Components should call functions/hooks. Hooks and services should contain logic. Reusable behavior should not be hardcoded repeatedly.**

---

# 1. General Rule

Do not put everything inside one page or one component.

Every meaningful responsibility should belong to an appropriate layer:

- **Page** → composes the screen
- **Component** → renders a reusable or meaningful UI section
- **Hook** → manages reusable React state/data behavior
- **Service/API function** → communicates with the backend
- **Utility function** → performs reusable calculations/formatting
- **Schema** → handles reusable validation
- **Type/interface** → defines data shapes
- **Constant/enum** → stores repeated domain values
- **Shared UI component** → handles recurring visual patterns

Do not create classes only for the sake of using classes.

For React/Next.js, prefer:

- functional components
- hooks
- functions
- typed modules
- reusable objects/configurations

Use classes only when they genuinely fit the existing architecture.

---

# 2. Page Files Should Be Easy to Read

A page file should mostly show the structure of the page.

Good:

```tsx
export default function WarehousesPage() {
  const warehouses = useWarehouses();

  return (
    <PageLayout>
      <WarehouseHeader />
      <WarehouseToolbar />
      <WarehouseTable data={warehouses.data} />
      <WarehouseDialogs />
    </PageLayout>
  );
}
```

Avoid page files that contain:

- raw API calls
- hundreds of lines of table markup
- validation
- formatting
- modal markup
- status logic
- repeated button styling
- repeated responsive logic
- hardcoded datasets
- complex business rules

If a page becomes difficult to understand at a glance, split it into meaningful pieces.

---

# 3. Every Meaningful UI Section Should Be a Component

Create components for meaningful sections.

Examples:

```text
InventoryTable
WarehouseTable
WarehouseHeader
WarehouseSummary
WarehouseInventoryTable
PurchaseOrderToolbar
PurchaseOrdersTable
SalesOrderForm
ArchiveWarehouseDialog
```

Do not create components for every tiny `<div>`.

A component should exist because it:

- is reused
- has meaningful behavior
- represents a clear UI section
- isolates complexity
- makes the parent easier to read
- enforces a consistent design pattern

---

# 4. Every Reusable Behavior Should Have a Function or Hook

Do not repeat the same logic inline.

Bad:

```tsx
const formatted = `₱${Number(value).toLocaleString()}`;
```

repeated in many files.

Better:

```ts
formatCurrency(value)
```

Examples of reusable functions:

```text
formatCurrency()
formatQuantity()
formatDate()
formatPhoneNumber()
formatStatusLabel()
getStockStatus()
getPurchaseOrderStatus()
```

Examples of reusable hooks:

```text
useInventory()
useWarehouses()
useWarehouseInventory()
usePurchaseOrders()
useSalesOrders()
```

---

# 5. Business Logic Should Not Be Buried in JSX

Avoid:

```tsx
{order.received > 0 &&
 order.received < order.total &&
 order.status !== "CANCELLED" &&
 ...}
```

Prefer:

```tsx
const status = getPurchaseOrderStatus(order);
```

Then:

```tsx
<PurchaseOrderStatusBadge status={status} />
```

Complex conditions should be moved into named functions so they are:

- readable
- testable
- reusable
- easier to debug

---

# 6. Event Handlers Should Be Named

Avoid large anonymous functions:

```tsx
onClick={async () => {
  // 40 lines
}}
```

Prefer:

```tsx
const handleArchiveWarehouse = async () => {
  ...
};
```

Then:

```tsx
<Button onClick={handleArchiveWarehouse}>
  Archive
</Button>
```

If the handler becomes complex, move API/business logic into a hook or service.

---

# 7. Use Services for Backend Communication

Do not scatter raw API calls throughout components.

Avoid:

```tsx
fetch("/api/warehouses")
```

inside multiple files.

Prefer:

```text
warehouseService.ts
inventoryService.ts
purchaseOrderService.ts
salesOrderService.ts
```

Example:

```ts
export async function getWarehouses() {
  return api.get("/warehouses");
}
```

Then use the service inside a hook/query layer.

---

# 8. Use Hooks for Data Fetching and State Coordination

UI components should not contain complicated data-fetching behavior when it can be encapsulated.

Example:

```tsx
const {
  data,
  isLoading,
  error,
  refetch,
} = useWarehouses();
```

A hook can coordinate:

- data fetching
- loading state
- error state
- mutation state
- cache invalidation
- refetching

Do not create a hook for trivial local state unless it improves reuse or clarity.

---

# 9. Backend Is the Source of Truth

Do not hardcode business/domain data in the frontend.

Do not hardcode:

- products
- inventory quantities
- warehouse stock
- warehouses
- customers
- suppliers
- purchase orders
- sales orders
- deliveries
- vehicles
- staff

Bad:

```tsx
const warehouses = [
  { name: "Main Warehouse", stock: 530 },
];
```

Preferred:

```tsx
const { data: warehouses } = useWarehouses();
```

---

# 10. No Mock Data or localStorage for Real Domain State

Do not use:

- fake records
- hardcoded demo arrays
- localStorage as the database
- sessionStorage as the database
- fake fallback stock values

unless explicitly requested for isolated tests.

If backend data is missing:

1. identify what endpoint or field is missing
2. add/fix the proper backend integration
3. consume the real data

Do not work around missing backend behavior with fake frontend state.

---

# 11. One Source of Truth

Do not maintain multiple versions of the same data.

Avoid:

```text
warehouseData
warehouseTableData
warehouseModalData
warehouseLocalCopy
```

unless each has a clearly different purpose.

Prefer:

```text
Backend
  ↓
Service / Query
  ↓
Derived selectors / formatters
  ↓
UI
```

---

# 12. Derived Data Should Be Derived

If a value can be calculated safely, do not store a second copy in state.

Example:

```tsx
const locationCount = warehouseStocks.length;
```

instead of:

```tsx
const [locationCount, setLocationCount] = useState(...)
```

Examples:

- location count
- filtered count
- received percentage
- display status
- item count

If the backend already provides the authoritative aggregate, use that.

---

# 13. Reuse Existing Components Before Creating New Ones

Before writing a new component, inspect the project.

Check for:

- Button
- IconButton
- DataTable
- Tooltip
- Modal
- Dialog
- Drawer
- Badge
- SearchInput
- Select
- Dropdown
- Tabs
- EmptyState
- LoadingState
- ErrorState
- Pagination
- FormField
- Menu

Extend an existing component if possible.

Avoid duplicates such as:

```text
Button.tsx
CustomButton.tsx
PrimaryButton.tsx
RedButton.tsx
NewButton.tsx
```

---

# 14. Shared DataTable Foundation

Do not build a separate table implementation for every module.

Use the shared DataTable for:

- Inventory
- Warehouses
- Warehouse Inventory
- Customers
- Suppliers
- Purchase Orders
- Sales Orders
- Vehicles
- Staff

Feature tables should configure the shared DataTable.

Example:

```tsx
<DataTable
  columns={warehouseColumns}
  data={warehouses}
/>
```

---

# 15. Table Columns Should Be Configurable

Do not place huge table column definitions inside page files.

Use:

```text
warehouseColumns.tsx
inventoryColumns.tsx
purchaseOrderColumns.tsx
```

Example:

```tsx
const columns = createWarehouseColumns({
  onEdit,
  onArchive,
  onViewInventory,
});
```

---

# 16. Reusable Table Cell Components

Common table cells should be reusable.

Examples:

```text
TruncatedCell
QuantityCell
StatusBadge
IconActionButton
LocationCountButton
ResponsiveRowActions
```

`TruncatedCell` can handle:

- long names
- addresses
- large numeric values
- ellipsis
- tooltip
- accessibility

`QuantityCell` can handle:

- formatting
- units
- alignment
- overflow

Do not duplicate these patterns in every feature.

---

# 17. Shared DataTable Actions

Use one reusable component for common table actions.

Example:

```tsx
<DataTableActions
  onEdit={handleEdit}
  onArchive={handleArchive}
/>
```

The shared component should only render actions.

It should NOT:

- call APIs directly
- know what a Supplier is
- know what a Warehouse is
- contain feature-specific business logic

The feature owns the behavior.

The shared component owns the presentation.

---

# 18. Shared Button System

Use one button system.

Suggested variants:

```text
primary
ghost
destructive
icon
```

Examples:

### Primary

- Create Purchase Order
- Confirm Sales Order
- View Inventory
- Save

### Ghost

- Edit
- Filter
- Close
- Secondary actions

### Destructive

- Archive
- Delete
- Remove

### Icon

- pencil
- archive
- close
- expand

Do not hardcode new button styles inside each feature.

---

# 19. Reusable Confirmation Dialog

Use a shared confirmation dialog foundation.

Example:

```tsx
<ConfirmationDialog
  open={open}
  title="Archive warehouse?"
  description="..."
  confirmLabel="Archive Warehouse"
  variant="destructive"
  onConfirm={handleArchive}
/>
```

Feature-specific content should be passed into the shared component.

Do not duplicate modal markup repeatedly.

---

# 20. Shared Status Presentation

Do not recreate status styles in every table.

Prefer:

```tsx
<StatusBadge status={status} />
```

Feature-specific statuses may have their own configuration, but the visual system should remain consistent.

---

# 21. Shared Formatters

Centralize repeated formatting.

Examples:

```ts
formatCurrency(value)
formatQuantity(value, unit)
formatDate(value)
formatPhoneNumber(value)
formatStatusLabel(status)
```

Do not repeat formatting logic in components.

---

# 22. Shared Validation

Use schemas/validators.

Examples:

```text
warehouseSchema
productSchema
purchaseOrderSchema
salesOrderSchema
```

Frontend validation improves UX.

Backend validation remains required for data integrity.

Never rely only on frontend validation.

---

# 23. Shared Types

Do not redefine the same type multiple times.

Reuse canonical types for:

```text
Product
Warehouse
WarehouseStock
Supplier
Customer
PurchaseOrder
SalesOrder
Delivery
Vehicle
```

Avoid `any` unless absolutely necessary.

---

# 24. Avoid Magic Strings

Do not repeat domain strings everywhere.

Avoid repeatedly writing:

```text
"ACTIVE"
"ARCHIVED"
"PARTIALLY_RECEIVED"
"CANCELLED"
"LOW_STOCK"
```

Use existing typed constants/enums when appropriate.

Static UI labels like:

```text
"View Inventory"
"Search orders..."
```

can remain inline unless localization or heavy reuse requires extraction.

---

# 25. Styling Should Be Reusable

Do not copy the same long class strings across many files.

Use:

- shared component variants
- design tokens
- existing utilities
- reusable classes
- existing typography
- existing spacing system

If a style appears repeatedly, centralize it.

---

# 26. Responsive Behavior Must Be Built In

Every reusable component should work across:

- desktop
- laptop
- tablet
- phone
- resized browser windows
- browser zoom

Do not design only for one viewport.

The same workflow must remain usable even if the layout changes.

---

# 27. Responsive Actions

Example:

Desktop:

```text
[ View Inventory ] [ Edit Icon ] [ Archive Icon ]
```

Mobile:

```text
[ Actions ]
```

Menu:

```text
View Inventory
Edit Warehouse
Archive Warehouse
```

Use the same callbacks.

Do not duplicate desktop and mobile business logic.

---

# 28. Responsive Tables

Do not force every desktop column onto mobile.

Use:

- column priority
- hidden secondary columns
- row expansion
- stacked details
- truncation
- wrapping
- responsive action menus

Do not solve responsiveness by making text tiny.

---

# 29. Accessibility Is Part of Reusability

Shared components should include:

- aria-labels
- keyboard accessibility
- focus states
- accessible dialogs
- accessible menus
- aria-expanded where needed
- sufficient touch target sizes

Do not rely only on hover.

---

# 30. Do Not Duplicate Desktop and Mobile Components

Prefer one responsive implementation.

Avoid:

```text
DesktopWarehouseTable.tsx
MobileWarehouseTable.tsx
```

unless the experiences are truly different enough to justify duplication.

---

# 31. Avoid Giant Universal Components

Do not create components like:

```tsx
<UniversalBusinessTable
  warehouseMode
  salesMode
  inventoryMode
  purchaseMode
/>
```

Prefer:

```text
DataTable
  ↑
InventoryTable
WarehouseTable
PurchaseOrdersTable
```

Reuse the foundation, not the entire business feature.

---

# 32. Keep Component APIs Small

If a component needs 20–30 unrelated props, it probably has too many responsibilities.

Split or compose instead.

Avoid many boolean flags controlling unrelated modes.

---

# 33. Keep Files Focused

A file should have one clear responsibility.

Examples:

```text
WarehouseTable.tsx
useWarehouses.ts
warehouseService.ts
warehouse.types.ts
warehouseSchema.ts
warehouseFormatters.ts
```

If a file mixes several unrelated concerns, split it.

---

# 34. Keep Functions Small and Named Clearly

Good:

```text
handleArchiveWarehouse
getWarehouseInventory
formatQuantity
createWarehouseColumns
```

Avoid:

```text
doThing
helper
data2
temp
stuff
```

Readable names make debugging easier.

---

# 35. Avoid Premature Abstraction

Do not create a generic abstraction just because two things look slightly similar.

Guideline:

1. build the first case cleanly
2. compare the second case
3. extract only when the pattern is real

Reuse should reduce complexity, not increase it.

---

# 36. Prefer Composition Over Large Conditional Components

Avoid:

```tsx
if (type === "warehouse") ...
if (type === "inventory") ...
if (type === "sales") ...
if (type === "purchase") ...
```

inside one giant component.

Use feature components composed from shared primitives.

---

# 37. Do Not Hide Missing Data With Fake Defaults

Bad:

```tsx
const quantity = apiQuantity || 100;
```

if `100` is not a real business default.

Prefer explicit missing-data handling.

Never invent operational values.

---

# 38. Backend Owns Workflow State

Statuses such as:

```text
PENDING
PREPARED
READY_FOR_DELIVERY
PARTIALLY_RECEIVED
RECEIVED
CANCELLED
```

must be backed and validated by the backend.

The frontend may:

- display states
- choose valid actions
- guide the user

but should not invent unsupported workflow states.

---

# 39. Mutation Rules

For create/update/archive/confirm actions:

- disable the button while submitting
- prevent double submission
- call the real backend
- show loading state
- only show success after backend confirmation
- refresh/invalidate data correctly
- show errors clearly

Do not fake success locally.

---

# 40. Reuse the Same Action Handler Everywhere

If desktop and mobile trigger the same action, reuse one handler.

Example:

```tsx
const handleViewInventory = (warehouseId: string) => {
  router.push(`/warehouses/${warehouseId}`);
};
```

Use it from:

- desktop button
- mobile menu
- row click

Do not duplicate navigation logic.

---

# 41. Suggested Feature Structure

Example:

```text
features/
  warehouses/
    components/
      WarehouseHeader.tsx
      WarehouseToolbar.tsx
      WarehouseTable.tsx
      WarehouseSummary.tsx
      WarehouseInventoryTable.tsx
      ArchiveWarehouseDialog.tsx

    hooks/
      useWarehouses.ts
      useWarehouseInventory.ts

    services/
      warehouseService.ts

    types/
      warehouse.types.ts

    schemas/
      warehouseSchema.ts

    utils/
      warehouseFormatters.ts
```

This is guidance, not a mandatory rewrite.

Follow the current project structure when it already has a good convention.

---

# 42. Suggested Shared Components

Potential shared components:

```text
components/
  ui/
    Button.tsx
    IconButton.tsx
    Tooltip.tsx
    ConfirmationDialog.tsx
    StatusBadge.tsx
    SearchInput.tsx

  data-table/
    DataTable.tsx
    DataTableActions.tsx
    TruncatedCell.tsx
    QuantityCell.tsx
    ResponsiveRowActions.tsx

  feedback/
    LoadingState.tsx
    ErrorState.tsx
    EmptyState.tsx
```

Only create these if equivalent components do not already exist.

---

# 43. Debugging Principle

When a bug occurs, it should be easy to identify which layer owns it.

Examples:

- API request wrong → service/hook
- value formatted incorrectly → formatter
- validation wrong → schema
- table layout wrong → DataTable/table component
- archive dialog wrong → confirmation dialog/feature
- status wrong → status logic/backend
- page arrangement wrong → page/layout component

Do not mix all of these responsibilities in one file.

---

# 44. Before Adding New Code

Always ask:

1. Does this already exist?
2. Can an existing component be extended?
3. Is this feature-specific or genuinely shared?
4. Is this UI logic or business logic?
5. Does this belong in a component, hook, service, util, schema, or type?
6. Will this behavior be reused?
7. Am I duplicating something already implemented?

Only then add new code.

---

# 45. Refactor Incrementally

Do not rewrite the entire frontend just to satisfy these rules.

Prioritize code that is:

- duplicated
- actively being changed
- difficult to debug
- too large
- inconsistent
- likely to be reused

Leave unrelated stable features alone unless necessary.

---

# 46. Code Review Checklist

Before completing frontend work:

## Architecture

- [ ] Is the page mostly composition?
- [ ] Are meaningful sections separate components?
- [ ] Is business logic outside large JSX blocks?
- [ ] Are API calls handled by services/hooks?
- [ ] Are reusable utilities extracted?

## Data

- [ ] Is the backend the source of truth?
- [ ] No mock domain data?
- [ ] No localStorage domain state?
- [ ] No duplicated server-state copies?
- [ ] Derived values are derived?

## Reuse

- [ ] Existing components checked first?
- [ ] Shared DataTable reused?
- [ ] Shared button system reused?
- [ ] Shared dialogs/tooltips/badges reused?
- [ ] Repeated logic extracted?

## Code Quality

- [ ] No giant anonymous handlers?
- [ ] No unnecessary `any`?
- [ ] No duplicate types?
- [ ] No repeated magic domain strings?
- [ ] Clear names?
- [ ] No giant universal component?

## UI

- [ ] Responsive on desktop/tablet/mobile?
- [ ] Long values cannot break layout?
- [ ] Actions remain accessible?
- [ ] Styling follows the design system?
- [ ] Touch targets remain usable?

## Accessibility

- [ ] Icon buttons have accessible labels?
- [ ] Focus states are visible?
- [ ] Dialogs are keyboard accessible?
- [ ] Mobile users do not depend on hover?

---

# 47. Final Rule

The frontend should read like a system of reusable building blocks.

Prefer:

```tsx
return (
  <PageLayout>
    <PageHeader />
    <Toolbar />
    <FeatureTable />
    <FeatureDialogs />
  </PageLayout>
);
```

instead of hundreds of lines of hardcoded implementation inside one page.

The goal is not to remove all JSX.

The goal is:

```text
Pages compose.
Components render.
Hooks coordinate.
Services communicate.
Functions transform.
Schemas validate.
Types define.
Backend owns the data.
```

This should make the application easier to debug, extend, test, and maintain.
