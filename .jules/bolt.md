## 2024-05-15 - Prisma Latest Record Anti-pattern
**Learning:** When fetching the latest record per user in Prisma, using `groupBy` followed by `findMany` with a large dynamically generated `OR` array is an anti-pattern. This is especially bad in PostgreSQL environments.
**Action:** Execute a single `findMany` using `distinct: ["userId"]` combined with `orderBy`. When using PostgreSQL, the field used in `distinct` MUST be the first element in the `orderBy` array to avoid ConnectorErrors (e.g., `orderBy: [{ userId: "asc" }, { startTime: "desc" }]`).
