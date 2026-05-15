## 2024-05-15 - Aria labels for icon-only buttons
**Learning:** Found multiple instances where icon-only buttons (like Trash, X) lack ARIA labels, which is a common accessibility issue for screen readers.
**Action:** Always add descriptive `aria-label` and `title` attributes to all icon-only buttons, and ensure they have proper focus styling (`focus-visible:outline-none focus-visible:ring-2`).
