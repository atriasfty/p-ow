## 2024-05-14 - Global Dialog Accessibility
**Learning:** Global dialog components lacked explicit focus indicators and ARIA labels on icon-only buttons, making keyboard navigation difficult against dark backgrounds.
**Action:** Apply `aria-label` and `title` to icon-only buttons, and use `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-900` to ensure keyboard focus states are visible.
