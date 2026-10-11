## 2025-03-05 - [Map Modal Accessibility]
**Learning:** Custom framer-motion modals in this app require explicit ARIA roles (`role="dialog"`, `aria-modal="true"`, `aria-labelledby`) for screen reader support, and icon-only utility buttons require explicit focus rings (`focus-visible:ring-2`) because default global styles do not provide them.
**Action:** Always add semantic dialog roles to custom overlay containers and explicit `focus-visible` styling to icon-only action buttons.
