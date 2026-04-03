## 2024-05-17 - [Optimizing N+1 Database Queries]
**Learning:** Found a classic N+1 query problem where `prisma.shift.findFirst` was called sequentially inside a `Promise.all` loop for every member fetched in the admin dashboard. This happens frequently when fetching related data that isn't directly included in a `findMany` but needs some filtering or ordering (like "latest shift").
**Action:** Used `prisma.shift.findMany` with `userId: { in: userIds }`, combined with `distinct: ['userId']` and `orderBy: { startTime: 'desc' }` to fetch the latest shift for all users in a single database query. Then used a `Map` to efficiently assign shifts to their respective members. This drastically reduces database load and speeds up the endpoint.

## 2025-04-03 - [Optimizing N+1 Database Writes]
**Learning:** Found an N+1 query pattern where `prisma.botQueue.update` was being called individually for each successfully processed item in a concurrent loop. This generated sequential write transactions even when multiple items were processed in parallel.
**Action:** Initialized a `successfulIds` array to collect IDs of items that processed successfully inside the loop. After the loop completes, a single batched `prisma.botQueue.updateMany` query sets `status: "SENT"` for all those IDs at once. Also batched the error tracking into a concurrent `Promise.all` block.
