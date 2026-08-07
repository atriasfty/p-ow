## 2024-06-15 - Dialog Accessibility
**Learning:** Custom UI dialog components like notifications often lack proper ARIA roles and keyboard focus styles, limiting accessibility for screen reader and keyboard users.
**Action:** Add role="alertdialog", aria-modal="true", proper aria-labelledby/describedby associations, and robust focus-visible styling (including ring-offset) to all interactive elements within custom dialogs.
