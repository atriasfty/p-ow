## 2026-05-18 - Avoid O(N) find inside O(M) loops (O(N*M) -> O(N+M))
**Learning:** Found multiple instances where an array was searched using `Array.find` within an outer loop over member data, producing O(N*M) complexity which degrades performance for servers with thousands of members.
**Action:** Always pre-compute an O(1) Map using a single pass (O(N)) prior to iterating, then use `Map.get(id)` for fast O(1) lookups during the main loop (O(M)).
