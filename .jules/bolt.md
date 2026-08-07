## 2024-05-15 - Replace Array.prototype.find() inside loops with O(1) Map lookups for users mapping

**Learning:** When matching user IDs (from a DB) to user objects (e.g., Clerk users) iteratively in rendering or data processing logic, using `Array.prototype.find()` creates O(N*M) complexity. Pre-building a fast O(1) lookup Map avoids severe performance degradation on large loops (like iterating over server members/stats).
**Action:** When performing multiple lookup actions on the same array of objects matching by IDs, create a Map up-front that keys on ID properties and retrieves the object, then query it.
