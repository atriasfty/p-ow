## 2024-05-22 - [Clerk API Constraint Chunking]
**Learning:** Clerk's `client.users.getUserList({ userId: [...] })` API fails or silently truncates results if passed an array of more than 100 User IDs, making batch fetches unreliable for large sets.
**Action:** Always chunk arrays of User IDs into batches of 100 or fewer before calling `getUserList()`, and merge the results.

## 2024-05-22 - [Performance Pattern (API Batching)]
**Learning:** Executing batched external API calls (e.g., array chunking) sequentially inside a for loop degrades performance severely.
**Action:** Always map batched calls to an array of promises and execute them concurrently using `Promise.all()` to ensure maximum performance.
