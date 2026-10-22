# Management table status cleanup

Routine master-data tables use their Active / Archived views to identify record lifecycle. Repeated per-row badges and columns have been removed; exceptional stock conditions and operational states remain visible. All changes are frontend-only.

| Module          | Result                                                                                                                                                                                                                                              |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Suppliers       | Code, Company Name, Contact Person, Phone & Email, Address, Actions. Status removed from both views; company, contact and address information use the released space. Canonical sorting and pagination are available.                               |
| Customers       | Status removed from both views; address space increased. Edit, Archive and Reactivate remain permission-controlled.                                                                                                                                 |
| Warehouses      | Status removed, including its duplicate mobile badge. Name and location columns gain space. Stock totals, clickable names, Edit, Archive, Restore and the existing stock-before-archive checks remain.                                              |
| Job Positions   | Status removed from both views. Description, assigned-staff information and lifecycle actions remain.                                                                                                                                               |
| Staff Directory | Already had no Status column. The redundant Deactivated badge in the archived view is removed; linked/unlinked user-account information stays visible. Restore uses DataTableActions and pagination uses DataTable.                                 |
| Inventory       | The existing five-column catalog, physical stock calculations, stock warnings and management actions are retained. Warehouse inventory retains its recent warning treatment and existing 20-unit display cutoff; no new reorder rule is introduced. |

Sales and Purchase Orders, Deliveries and Vehicles retain their operational status presentation and existing transitions. User Roles & Access retains account-status and system-role information because it manages access. The secondary Product Catalog displays active and archived products together, so its lifecycle distinction remains. No shared StatusBadge or DirectoryStatusBadge component is deleted.

Customers, Suppliers, Warehouses, Staff and Job Positions now have a consistent plain heading before the record tabs and toolbar. MainDashboard renders these management surfaces without its additional bordered Card and padded CardContent. Redundant empty-state borders and the staff table wrapper are removed. DataTable still owns table rendering, scrolling, loading and pagination; ArchiveTabNav, DataTableActions, OverflowValue and existing dialogs, services and hooks are reused. No dependency or backend file is changed.

## Files changed in this pass

- `src/components/crm/ClientList.tsx`
- `src/components/purchases/PurchasesView.tsx`
- `src/components/operations/WarehouseList.tsx`
- `src/components/staffing/EmployeeList.tsx`
- `src/components/staffing/JobList.tsx`
- `src/components/dashboard/MainDashboard.tsx`
- `src/components/management/master-data.component.test.tsx`
- `docs/management-table-cleanup.md`

The new component suite uses a test-only HTTP adapter with actual services and query/mutation hooks. It covers all four removed columns, active/archived filtering, search, saved edits, confirmation before archive, restoration, supplier sorting/pagination, customer/warehouse read-only permissions, staff account links and a warehouse with positive fractional stock that must not be archived. Zero stock remains an active record until the employee explicitly archives it. No live records are created.

## Verification

- `npm run build`: TypeScript and production build pass. The existing Vite chunk-size warning remains (approximately 892 kB before gzip).
- `npm run lint`: passes.
- Targeted Prettier and `git diff --check`: pass.
- Unit suite: all 47 tests pass.
- All eight new management component tests pass, including saved edits, archive/restore, pagination and permission checks.
- The initial concurrent `npm test` run encountered existing composer/scheduling timeouts and a following request assertion failure. Running the complete component suite without concurrent build/lint work and with `--maxWorkers=1` passed 76 of 77 cases; the existing split-allocation composer case exceeded its default five-second deadline. That same case passed every assertion in an isolated diagnostic run using `--testTimeout=15000`. Thus all 77 component cases have passing assertions across those runs, but the default full command is not claimed as passing. No test assertion, source timeout or Vitest configuration was changed.

## Verification limits

Browser inventory returned no apps or browser sessions. Desktop and tablet rendered geometry, clipping and touch behavior remain unverified. Component tests use JSDOM. Authenticated live backend writes, reload persistence and concurrent employee changes were not tested. Existing services, contracts and permission rules are unchanged.

These changes remain uncommitted. Earlier local commits and the subsequent warehouse-inventory and sales-row refinements are preserved; nothing was pushed.
