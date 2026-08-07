## 2024-05-10 - Keyboard accessibility and focus rings
**Learning:** Icon-only buttons and mapped interactive list items across the app frequently lack explicit `focus-visible` outlines, reducing keyboard navigability for screen reader and keyboard-only users.
**Action:** When adding or updating interactive elements, always verify presence of `focus-visible:outline-none focus-visible:ring-2` to guarantee clear visual feedback for keyboard interactions.
