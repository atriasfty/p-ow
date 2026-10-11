## 2024-05-18 - Keyboard Focus on Custom Comboboxes
**Learning:** Custom interactive elements (like div-based combobox dropdown triggers) frequently lack default focus states, making them invisible to keyboard navigation. ARIA attributes like `aria-expanded` and `aria-haspopup` are essential for screen reader context when re-implementing native controls.
**Action:** Always verify keyboard accessibility (`focus-visible:ring-2`) and include semantic ARIA attributes (`aria-expanded`, `aria-haspopup`) when replacing native `<select>` elements with custom dropdown designs.
