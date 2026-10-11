
## 2024-05-02 - Inline Actions Require Explicit Focus Rings
**Learning:** Found multiple interactive `<button>` elements within `punishment-list.tsx` (dropdown triggers, edit, complete, delete inline items) that lacked explicit visual keyboard focus states. They relied on hover pseudo-classes, rendering them invisible to users navigating via keyboard. Tailwind's focus-visible must be manually implemented on customized interactables.
**Action:** Always add `focus-visible:outline-none` accompanied by either `focus-visible:ring-2 focus-visible:ring-*` or `focus-visible:bg-*` to all custom buttons, dropdowns, and inline action items. When using `ring`, ensure the color conceptually matches the action (e.g. `ring-emerald-500` for confirm, `ring-red-500` for delete).
