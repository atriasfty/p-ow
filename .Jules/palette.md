## 2024-04-05 - Missing ARIA Labels on Close Buttons
**Learning:** Icon-only modal close buttons in custom components (like those in `MobileToolbox.tsx`) often lack `aria-label` attributes and explicit `focus-visible` styling, hindering keyboard navigation and screen readers.
**Action:** Always verify icon-only buttons, especially in modals or toolboxes, have a descriptive `aria-label` and `focus-visible:ring-2` to support accessibility standards.

## 2024-04-18 - Semantic Toggles for Better Accessibility
**Learning:** Custom UI toggle buttons built from `button` elements combined with Tailwind classes look good but are entirely inaccessible to screen readers by default. They are read simply as "button" with no indication of their boolean state or purpose.
**Action:** When building or encountering custom toggles, always implement the WAI-ARIA switch pattern. This requires adding `role="switch"`, dynamically binding `aria-checked={state}`, and providing a descriptive `aria-label`. Furthermore, to ensure keyboard accessibility isn't compromised, explicitly add `focus-visible` styling (like `focus-visible:ring-2`) since custom components often lack default focus indicators.
