# Incoming and outgoing scheduling UI

Both scheduling modals now share Incoming's compact form density and Outgoing's icon-free header. This is a frontend presentation refinement; existing state coordination, shipment calculations, validation and submission functions are unchanged.

## Shared presentation

`DeliveryFormDialog` reuses the established Dialog header, title, description and footer. `delivery-form.styles.ts` holds common sizing and spacing rules, rather than separate per-modal overrides.

- Content-driven height with a maximum of 880 px or 90dvh, a 768 px desktop maximum width and 24 px padding.
- Identical 18 px semibold titles, 12 px descriptions, 13 px medium field labels and 13 px control/button text. Cargo product names retain the shared 14 px ProductIdentity treatment; table headers and help/error text retain 12 px sizing.
- Controls and footer buttons are 40 px tall on desktop; coarse-pointer controls and close targets use 44 px. Existing shared border, radius, focus, placeholder and disabled treatments remain.
- Fields use the same 16 px section/grid spacing and 6 px label spacing. Related fields use two columns from 640 px, with minimum-width guards for long content.
- Each form has one vertical scrolling body, with the header and right-aligned footer outside it. The canonical DataTable retains its necessary horizontal scrolling at narrow widths.
- Primary scheduling buttons use the existing contrast-safe green variant, Cancel uses outline, and Outgoing Save Draft uses secondary. Footer actions are text-only, with matching dimensions and gaps.
- Empty, loading and error states use compact text, matching spinner sizes and common retry styles. Popovers receive a viewport width constraint; actual collision positioning still belongs to the existing shared dropdown/select components.

## Incoming

The decorative header icon is removed. Purchase Order / Target Warehouse and Expected Arrival Date & Time / Supplier Reference retain their existing two-column grids and label associations. The cargo heading, supplier summary, Auto-fill Remaining and receiving totals remain, with the nested card/background wrappers removed. The shipment DataTable is the single cargo surface. Notes, load errors, quantity errors and recovery controls remain available.

The existing Cancel / Schedule Incoming Delivery workflow is retained. No new draft action or request sequence was introduced.

## Outgoing

Sales Order and Source Warehouse now share the same responsive grid; the source field remains disclosed only for an eligible selected order or saved draft. Shipment quantities, schedule, optional vehicle/driver and optional instructions retain their existing values and behavior. Source quantities and allocation IDs are unchanged.

Save Draft, scheduling, saved-draft Retry Schedule and completion/Done remain supported through their existing handlers. Retry snapshots and submission/dismissal guards are preserved. The completion state uses the same footer presentation.

## Files

All paths are relative to `erjv-frontend`.

| File                                                          | Change                                                      |
| ------------------------------------------------------------- | ----------------------------------------------------------- |
| `src/components/deliveries/shared/DeliveryFormDialog.tsx`     | New shared scheduling shell/header/footer                   |
| `src/components/deliveries/shared/delivery-form.styles.ts`    | New shared density, typography, layout and control rules    |
| `src/components/deliveries/ScheduleIncomingDeliveryModal.tsx` | Shared presentation, icon removal and flatter cargo section |
| `src/components/deliveries/ScheduleDeliveryModal.tsx`         | Shared presentation and order/source grid                   |
| `src/components/deliveries/DeliveryQuantityTable.tsx`         | Shared quantity control height and 13 px table values       |
| `docs/delivery-form-standardization.md`                       | Scope and verification report                               |

No dependency was added. DataTable remains canonical, and shared controls outside these delivery forms were not restyled.

## Verification and limits

- `npm run build`: TypeScript and production build pass. The existing Vite bundle-size warning remains, with JavaScript approximately 893 kB before gzip.
- `npm run lint`: passes.
- Targeted Prettier and `git diff --check`: pass.
- The outgoing scheduling and order/delivery workflow component suites exercised 38 distinct cases. The first combined run passed 37; the existing sales-composer duplicate-submit case exceeded its five-second timeout while build/lint work was also running. A targeted rerun of both sales and purchase duplicate-submit cases passed with the unchanged default timeout and assertions. All 38 cases therefore passed across these runs; the initial combined run was not fully green.
- Existing tests cover exact fractional payloads, source limits, order eligibility, dates, draft-only saving, scheduling failure and retry without duplicate creation, pending dismissal, optional assignments, incoming arrangement, confirmation, receipt and permissions. No new tests that merely mirror CSS classes were added.
- A source comparison confirmed that both scheduling modals' coordination/calculation/submission code preceding their main JSX is identical to the committed implementation. Backend status was checked read-only and is clean; no backend files, schemas, migrations, API payloads or inventory rules were modified.

Computer-use inventory returned no apps or browser sessions. Rendered checks at 1920, 1440, 1280, 1024 and 768 px remain unverified, including dropdown placement, long-label overflow, footer geometry, touch interaction and visible focus. Component tests use JSDOM and do not establish visual correctness. No live authenticated business records were created for QA.

The remaining differences are the existing workflows: Incoming uses its purchase-order Select and scheduling action pair, while Outgoing retains searchable sales-order selection, optional assignment disclosure, Save Draft and saved-draft retry/completion states. These differences are preserved intentionally; visual geometry still needs a browser inspection.

Changes remain uncommitted. Nothing was pushed.
