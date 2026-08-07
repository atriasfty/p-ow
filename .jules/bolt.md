
## 2024-07-02 - Avoid Prisma groupBy + OR for latest record
**Learning:** When fetching the latest record per user in Prisma, using `groupBy` followed by `findMany` with a large dynamically generated `OR` array is an anti-pattern that hurts performance and can hit query limits. Instead, executing a single `findMany` using `distinct: ["userId"]` combined with `orderBy` is much faster.
**Action:** When using PostgreSQL, the field used in `distinct` MUST be the first element in the `orderBy` array to avoid ConnectorErrors (e.g., `orderBy: [{ userId: "asc" }, { startTime: "desc" }]`).
