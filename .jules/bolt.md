## 2025-05-18 - Avoid groupBy for latest record per user in Prisma
**Learning:** When fetching the latest record per user in Prisma, avoid the anti-pattern of using `groupBy` followed by `findMany` with a dynamically generated `OR` array. This is inefficient. Instead, use a single `findMany` combining `distinct` and `orderBy`. When using PostgreSQL, the field used in `distinct` must be the first element in the `orderBy` array to prevent ConnectorErrors.
**Action:** Replace the `groupBy` query with a single `findMany` query using `distinct` and `orderBy`.
