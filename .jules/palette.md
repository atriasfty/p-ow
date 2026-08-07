
## 2024-04-30 - Added focus indicators to inline icon-only buttons
**Learning:** Small, inline action buttons (like edit/save/cancel or options menu triggers) embedded in list items often lack clear visual feedback during keyboard navigation because default browser focus rings can be hard to see or get clipped.
**Action:** Always include explicit `focus-visible:outline-none focus-visible:ring-2` (along with an appropriate ring color class like `focus-visible:ring-emerald-500`) to inline icon-only buttons to ensure clear keyboard navigability.
