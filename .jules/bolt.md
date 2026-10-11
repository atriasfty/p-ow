## 2024-05-24 - Prisma groupBy latest record Anti-pattern
**Learning:** When fetching the latest record per user in Prisma, using `groupBy` followed by `findMany` with a large dynamically generated `OR` array is an anti-pattern that creates performance overhead and massive dynamic queries.
**Action:** Execute a single `findMany` using `distinct: ["userId"]` combined with `orderBy`. When using PostgreSQL, the field used in `distinct` MUST be the first element in the `orderBy` array to avoid ConnectorErrors (e.g., `orderBy: [{ userId: "asc" }, { startTime: "desc" }]`).
