## 2024-06-01 - Promise.all Batching for Clerk API Limits
**Learning:** The Clerk client.users.getUserList API strictly limits the 'userId' array to 100 items. Passing larger arrays causes failures. To bypass this efficiently, large ID arrays must be chunked into sizes of 100, and fetched concurrently via Promise.all(chunks.map(...)) rather than sequentially in loops, to preserve O(N) batched network performance.
**Action:** Use getClerkUsersInBatches from @/lib/clerk-lookup when querying more than 100 Clerk users by ID.
