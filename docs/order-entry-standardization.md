# Purchase and sales order composer

The product goal is to **confirm sales orders without warehouse selection and assign warehouse sources when preparing Outgoing Delivery**. The current backend requires allocations for sales confirmation. Compact source controls have been restored at the designer's request so sales create/confirm works while the future fulfillment contract is pending. Purchase destinations remain outside its composer. See [sales-fulfillment-handoff.md](sales-fulfillment-handoff.md) for the developer handoff and acceptance checks.

The create forms share one dialog containing an order editor and a searchable product catalog. The existing design tokens, Plus Jakarta Sans typography, compact fields, canonical DataTable, and separate purchasing/selling logic are retained. This replaces the previous vertical product picker layout while preserving its decimal calculation and save corrections.

The later order-to-delivery workflow pass is documented in [order-delivery-frontend.md](order-delivery-frontend.md). Sales source controls are compact and expandable; confirmation without allocations remains a backend dependency, and that report also records why saved-order editing is unavailable.

## Files and component reuse

All paths below are relative to `erjv-frontend`.

| Area                             | Modified or created files                                                                                                                      | Responsibility                                                                                        |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Purchase presentation and wiring | `src/components/purchases/PurchaseModal.tsx`, `PurchasesView.tsx`                                                                              | Supplier metadata, blank supplier cost, purchase columns, actual product/stock query state            |
| Sales presentation and wiring    | `src/components/orders/OrderModal.tsx`, `OrdersView.tsx`, `SalesOrderDetails.tsx`, `SalesOrderSources.tsx`, `SalesOrderTotals.tsx`             | Customer information, optional details, compact source controls, selected items and financial summary |
| Shared workspace                 | `src/components/order-entry/OrderEntryDialog.tsx`, `OrderEntryFields.tsx`, `OrderItemsTable.tsx`, `OrderProductCatalog.tsx`, `order-entry.css` | Responsive shell, compact header/footer, inputs, product identity, selected-items table, catalog      |
| Shared dialog                    | `src/components/ui/dialog.tsx`                                                                                                                 | Optional `closeDisabled` prop; existing callers keep their default behavior                           |
| Inventory reuse                  | `src/components/inventory/InventoryItemCatalog.tsx`, `src/features/products/products.catalog.utils.ts`                                         | Shared catalog search and exact stock aggregation; inventory administration stays intact              |
| Purchase coordination            | `src/features/logistics/purchase-order-entry.hooks.ts`, `purchase-order-entry.types.ts`                                                        | Draft values, additions, edits, validation, submission and API errors                                 |
| Sales coordination               | `src/features/crm/sales-order-entry.hooks.ts`, `sales-order-entry.types.ts`, `sales-order-entry.utils.ts`, `sales-order-entry.schema.ts`       | Draft values, product edits, field validation, focus, allocation validation and supported DTO mapping |
| Layout and focus                 | `src/hooks/use-order-composer-layout.ts`, `use-order-item-focus.ts`                                                                            | Media-query subscription, selected-row visibility and quantity focus                                  |
| Financial calculations           | `src/lib/order-amounts.ts`, `order-entry.schema.ts`                                                                                            | Scaled integer math, backend decimal bounds, rounding and form validation                             |
| Component testing                | `vitest.config.ts`, `src/test/component-setup.ts`, `src/components/order-entry/order-composer.component.test.tsx`                              | Isolated DOM tests using the actual dialogs, tables, hooks and controls                               |
| Unit testing                     | `src/lib/order-amounts.test.mjs`, `src/features/crm/sales-order-entry.test.mjs`, `src/features/products/products.catalog.test.mjs`             | Financial math, saved fields and explicit allocation rules, catalog filtering and stock totals        |
| Tooling and report               | `package.json`, `package-lock.json`, `docs/order-entry-standardization.md`                                                                     | Test commands/dev dependencies and this implementation report                                         |

Presentation reuses `DataTable`, `DataTableActions`, `SearchableDropdown`, Radix-backed `Dialog`, `Tabs`, `Select`, and existing `Button`, `Input`, `Label`, and `Alert` controls. Selected-item columns remain in their purchase/sales domains. No competing table implementation was introduced.

`OrderProductCatalog` supplies selection actions within the order workspace. It receives the existing `useProducts`/`useStockItems` results from its parent; it has no independent fetch or stored product list. Inventory administration and order selection share the extracted search/stock utilities. No operational mock data or localStorage business state is introduced. Test fixtures exist only in test files.

## Purchase improvements

- Supplier and expected date share the compact metadata row. Processed by is secondary text; supplier reference and notes use the shared Additional details disclosure.
- Clicking a catalog plus button immediately adds an editable line and focuses its quantity. A repeated selection focuses that same line, preserving its typed quantity and cost.
- Costs start blank because the actual product response provides selling price, not an authoritative supplier cost. Explicit zero cost is allowed. Low current stock does not block purchasing.
- Columns are Product, Quantity, Unit Cost, Subtotal, Remove. Unit appears below the product name. The selected-items table grows with its content; there is no reserved minimum table height or additional vertical table scroller.
- Item count and total sit directly below the table, followed by Additional details. Empty state, header and footer remain compact.

## Sales improvements

- Customer, expected delivery date, editable required delivery address and secondary processed-by text remain. Additional details keeps reference and notes mounted through collapse and API errors.
- The selected-items DataTable is Product, Quantity, Unit Price, Subtotal and Remove. Unit and non-redundant variety stay below product names. The table grows with its content.
- Products start at quantity 1 with the API selling price. Quantity and price stay editable; repeated adds focus the existing quantity and preserve values.
- A compact Set stock source action opens an inline editor on request; selected warehouse/quantity summaries keep the five-column table compact. No default source is invented. Split across warehouses exposes source quantities; totals, uniqueness and unreserved stock bounds are checked. Single-source quantities follow ordered quantities and repeated adds preserve source choices.
- Save Draft permits omitted sources. Confirm Order requires complete explicit allocations, then runs create/confirm for the returned ID with saved-draft retry. Missing sources open the affected editor and focus its selector.
- Discount and the aligned Subtotal/Discount/VAT/Total summary retain exact calculation and payload rules. API errors preserve editable unsaved data for retry.

`SalesOrderSources.tsx` provides the compact summary and editor; the sales entry hook owns drafts/disclosure/focus, `sales-order-entry.schema.ts` owns pure allocation rules, and the request mapper submits only stock item IDs and decimal source quantities. See [order-delivery-frontend.md](order-delivery-frontend.md) for current verification and delivery behavior.

## Catalog, layout and accessibility

- The catalog columns are Add, Product and stock. The leftmost plus button and clicking anywhere else on an available product row use the same add action. Repeated adds retain the existing line and focus its quantity. The action wrapper prevents button clicks from also triggering a row addition. Keyboard users retain the named Add button with Enter/Space activation; unavailable sales stock and read-only orders block both paths. DataTable sorting and pagination (10/25/50/100 rows) remain. Sales displays and sorts Available Stock, with physical stock as secondary on-hand text. Purchase retains Total Stock and its existing sorting. Search matches name, variety and description. Product loading, empty/no-match, stock failure and retry states are handled.
- Physical total stock is separate from sales availability, which uses the existing quantity/reservedQuantity responses, deducts reservations and clamps depleted sources to zero. Unknown values stay unknown instead of being displayed as zero.
- Add buttons have explicit accessible names and native titles. Product names and metadata retain full-text titles when truncated. Variety is omitted from secondary text when already present in the name.
- At 1200 px and above, the workspace is up to 1320 px wide with a 60/40 editor/catalog split and height bounded by 88dvh. This leaves about 690 px of usable editor content and over 400 px for the catalog at the breakpoint.
- Below 1200 px, Editor/Catalog tabs remain inside the same dialog. Add Products opens the catalog and focuses search; selection returns to the editor and focuses quantity. Both panels stay mounted, preserving form values and catalog search/sort/page state.
- Below 640 px, the dialog fills the dynamic viewport and the canonical selected-items table renders as labeled row grids. Editor and catalog each have one purposeful vertical scroll region; search and the editor footer remain outside those regions.
- Header title/subtitle use existing 18/13 px styles without decorative icons. Compact controls retain brand green emphasis, contrast-safe green text, destructive remove actions and visible focus styles.
- Escape, close and cancel use the existing dialog behavior. Closing restores focus to the launching control. The close control is explicitly disabled while saving and has a larger hit area in this workspace.

## Current backend boundaries

Backend files were inspected read-only. The backend working tree remains clean on `main`, at `a139edc11cb0895443d09e6cb9a9bfa854307139`, matching the local `origin/main` reference.

Purchase create items support `inventoryItemId`, `quantity`, `unitPrice`, optional line rates and notes. They do not support destination warehouse or delivery date per line. This UI retains the order-level `expectedAt`; destination warehouse selection belongs to subsequent incoming deliveries. A future backend decision is required before adding persistent purchase-line warehouse/date controls.

Sales create items support omitted or explicit allocations. Save Draft may omit sources; Confirm Order saves complete explicit allocations. The backend confirmation endpoint still requires every line to be fully allocated before reserving stock. Outgoing creation consumes those previously saved allocation IDs. There is no later allocation update endpoint. Sales Confirm Order saves explicit full allocations before confirmation; existing source-free saved drafts still require backend support for later source updates. No backend or inventory rules were changed.

Existing mutation hooks show success feedback and refresh order queries. Save Draft closes after creation succeeds; Confirm Order closes after confirmation succeeds and shows one Order confirmed notification. Delivery preparation is opened separately from the order list; the extra success popup has been removed. A failed confirmation retains the saved draft for retry.

## Financial correction retained

As explicitly requested earlier, sales submits the existing line `discountRate` and `taxRate` fields. Its preview matches the inspected backend: quantity multiplied by unit price and rounded per line, then line discount, then 12% VAT on the discounted amount. Totals sum those rounded values using scaled integers; requests retain decimal strings.

Peso discounts are converted to the supported two-decimal percentage rate. If that rate cannot save the requested peso discount exactly, submission is blocked with the representable amount and the option to use a percentage. A different discount is never silently saved.

## Verification and issues corrected

- `npm run build`: TypeScript and production build pass. Vite still reports a bundle exceeding its 500 kB warning threshold.
- `npm run lint`: passes.
- `npm run test:components`: 42 tests pass across composer/catalog, order/delivery workflow and saved-order response suites. Coverage includes source-free sales payloads, financial fields, quantity and allocation validation, repeat adds, API error retention, both composers' confirmation/retry, notification-only success, delivery navigation and responsive panel state.
- `npm run test:unit`: 37 tests pass across order/calculation/catalog/delivery-workflow suites and existing delivery presentation, stock display and vehicle assignment regression suites.
- Formatting is checked for new and modified implementation files. Inventory's pre-existing formatting outside the extracted utility calls is retained. Whitespace is checked with `git diff --check`.
- The dependency installation reported two existing transitive advisories. Compatible patches for `brace-expansion` and `source-map-js` were applied; npm's subsequent audit reported zero vulnerabilities. Testing libraries are development dependencies.

QA corrected malformed-stock sorting (unknown balances must not sort as zero), removed the obsolete product-dropdown focus callback, made busy close semantics explicit, restored launcher focus, and retained a visible sales item count on desktop. Error tests use the existing API error formatter, including its appended punctuation. The sales cleanup also corrected focus transfer when a source selector collapses and prevented automatic validation disclosure from interrupting quantity typing. One component run reached its 5-second case deadline under concurrent build/lint load; the unchanged assertions passed when the full test command was rerun without those concurrent jobs. No assertion or timeout was loosened.

`npm test` runs the unit and component suites together. Component tests use JSDOM; they do not verify rendered geometry or live API behavior. They were run with Node 26.7.0.

## Remaining verification limits

Computer-use inventory returned no browser sessions. Rendered checks at **1920, 1440, 1280, 1024, 768, 430, 390 and 320 px** remain unverified. In particular, real dropdown positioning, clipping, scroll behavior, touch interaction, virtual-keyboard resizing and visual spacing need a browser session.

Live authenticated backend testing was not performed. Actual create success/failure, toast/query refresh, stock changes from another employee, and reloaded persistence still need verification against a running backend and real catalog data. Read-only inspection confirmed the unchanged mutation hook still publishes the backend response to the sales-orders cache, invalidates that query and shows success feedback; component tests confirm successful submission closes the composer. No live business records were created for testing, and these checks are not claimed as passing.

All frontend changes are committed locally on `main`; nothing was pushed.
