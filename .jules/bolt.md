## 2024-05-24 - Prisma distinct + orderBy Optimization
**Learning:** The groupBy followed by findMany with a large dynamically generated OR array is an anti-pattern. It causes significant performance issues as user count scales and can fail entirely. When using PostgreSQL, Prisma supports using a single findMany with distinct and orderBy to get the latest record per group.
**Action:** Use distinct: ["userId"] combined with orderBy: [{ userId: "asc" }, { startTime: "desc" }] instead of groupBy to fetch the latest record per user efficiently.
