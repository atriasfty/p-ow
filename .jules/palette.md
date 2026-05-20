## 2024-05-20 - Custom Combobox Accessibility
**Learning:** Custom comboboxes (div/button based) must include semantic ARIA attributes (`role="combobox"`, `aria-expanded`, `aria-haspopup`, `role="listbox"`, `role="option"`, `aria-selected`) and explicit keyboard navigation focus styles (`focus-visible:outline-none`, `focus-visible:ring-2`, `focus-visible:bg-zinc-700`) to be accessible.
**Action:** Always add standard ARIA combobox attributes and focus-visible utility classes when building or modifying custom dropdown components.
