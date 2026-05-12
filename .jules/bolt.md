## 2024-05-12 - Pre-computing O(1) lookup Maps for user mapping
**Learning:** Using Array.prototype.find() inside loops for cross-referencing external data (like Clerk users) against database records creates an O(N*M) performance bottleneck.
**Action:** Pre-compute an O(1) lookup Map keyed by all necessary identifiers (like user ID, Discord ID, Roblox ID) before looping through database records to eliminate the nested iteration overhead.
