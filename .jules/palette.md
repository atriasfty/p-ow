## 2024-05-21 - Accessible Focus Styles for Small Interactive Elements

**Learning:** When reviewing dropdown menus and small inline action buttons embedded within rendered lists (such as those in `punishment-list.tsx`), it's essential to explicitly include keyboard focus feedback (`focus-visible:outline-none focus-visible:ring-2`) and ensure clear visual states when receiving focus. Additionally, components that trigger custom popups or act as action buttons in tight spaces benefit from focused styling that provides contrast against the background (e.g., using `focus-visible:bg-zinc-700` for dropdown items or specific ring colors for embedded confirm/cancel actions).

**Action:** Consistently add clear `focus-visible` classes (`outline-none`, appropriate `ring-2` with an intention-matching color, or visible `bg-` changes) to inline action buttons and interactive dropdown menu items to enhance keyboard navigability and ensure WCAG compliance for focus indicators.
