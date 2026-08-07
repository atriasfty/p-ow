## 2024-05-11 - Focus styles for embedded actions
**Learning:** Small, inline action buttons and dropdown menu items embedded in map-rendered lists lack native focus rings when custom styled, making keyboard navigation difficult.
**Action:** Always include explicit focus-visible:outline-none combined with focus-visible:ring-2 (for buttons) or focus-visible:bg-zinc-700 (for dropdowns) on all interactive elements.
