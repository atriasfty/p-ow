## 2024-05-18 - Missing focus states on custom interactive elements
**Learning:** Found multiple custom interactive elements (buttons acting as selects or generic buttons) that lack explicit `focus-visible` styles, hindering keyboard navigation visibility against dark backgrounds.
**Action:** Ensure all interactive elements, especially custom `button` and icon-only buttons, have explicit `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500` (or appropriate color) and `focus-visible:ring-offset-2` styles.
