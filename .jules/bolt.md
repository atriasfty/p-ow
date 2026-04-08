## 2024-05-17 - [Optimizing N+1 Database Queries]
**Learning:** Found a classic N+1 query problem where `prisma.shift.findFirst` was called sequentially inside a `Promise.all` loop for every member fetched in the admin dashboard. This happens frequently when fetching related data that isn't directly included in a `findMany` but needs some filtering or ordering (like "latest shift").
**Action:** Used `prisma.shift.findMany` with `userId: { in: userIds }`, combined with `distinct: ['userId']` and `orderBy: { startTime: 'desc' }` to fetch the latest shift for all users in a single database query. Then used a `Map` to efficiently assign shifts to their respective members. This drastically reduces database load and speeds up the endpoint.

## 2025-04-03 - [Optimizing N+1 Database Writes]
**Learning:** Found an N+1 query pattern where `prisma.botQueue.update` was being called individually for each successfully processed item in a concurrent loop. This generated sequential write transactions even when multiple items were processed in parallel.
**Action:** Initialized a `successfulIds` array to collect IDs of items that processed successfully inside the loop. After the loop completes, a single batched `prisma.botQueue.updateMany` query sets `status: "SENT"` for all those IDs at once. Also batched the error tracking into a concurrent `Promise.all` block.

## 2025-04-05 - [Optimizing Concurrent Heterogeneous Database Transactions]
**Learning:** Found a performance bottleneck where `prisma.shift.update` was called individually inside a `Promise.all` loop during server shutdown to calculate unique shift durations. Since each shift required different update data based on its `startTime`, `updateMany` could not be used. While `Promise.all` executes concurrently in Node.js, this still results in N+1 separate transactions being sent to the SQLite database.
**Action:** Wrapped the array of update promises inside a `prisma.$transaction()` block. This batches all individual updates into a single database transaction, significantly reducing transaction overhead and database lock contention during mass shutdown events.
## 2025-04-05 - [Optimizing Clerk User Fetching]
**Learning:** The `clerkClient.users.getUserList({ limit: 100 })` method fetches the first 100 users globally across the entire Clerk application. Using this to retrieve users for a specific server causes a severe O(N) over-fetching bottleneck, potentially omitting relevant users if the app has >100 users total.
**Action:** Always fetch the target server's `members` from Prisma first. Extract their unique `userId`s, and then fetch from Clerk strictly using `getUserList({ userId: uniqueUserIds.slice(0, 500) })`.
