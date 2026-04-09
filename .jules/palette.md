## 2024-04-05 - Missing ARIA Labels on Close Buttons
**Learning:** Icon-only modal close buttons in custom components (like those in `MobileToolbox.tsx`) often lack `aria-label` attributes and explicit `focus-visible` styling, hindering keyboard navigation and screen readers.
**Action:** Always verify icon-only buttons, especially in modals or toolboxes, have a descriptive `aria-label` and `focus-visible:ring-2` to support accessibility standards.

## 2024-05-15 - Interactive Inline Action Buttons Focus States
**Learning:** Small, inline action buttons (like edit/save/cancel icons embedded in list items) are prone to missing `focus-visible` styles because they blend into the background. Screen reader/keyboard users cannot distinguish when these micro-interactions are focused.
**Action:** Audit all map-rendered lists containing inline actions (like edit menus or confirmation triggers) to ensure every interactive icon-button has `focus-visible:outline-none focus-visible:ring-2` with a high contrast color (e.g., `ring-indigo-500`).
