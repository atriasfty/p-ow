
## 2024-04-24 - Mod-Panel Modal Accessibility
**Learning:** Icon-only control buttons inside specialized modals (like map zoom controls or refresh buttons) are highly prone to missing both screen reader context (`aria-label`) and visual keyboard navigation states. Given the high-density layout of these modals, simple `focus-visible:ring-2` styling effectively resolves navigability without disrupting the visual design.
**Action:** Always verify that interactive icon components within modals explicitly declare `aria-label`, `title`, and `focus-visible` ring utility classes, especially for custom interactive maps or data panels.
