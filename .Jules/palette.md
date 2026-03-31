## 2026-03-31 - Added ARIA Label and Title to Server Status Indicator
**Learning:** Purely visual status indicators (like colored dots for server online/offline status) lack meaning for screen reader users and can be confusing for mouse users. Adding `role="status"`, an `aria-label`, and a `title` attribute provides semantic meaning and a helpful tooltip.
**Action:** When creating visual status indicators, always include an `aria-label` (or screen-reader-only text) and a `title` attribute to ensure the information is accessible to all users.
