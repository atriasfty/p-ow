## 2024-05-01 - Icon-only modal buttons lack accessibility
**Learning:** Icon-only modal close buttons and other secondary actions (like refresh or zoom) often lack descriptive context for screen readers and miss clear visual focus states for keyboard navigation.
**Action:** Always provide an explicit `aria-label` along with a `title` tooltip for icon-only buttons, and apply `focus-visible:outline-none focus-visible:ring-2` to ensure clear keyboard navigability.
