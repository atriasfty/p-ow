
## 2026-04-27 - Custom Combobox Accessibility
**Learning:** Custom UI toggles acting as selects (comboboxes) need explicit ARIA listbox roles and keyboard navigation (focus-visible rings) for screen readers and keyboard users.
**Action:** Always add aria-expanded, aria-haspopup, role='listbox', and role='option' with focus-visible styles to custom select components.
