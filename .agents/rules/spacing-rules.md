# Rule: 4x Spacing Scale & Law of Proximity

Always apply the 4x spacing scale across all UI components, layouts, tables, and controls in `erjv-frontend`:

1. **4px / 8px (Tight)**:
   - Use for closely related items: icon next to a label (`gap-1` = 4px, `gap-2` = 8px).
   - Padding inside small tags, badges, and avatars (`px-2 py-1`, `p-1`, `p-2`).
   - Micro-indicators and dots.

2. **12px / 16px (Default)**:
   - Standard padding inside buttons (`px-3 py-2`, `px-4 py-2`).
   - Standard form inputs and select triggers (`h-8` = 32px, `h-10` = 40px, `px-3`).
   - Table cell padding (`px-4 py-3` = 16px horizontal, 12px vertical).
   - Gaps between list items or form fields (`gap-3` = 12px, `gap-4` = 16px).

3. **24px / 32px+ (Loose)**:
   - Separate distinct content groups, cards, dashboard widgets, or major sections on a page (`gap-6` = 24px, `gap-8` = 32px, `p-6` = 24px).
   - Follow the law of proximity: elements within a group must be noticeably closer than the distance between groups.
