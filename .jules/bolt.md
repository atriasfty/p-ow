
## 2025-02-23 - Clerk API User Lookup Batching
**Learning:** Clerk's `users.getUserList({ userId: [...] })` is limited to 100 IDs. For large datasets (e.g. exports), if passed an array of > 100 IDs, it will only return the first 100.
**Action:** When querying Clerk with large or dynamically sized ID arrays, always chunk the array into batches of 100 and execute them concurrently via `Promise.all` to fetch completely and quickly in O(1) round trips.
