## 2024-04-22 - Add ARIA labels to form builder icon buttons
**Learning:** Form builders often rely on nested loops (sections containing questions containing options), which produce many identical icon-only buttons (like Move Up, Move Down, Delete). Without proper \`aria-labels\`, screen readers cannot distinguish what structure the button interacts with.
**Action:** Always add explicit, descriptive \`aria-labels\` to repeated icon-only action buttons within dynamic list structures so they announce correctly for assistive technologies.
