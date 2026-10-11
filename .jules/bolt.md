## 2024-07-27 - PostgreSQL Prisma Latest Record Query Optimization
**Learning:** Using `groupBy` followed by `findMany` with a dynamically generated `OR` array is an anti-pattern for fetching the latest record per user in PostgreSQL. It is slow and can cause Prisma query parsing errors when the `OR` array becomes large.
**Action:** Use a single `findMany` combining `distinct` and `orderBy`. When using PostgreSQL, the field used in `distinct` must be the first element in the `orderBy` array (e.g., `orderBy: [{ userId: 'asc' }, { startTime: 'desc' }]`) to prevent ConnectorErrors.
