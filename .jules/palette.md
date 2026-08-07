
## 2024-10-24 - Custom Dialog Accessibility
**Learning:** Custom built dialog components and floating modals (like DialogProvider and SsdNotification) frequently miss structural accessibility features compared to native `<dialog>` or UI libraries. Specifically, their dismiss/close icon buttons typically lack `aria-label`, `title`, and explicit `focus-visible` styling, making them invisible to screen readers and difficult to locate via keyboard navigation.
**Action:** Always ensure that custom modals include an `aria-label` and `title` on icon-only close buttons, and apply `focus-visible:outline-none focus-visible:ring-2` to both the close buttons and primary action buttons to ensure clear keyboard navigability.
