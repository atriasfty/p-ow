## 2026-04-26 - Icon-Only Modal Close Buttons
**Learning:** Icon-only close buttons (like the X icon) frequently lack ARIA labels and focus outlines, making them invisible to screen readers and difficult to use via keyboard navigation.
**Action:** Always ensure icon-only close buttons include an explicit `aria-label`, a `title` tooltip, and explicit `focus-visible:outline-none focus-visible:ring-2` styling for keyboard navigation.
