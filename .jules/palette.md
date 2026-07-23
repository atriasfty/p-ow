## 2024-07-23 - Icon-only modal close buttons missing aria-labels and focus styles
**Learning:** Found an accessibility pattern where icon-only modal close buttons in `super-server-edit-modal.tsx` (and potentially others) lack `aria-label`, `title`, and explicit `focus-visible` styling, hindering screen reader users and keyboard navigation.
**Action:** Always verify that custom icon-only close buttons have an `aria-label`, a `title` tooltip, and clear keyboard focus states using `focus-visible:outline-none focus-visible:ring-2` to ensure they are fully accessible to all users.
