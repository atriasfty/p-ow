## 2025-02-14 - Map Modal Navigation Focus
**Learning:** Custom overlay map components containing zoom controls and close buttons often omit aria-labels and specific `focus-visible` states, relying solely on hover states, making keyboard navigation confusing.
**Action:** Always apply `focus-visible:outline-none` and `focus-visible:ring-2` to inline icon-only map controls and dialog close buttons, and ensure `aria-label` provides adequate screen-reader context.
