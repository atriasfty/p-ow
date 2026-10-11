## 2024-04-27 - Icon-only buttons lack ARIA labels and focus states
**Learning:** Several modal components (like `dialog-provider` and `super-server-edit-modal`) had icon-only close buttons without `aria-label` or explicit focus styles, breaking screen reader context and keyboard navigation visibility.
**Action:** Always add explicit `aria-label`, `title`, and `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400` to icon-only buttons across the project.
