## 2024-07-28 - Dialog Accessibility
**Learning:** Custom dialogs require explicit roles, aria-modal, and label associations to be properly interpreted by screen readers, and explicit high-contrast focus rings for keyboard accessibility against dark backgrounds.
**Action:** Apply `role="dialog"` (or `alertdialog`), `aria-modal="true"`, and proper label/description associations via `id` links. Ensure close buttons and action buttons have visible focus outlines with contrast offsets.
