## 2024-07-02 - Icon-only Buttons Missing Accessibility
**Learning:** Found multiple instances where close buttons or icon-only buttons (like the X to close a modal or zoom buttons) lack aria-labels, titles, and proper focus-visible styles in this app's components, making them inaccessible for screen reader users and difficult for keyboard navigation.
**Action:** Always add aria-label, title, and explicit focus-visible outline styles to icon-only buttons.
