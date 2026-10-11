## 2025-05-13 - Modal Icon Button Accessibility
**Learning:** Icon-only modal close and utility buttons lack semantic attributes and focus-visible styling by default. This makes them invisible to screen readers and difficult to navigate via keyboard.
**Action:** When adding icon-only utility buttons to custom modals, always add `aria-label`, `title`, and explicit focus styling (e.g., `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2`).
