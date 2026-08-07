## 2024-05-18 - Avoid flat limits & O(N*M) lookup in loops
**Learning:** Fetching users unconditionally with `limit: 100` and then mapping them using `Array.prototype.find()` inside loops leads to O(N*M) complexity and fails for large user sets due to truncation.
**Action:** Query the database first, extract unique user IDs, and fetch only those IDs from Clerk in batches. Store them in a Map for O(1) lookups.
