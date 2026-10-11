## 2025-05-08 - Replace O(N*M) Array.prototype.find() with O(1) Map.get()
**Learning:** Using `Array.prototype.find()` inside render loops or data-mapping iterations (like mapping Clerk users) leads to O(N*M) complexity.
**Action:** Pre-compute an O(1) lookup Map keyed by the necessary identifiers before the loop to reduce complexity.
