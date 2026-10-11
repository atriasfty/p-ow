## 2026-05-01 - O(1) Map Lookups for Clerk Data
**Learning:** Performing `Array.find()` on Clerk users arrays inside `.map()` or `for` loops leads to O(N*M) performance bottlenecks when resolving relationships, which slows down the API response unnecessarily.
**Action:** Always pre-compute an O(1) Map (e.g. `new Map(clerkUsers.map(u => [u.id, u]))`) before the loop when mapping database records to their respective Clerk identities.
