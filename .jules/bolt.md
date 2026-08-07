## 2024-10-24 - Prisma Fetch Latest Record Optimization
**Learning:** Using `groupBy` followed by `findMany` with a dynamically generated `OR` array to fetch the latest records is inefficient.
**Action:** Use a single `findMany` combining `distinct` and `orderBy`. Ensure the distinct field is the first element in the `orderBy` array (e.g., `orderBy: [{ userId: 'asc' }, { startTime: 'desc' }]`) to prevent PostgreSQL ConnectorErrors.
