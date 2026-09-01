# 4x Spacing System & Design Rules

To ensure visual harmony, rhythm, and consistency across all interfaces, strictly adhere to the **4x Spacing Rule** and the law of proximity.

---

## The 4x Spacing Scale

Every spacing unit, padding, margin, height, and gap must be a multiple of **4px**.

| Scale Category | Spacing Values | Tailwind Utility | When to Use |
| :--- | :--- | :--- | :--- |
| **Tight** | **4px / 8px** | `gap-1` (4px), `gap-2` (8px)<br>`p-1` (4px), `p-2` (8px)<br>`py-1` (4px), `px-2` (8px) | Use for closely related items, like an icon next to a label, micro-badges, tags, or internal padding inside compact elements. |
| **Default** | **12px / 16px** | `gap-3` (12px), `gap-4` (16px)<br>`p-3` (12px), `p-4` (16px)<br>`px-3` (12px), `px-4` (16px)<br>`py-2` (8px), `py-3` (12px) | Use for standard padding inside buttons, form fields, table cells, or gaps between list items and form rows. |
| **Loose** | **24px / 32px+** | `gap-6` (24px), `gap-8` (32px)<br>`p-6` (24px), `p-8` (32px)<br>`m-6` (24px), `m-8` (32px) | Use to separate distinct content groups, cards, dashboard panels, or major sections on a page, following the law of proximity. |

---

## Detailed Guidelines

### 1. Tight Spacing (4px / 8px)
* **Icon + Label**: Always use `gap-1` (4px) or `gap-2` (8px) between an inline icon and its text.
* **Badges & Tags**:
  * Micro badges: `px-2 py-0.5` or `px-2 py-1`
  * Standard badges: `px-3 py-1` with `gap-1.5` ❌ &rarr; use `gap-1` (4px) or `gap-2` (8px) ✅
* **Avoid Fractional Spacing**: Never use arbitrary half-tailored values like `p-1.5` (6px) or `h-8.5` (34px) when a strict 4x multiple (`h-8` = 32px, `h-9` = 36px) creates better vertical cadence.

### 2. Default Spacing (12px / 16px)
* **Buttons & Inputs**:
  * Standard button: `h-8` (32px) or `h-10` (40px) with `px-3` (12px) or `px-4` (16px).
  * Inputs: `h-8` (32px) or `h-10` (40px) with `px-3` (12px).
* **Table Rows & Cells**:
  * Header cells: `px-4 py-3` (16px horizontal, 12px vertical).
  * Body cells: `px-4 py-3` (16px horizontal, 12px vertical) or `px-4 py-4` (16px both).
  * Table rows: clean `h-14` (56px) or `h-16` (64px) bounds.

### 3. Loose Spacing (24px / 32px+)
* **Component Separators**:
  * Page containers: `gap-6` (24px) or `gap-8` (32px).
  * Card internal padding: `p-4` (16px) for compact cards, `p-6` (24px) for major cards.
  * Section spacing: `mb-6` (24px) or `mb-8` (32px).

---

## Law of Proximity Checklist
1. Elements that are part of the same entity (e.g. avatar + user name) must be closer together (`gap-2` / 8px) than the separation between distinct columns (`px-4` / 16px).
2. Controls inside a card or row must be separated by standard spacing (`gap-2` or `gap-3`).
3. Entire sections or cards must have loose spacing (`gap-6` or `gap-8`) so their groupings are instantly recognizable at a glance.
