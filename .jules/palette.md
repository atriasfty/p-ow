## 2024-04-05 - Missing ARIA Labels on Close Buttons
**Learning:** Icon-only modal close buttons in custom components (like those in `MobileToolbox.tsx`) often lack `aria-label` attributes and explicit `focus-visible` styling, hindering keyboard navigation and screen readers.
**Action:** Always verify icon-only buttons, especially in modals or toolboxes, have a descriptive `aria-label` and `focus-visible:ring-2` to support accessibility standards.

## 2024-04-07 - UI/Provider Level Modal Close Buttons
**Learning:** The pattern of missing ARIA labels and focus outlines extends to core UI components (`confirm-modal.tsx`) and providers (`dialog-provider.tsx`), not just specific toolboxes.
**Action:** When building new modals or updating core dialog components, ensure all icon-only close buttons include `aria-label="Close modal"` and `focus-visible:outline-none focus-visible:ring-2` utility classes.
