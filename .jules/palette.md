## 2024-05-17 - Accessible Icon-Only Utility Buttons in Modals
**Learning:** Icon-only utility buttons in custom modals (like map controls or refresh toggles) often lack sufficient semantic context for screen readers and clear visual feedback for keyboard users.
**Action:** Always ensure icon-only buttons include an aria-label for screen readers, a title for mouse users, and explicit keyboard focus styling (focus-visible:outline-none focus-visible:ring-2) tailored to the button's purpose and background color.
