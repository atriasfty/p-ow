## 2024-05-15 - Accessible Icon Buttons in Modals
**Learning:** Icon-only utility buttons in custom modal headers (like Zoom controls and Close buttons) frequently lack `aria-label`, `title` tooltips, and explicit focus styling, causing accessibility and keyboard navigation issues.
**Action:** Always ensure that all icon-only buttons in modal headers receive `aria-label`, `title`, and explicit focus styling (e.g., `focus-visible:outline-none focus-visible:ring-2`).
