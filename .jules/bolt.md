## 2024-07-31 - Prisma latest record anti-pattern
**Learning:** Using `groupBy` followed by `findMany` with a dynamically generated `OR` array is an anti-pattern for fetching the latest record per user, leading to performance issues and potential query limits.
**Action:** Use a single `findMany` combining `distinct` and `orderBy`, ensuring the `distinct` field is the first element in the `orderBy` array to prevent PostgreSQL ConnectorErrors.
