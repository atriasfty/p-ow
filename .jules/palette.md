## 2024-05-15 - Dialog Provider Focus States
**Learning:** The custom modal provider lacked visual focus states on primary and close buttons, which is especially important for custom dialog structures that interrupt normal DOM flow.
**Action:** Ensure custom dialog providers always implement `focus-visible` styling (including ring offsets against dark modal backgrounds) and explicit ARIA labels on utility close buttons to maintain proper keyboard navigability.
