## 2024-04-05 - Missing ARIA Labels on Close Buttons
**Learning:** Icon-only modal close buttons in custom components (like those in `MobileToolbox.tsx`) often lack `aria-label` attributes and explicit `focus-visible` styling, hindering keyboard navigation and screen readers.
**Action:** Always verify icon-only buttons, especially in modals or toolboxes, have a descriptive `aria-label` and `focus-visible:ring-2` to support accessibility standards.

## 2024-05-19 - Modals/Dialogs Close Buttons Pattern
**Learning:** Custom 'X' close buttons in modals/dialogs across the app often lacked `aria-label` attributes and keyboard focus visibility (`focus-visible` styles). This makes them undiscoverable to screen readers and difficult to locate for keyboard navigators.
**Action:** When adding close icons/buttons inside floating UI components (modals, dialogs, banners), always include descriptive `aria-label`s (e.g., "Close dialog") and apply explicit focus rings like `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400`.
