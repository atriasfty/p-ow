## 2024-05-06 - Initial setup
**Learning:** Initializing palette journal.
**Action:** Adding basic accessibility improvements.
## 2024-05-06 - Modal Icon Button Accessibility
**Learning:** Icon-only modal close buttons and utility buttons lack screen reader context and keyboard navigation clarity without ARIA attributes and focus-visible classes.
**Action:** Always add `aria-label`, `title`, and explicit `focus-visible:outline-none focus-visible:ring-2` styling to icon-only buttons.
