## 2024-04-05 - Missing ARIA Labels on Close Buttons
**Learning:** Icon-only modal close buttons in custom components (like those in `MobileToolbox.tsx`) often lack `aria-label` attributes and explicit `focus-visible` styling, hindering keyboard navigation and screen readers.
**Action:** Always verify icon-only buttons, especially in modals or toolboxes, have a descriptive `aria-label` and `focus-visible:ring-2` to support accessibility standards.

## 2024-04-06 - Dynamic ARIA Labels in Mapped Lists
**Learning:** When mapping over items to render list item actions (like Edit or Delete buttons) that only use icons, hardcoded labels like `aria-label="Delete"` are insufficient for screen reader users as they lack context.
**Action:** Always interpolate contextual identifiers into the `aria-label` and `title` attributes for icon-only buttons within mapped lists (e.g., `aria-label={\`Delete \${item.name}\`}`).
