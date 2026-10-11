## 2025-05-21 - Mobile Component Consistency
**Learning:** Inputs within the mobile-specific `MobileToolbox.tsx` were missing explicit `focus-visible` styling compared to its desktop counterpart `toolbox.tsx`, which made keyboard navigation states inconsistent across breakpoints.
**Action:** Always ensure parallel components (desktop vs. mobile) apply equivalent accessibility utilities (like `focus-visible:ring-2`) to all inputs and interactive elements.
