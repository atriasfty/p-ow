## 2024-05-10 - Explicit focus styles for inline map actions
**Learning:** Inline action buttons and dropdowns rendered inside loops (like lists of users or items) easily lose keyboard navigability without explicit focus ring styling (`focus-visible:ring-2`) and ARIA attributes for state tracking (`aria-expanded`, `aria-haspopup`).
**Action:** Always add explicit `focus-visible:outline-none focus-visible:ring-2` to inline buttons, `focus-visible:bg-zinc-700` to inline dropdown options, and state attributes (`aria-expanded`, `aria-haspopup`) to triggers for accessibility.
