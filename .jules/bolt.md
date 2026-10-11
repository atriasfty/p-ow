## 2025-05-02 - O(N*M) Render Loop Lookups
**Learning:** Using `Array.prototype.find()` inside React rendering loops or `useMemo` hooks (e.g., iterating over 365 days) creates hidden O(N*M) time complexity that drastically slows down initial component mount and re-renders, blocking the main thread.
**Action:** When finding multiple items from an array inside a loop, pre-compute an O(1) lookup Map keyed by the search identifier before the loop starts to reduce complexity from O(N*M) to O(M).
