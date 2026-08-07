## 2024-05-05 - Map Modal Zoom & Close Accessibility
**Learning:** Icon-only overlay controls (like map zoom or close buttons) frequently lack text alternatives and clear keyboard focus states due to their minimalist design, making them inaccessible to screen readers and keyboard users.
**Action:** Always verify that floating icon-only buttons include `aria-label`, `title`, and explicit `focus-visible` classes (e.g., `focus-visible:outline-none focus-visible:ring-2`) to ensure both semantic clarity and visual keyboard tracking.
