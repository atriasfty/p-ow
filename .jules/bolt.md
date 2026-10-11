## 2025-05-13 - O(1) Lookups in Discord Role Sync
**Learning:** Checking discord roles in a loop using `Array.prototype.includes()` is O(N*M) complexity.
**Action:** Convert arrays to Sets for membership checks before loops to achieve O(M) complexity.
