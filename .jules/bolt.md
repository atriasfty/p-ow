## $(date +%Y-%m-%d) - Optimize Clerk fetching and User Lookups in loops
**Learning:** Unconditionally fetching Clerk users using `getUserList({ limit: 100 })` is a bottleneck and bug source (misses users > 100), and doing `Array.prototype.find()` inside render loops for user mapping turns an O(N) lookup into O(N*M).
**Action:** Extract unique user IDs from DB records first, chunk them to bypass Clerk's 100-limit, and pre-compute O(1) lookups (like a `Map`) keyed by necessary IDs before iterating over records in the render loop.
