## 2024-06-29 - Dialog Accessibility
**Learning:** Custom dialog modals in this application require explicit semantic roles (`role="alertdialog"`), ARIA modal and labeling attributes, and explicit focus states for all interactive elements to ensure full keyboard navigability against dark backgrounds.
**Action:** Ensure all custom modals implement `role="alertdialog"`, `aria-modal="true"`, correct label associations, and `focus-visible` outline styles with dark offsets for primary buttons.
