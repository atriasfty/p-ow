## 2024-05-20 - Optimize Data Fetching & Array Lookups
**Learning:** Avoid fetching all users unconditionally using `client.users.getUserList({ limit: 100 })`, as it can fetch unrelated users and fail to retrieve all members if the total exceeds 100. Also, avoid O(N*M) lookups inside mapping loops using `Array.find()`.
**Action:** Query Prisma for unique user IDs first, chunk them, pass them directly to `getUserList({ userId: uniqueUserIds })`, and use an O(1) Map keyed by user IDs for subsequent lookups to bound operations to O(N).
