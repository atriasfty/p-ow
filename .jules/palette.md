## 2024-04-05 - Missing ARIA Labels on Close Buttons
**Learning:** Icon-only modal close buttons in custom components (like those in `MobileToolbox.tsx`) often lack `aria-label` attributes and explicit `focus-visible` styling, hindering keyboard navigation and screen readers.
**Action:** Always verify icon-only buttons, especially in modals or toolboxes, have a descriptive `aria-label` and `focus-visible:ring-2` to support accessibility standards.
## 2026-04-10 - Accessible Focus States for Map-Rendered Action Items
**Learning:** Map-rendered inline items (like lists) often use icon-only actions or dropdown menus that lack global standard styling. The focus states for these custom elements are frequently omitted because the hover states provide sufficient visual feedback for mouse users, resulting in poor accessibility for keyboard navigation.
**Action:** When implementing inline actions in lists (like Edit, Save, Delete, or Kebab menu items), always explicitly add `focus-visible:outline-none` combined with `focus-visible:ring-2` (for buttons) or `focus-visible:bg-zinc-700` (for dropdown items) so keyboard focus is clear and consistent with the hover states.
