# Inventory cleanup and global stock warnings

Inventory opens directly to its canonical DataTable. The page hierarchy is Inventory, Active/Archived, Search/Register Product, then Product, Wholesale Price, Total Stock, Locations and permitted Actions. The redundant Inventory/Low-Stock Alerts subtabs, Status column, In Stock badges and four inventory KPI cards are removed. Inventory has no sidebar chevron. Existing responsive column visibility and mobile product actions are preserved.

The extra outer inventory card border/padding and the stock-breakdown cards are removed. Product registration, editing, archiving, restoration, searching, employee-selected sorting, pagination and location navigation still use their existing services and controls. Archive failures now keep the confirmation open for correction/retry. Staff retain read-only access.

Warehouse Locations, Total Stored Units and Catalog Products remain in the existing Warehouses workspace with their existing calculations. Vehicle availability remains in the existing Vehicles workspace and its existing Available metric. No new dashboard or service was introduced.

## Stock conditions

Physical quantity, rather than unreserved sales availability, determines shortages. Quantities and totals reuse the existing exact decimal utilities. Malformed quantities remain unknown. A complete empty product stock list has zero total; it does not invent any warehouse association.

An overall product total of zero gets a subtle destructive-color background and an accessible warning beside its quantity. A zero balance in one warehouse with stock elsewhere gets a location warning, without making the entire product globally out of stock. Expanded Locations shows each location's actual balance, unit and warning. Archived products retain their stock breakdown without active shortage indicators.

Default ordering sorts the full returned product array by overall OUT, LOW, NORMAL, UNKNOWN condition, then name and ID before DataTable pagination. Explicit employee sorting takes precedence; search still operates on the full list. Notification navigation clears the previous workspace filters and opens the page containing the requested product.

**Low-stock dependency:** read-only inspection of the current InventoryItem, Warehouse and StockItem schema, stock-items service/controller and response DTO found no product or location reorder thresholds. The removed alert page used a universal 20-unit threshold. That threshold is not reused. Positive stock is not labeled LOW without an authoritative configured threshold. The shared condition helper supports an explicitly supplied threshold and the table has a muted warning-color treatment, but the current live data produces only verified OUT warnings. Location-specific threshold data is needed to activate accurate LOW warnings; no API field or operational value was fabricated.

## Shared header notifications

The shared header now has a stock notification bell. The former Product Catalog shortcut duplicated Inventory access and is removed. ADMIN Mode was a role label, not an operational switch; permissions and the existing sidebar account/profile menu remain. The profile trigger is a keyboard-accessible button, and Sign Out remains available.

Each warning identifies an active product, active warehouse/store, quantity, unit and severity. IDs use product ID, location ID and condition, and duplicate alerts are removed. Missing, archived and malformed source records do not produce invented notifications. Selecting an alert navigates to Inventory, opens the correct product's Locations, selects its pagination page and focuses/highlights the affected location. Removed/archived products and missing locations have safe explanatory fallbacks.

The bell shares existing products, stock-items and warehouses query caches. Existing mutation invalidations refresh warnings after product, stock and delivery operations. Opening the menu refreshes those queries; entries pause during refresh to avoid navigation from stale warning data. Existing query window-focus behavior also refreshes data. This is not server push or continuous polling.

The badge counts unresolved shortages, not unread messages. Reading does not remove a warning; changing its authoritative stock balance does. Loading, failure/retry and empty states are distinct. No notification endpoint, localStorage business state, persistent read/unread behavior or unsupported delivery notification category was introduced.

## Frontend files

| Area                             | Files                                                                                                                                                               |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Inventory                        | `src/components/inventory/InventoryHub.tsx`, `InventoryItemCatalog.tsx`; obsolete `LowStockList.tsx` removed                                                        |
| Shared navigation/header         | `src/components/dashboard/MainDashboard.tsx`, `src/components/layout/DashboardLayout.tsx`, new `StockNotifications.tsx`                                             |
| Warning rules/cache coordination | New `src/features/logistics/stock-warnings.ts`, `stock-warnings.hooks.ts`                                                                                           |
| Verification                     | New `src/features/logistics/stock-warnings.test.mjs`, `src/components/inventory/inventory-notifications.component.test.tsx`; unit command updated in `package.json` |

The existing DataTable, ArchiveTabNav, OverflowValue, DataTableActions, DropdownMenu, Button and product dialogs are reused. No dependency was added for this pass. Existing order/delivery changes are retained.

## Verification

- `npm test`: 42 unit tests and 56 component tests pass (98 total).
- `npm run build`: TypeScript and production build pass. The existing Vite chunk-size warning remains (approximately 892 kB JavaScript before gzip).
- `npm run lint`: passes.
- Targeted Prettier and `git diff --check`: pass.

New coverage checks authoritative threshold requirements, exact physical quantities, location versus global shortages, stable/deduplicated warning IDs, archived/unknown exclusions, default urgency ordering and explicit sorting, search, registration/editing, archive failure/retry, restoration and retained stock links, staff permissions, sidebar account access, cleanup of redundant controls, notification refresh/error recovery, unresolved warning behavior, and cross-module navigation/focus to a product on a later page. Component fixtures and the HTTP adapter exist only in tests. Prior order/delivery regressions remain passing.

Computer-use inventory returned no apps or browser sessions. Desktop and landscape-tablet geometry, overlap, horizontal overflow, popover placement, scrolling, theme contrast and touch behavior remain unverified. JSDOM tests do not establish rendered visual correctness. Live authenticated requests and changes from another employee were not tested; no live business records were created.

Backend files, contracts, schemas and business rules were not modified. The backend working tree remains clean. Frontend changes are committed locally on `main`; nothing was pushed.
