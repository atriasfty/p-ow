## 2024-04-05 - Missing ARIA Labels on Close Buttons
**Learning:** Icon-only modal close buttons in custom components (like those in `MobileToolbox.tsx`) often lack `aria-label` attributes and explicit `focus-visible` styling, hindering keyboard navigation and screen readers.
**Action:** Always verify icon-only buttons, especially in modals or toolboxes, have a descriptive `aria-label` and `focus-visible:ring-2` to support accessibility standards.

## 2026-04-14 - Keyboard Accessibility on Inline List Actions
**Learning:** Small, inline action buttons and dropdown menu items embedded within mapped lists (like the punishment management dropdowns) frequently lack explicit keyboard focus indicators, rendering them invisible to keyboard-only navigation users.
**Action:** Ensure that `focus-visible:outline-none` combined with `focus-visible:ring-2` (for buttons) or `focus-visible:bg-zinc-700` (for dropdown items) is added to all interactive elements within list items to provide clear visual feedback during tab navigation.
