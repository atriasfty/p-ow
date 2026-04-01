## 2024-05-24 - [Missing ARIA Labels on Modal Close Buttons]
**Learning:** Icon-only modal and banner close buttons are systematically missing `aria-label` attributes across dashboard components, making them inaccessible to screen readers.
**Action:** When creating or modifying modal or banner components, ensure that any icon-only `<button>` elements (e.g., those using `<X />`) have a descriptive `aria-label`.
