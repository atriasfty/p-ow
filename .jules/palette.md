## 2024-05-09 - Custom Dialog Accessibility Improvements
**Learning:** Custom UI dialogs/modals often lack proper keyboard focus styling on icon-only close buttons and primary actions (Cancel/OK). Dark backgrounds require ring offsets (`focus-visible:ring-offset-zinc-900`) to ensure focus rings are visible.
**Action:** Always add explicit `focus-visible:outline-none focus-visible:ring-2` styling for keyboard navigation to interactive elements in custom modals. Add `aria-label` and `title` to icon-only close buttons.
