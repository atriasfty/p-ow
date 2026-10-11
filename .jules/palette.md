## 2024-05-24 - Add ARIA Labels to Missing Icon-Only Buttons
**Learning:** Found multiple instances of icon-only buttons (`<button><X className="..." /></button>`) lacking `aria-label`s, which degrades accessibility for screen reader users by reading unhelpful context or nothing at all.
**Action:** When working on modal closure buttons or general icon-only buttons, systematically verify and add an `aria-label` attribute describing the button's action (e.g., "Close", "Remove").
