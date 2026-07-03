## 2024-07-03 - Icon-only Modal Close Buttons
**Learning:** Icon-only modal close buttons throughout the custom admin UI lacked proper accessibility attributes (`aria-label`) and distinct visual feedback for keyboard navigation (`focus-visible`).
**Action:** Always ensure icon-only buttons in custom dialogs/modals include an `aria-label` attribute and explicit `focus-visible:outline-none focus-visible:ring-2` styling for clear keyboard navigability.
