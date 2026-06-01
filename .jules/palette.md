## 2024-05-24 - Missing accessibility attributes in icon-only close buttons
**Learning:** Icon-only close buttons in modal/dialog components often lack `aria-label` and explicit focus states for keyboard navigation, impairing accessibility for screen readers and keyboard users.
**Action:** When working on modal or dialog components, verify that any icon-only buttons (like a close `X`) have an `aria-label` such as `"Close dialog"` and explicit `focus-visible` utility classes.
