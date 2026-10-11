## 2024-06-30 - Custom Dialog Accessibility
**Learning:** Custom dialogs in this app lack native dialog accessibility semantics by default, which impairs screen reader usability. Additionally, primary action buttons within dark-themed modals require explicit focus-visible ring offsets to remain visible against the dark background.
**Action:** Always verify custom modals implement proper aria-modal, role (dialog/alertdialog), and aria-labelledby/describedby attributes, and ensure primary actions use focus-visible styling with dark offset colors.
