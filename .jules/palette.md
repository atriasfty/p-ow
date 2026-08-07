
## 2024-05-08 - Dialog Button Accessibility
**Learning:** Custom dialog action buttons and close buttons lack keyboard accessibility focus states, causing poor navigation context for screen readers and keyboard users.
**Action:** Always include aria-label for icon-only close buttons and focus-visible:outline-none focus-visible:ring-2 classes on dialog action buttons to ensure clear keyboard navigability.
