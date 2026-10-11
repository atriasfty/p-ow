## 2024-06-21 - Modal Accessibility
**Learning:** Custom modal dialogs (like the generic ConfirmModal) are read as plain document text by screen readers, making destructive actions perilous if users cannot hear the full context.
**Action:** Add `role="alertdialog"`, `aria-modal="true"`, explicit heading/description associations via `aria-labelledby`/`aria-describedby`, and strong `focus-visible` offset stylings to Cancel buttons next time.
