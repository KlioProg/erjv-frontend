# Primary brand green update

16 October 2026. This color update supersedes earlier palette values in this folder. The broader layout rollout still awaits the Customers pilot approval.

| Role                                            | Color                 |
| ----------------------------------------------- | --------------------- |
| Brand accent / large POS wordmark               | `#6A994E`             |
| Filled primary actions, brand text, focus rings | `#4D7337`             |
| Selected navigation / option backgrounds        | `#EEF4EA`             |
| Application, cards, popovers                    | `#FFFFFF`             |
| Secondary surfaces / neutral table hover        | `#F7F8F6`             |
| Graphite / supporting text                      | `#1C211D` / `#626A63` |
| Separators / input boundaries                   | `#E4E7E1` / `#858E85` |

Shared Tailwind tokens carry these roles to navigation, buttons, badges, checkboxes, selects, toasts, and existing domain components. Both filled Button variants use the darker green with white text. Raw brand fills retain graphite text. The missing `text-primary-text` alias now resolves to the accessible text shade. Customer pilot overrides inherit shared green tokens. A translucent registration-select focus ring now uses the shared solid ring. Warehouse and order-catalog table hover stays neutral.

Semantic information, success, warning, error, and destructive tokens are unchanged. No business logic, API contract, workflow, backend file, or dependency changed. Existing unrelated working-tree edits remain in place.

## Rendered contrast checks

Measured from actual computed styles in headless Microsoft Edge using an isolated read-only fixture of production components. All 20 sampled pairs meet their relevant text or non-text thresholds.

| Pair                                    | Contrast         |
| --------------------------------------- | ---------------- |
| White on filled action                  | 5.49:1           |
| White on hover / pressed action         | 6.48:1 / 7.58:1  |
| Graphite on raw brand accent            | 4.89:1           |
| Brand link on white                     | 5.49:1           |
| Selected navigation text / icon on tint | 14.61:1 / 4.91:1 |
| Input border / focus ring on white      | 3.38:1 / 5.49:1  |
| White checkmark on checked checkbox     | 5.49:1           |
| Large bold POS wordmark on white        | 3.34:1           |

The accent is used for large branding; small brand text uses the darker shade. Surface separators are decorative, while input boundaries use the stronger control border.

[Customer screen](brand-green/customers-desktop.png), [component states](brand-green/components-default.png), [keyboard focus](brand-green/components-focus.png), [selected option](brand-green/selected-option.png), [raw contrast evidence](brand-green/contrast-checks.json).

## Verification

- Lint and production build, including TypeScript compilation, pass. Compilation used the existing build guard with `VITE_API_BASE_URL=https://example.test`; no backend origin is configured or validated by that placeholder.
- All 47 unit tests and all 105 component tests pass. Components ran with `npx vitest run --no-file-parallelism`, retaining the existing test timeouts.
- No previous primary-green hex values remain in production source/assets. Historical screenshots and reports retain their original palette.
- Ordinary cards and table surfaces remain white/neutral. Rendered checks use no live records and reject API writes; temporary tooling stays under ignored `node_modules/.cache/customers-pilot`.

Not checked: live backend integration, physical devices, or full accessibility conformance. The existing production bundle warning above 500kB remains.
