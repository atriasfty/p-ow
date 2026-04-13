## 2024-04-05 - Missing ARIA Labels on Close Buttons
**Learning:** Icon-only modal close buttons in custom components (like those in `MobileToolbox.tsx`) often lack `aria-label` attributes and explicit `focus-visible` styling, hindering keyboard navigation and screen readers.
**Action:** Always verify icon-only buttons, especially in modals or toolboxes, have a descriptive `aria-label` and `focus-visible:ring-2` to support accessibility standards.

## 2024-04-13 - Missing focus-visible styles on inline and modal buttons
**Learning:** Interactive inline and modal buttons (such as in `punishment-list.tsx`) may lack `focus-visible` ring styling, making keyboard navigation difficult to track.
**Action:** Always add explicit `focus-visible:outline-none focus-visible:ring-2` (along with offset where necessary) to ensure keyboard focus states are clearly visible for accessibility.
