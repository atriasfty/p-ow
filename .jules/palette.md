## 2024-05-24 - Custom Dialog Accessibility
**Learning:** Custom dialogs in this app often lack essential ARIA attributes (roles, modal state, label associations) and clear keyboard focus rings against dark backgrounds.
**Action:** Always add role="dialog", aria-modal="true", aria-labelledby/describedby, and explicit focus-visible:ring-2 focus-visible:ring-offset-zinc-900 styling to modals and their actions.
