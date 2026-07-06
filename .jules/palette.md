## 2024-07-06 - Accessible Dialog Focus States
**Learning:** Custom dialog overlays in dark mode require specific focus ring offsets (`focus-visible:ring-offset-zinc-900`) to be clearly visible against the dark background, and interactive elements must properly manage ARIA labels and roles for screen reader usability.
**Action:** When building custom modals or overlays with dark backgrounds, always apply high-contrast focus rings with dark offsets to interactive elements and ensure semantic container roles are used.
