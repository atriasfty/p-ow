
## 2024-06-24 - Modal Dialog Accessibility Improvements
**Learning:** Custom UI dialog/modal containers must include semantic roles (role="dialog"), aria-modal="true", and proper label associations (aria-labelledby). Icon-only modal close buttons need descriptive aria-label, title tooltips, and explicit focus-visible styling for keyboard navigation to appear clearly against modal backgrounds.
**Action:** Always add semantic dialog roles and label bindings to modal containers, and ensure all icon-only utility buttons within them have clear labels and focus rings.
