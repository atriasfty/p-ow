## 2024-05-24 - Map Modal Accessibility
**Learning:** Icon-only modal utility buttons (like zoom controls) often lack screen reader labels and clear keyboard focus states in custom overlays.
**Action:** Always add aria-label, title tooltips, and explicit focus-visible:outline-none focus-visible:ring-2 classes to standalone icon buttons.
