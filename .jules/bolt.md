## 2025-02-23 - Optimize latest record per user queries
**Learning:** When fetching the latest record per user in Prisma, using `groupBy` followed by a large `OR` array is an anti-pattern that leads to N+1-like performance and huge query bodies. Using `distinct: ["userId"]` with `orderBy: [{ userId: "asc" }, { startTime: "desc" }]` is much more efficient.
**Action:** Always prefer `distinct` with `orderBy` over `groupBy` and `findMany(OR)` when querying latest records per user.
