## 2025-05-13 - [Prisma N+1 and Distinct Optimization]
**Learning:** When fetching the latest record per user in Prisma on PostgreSQL, avoid using groupBy followed by a findMany with a large dynamic OR array. This creates massive memory overhead and query inefficiency. Instead, use a single findMany with distinct on the foreign key and order by the distinct key first, then the timestamp.
**Action:** Always prefer `distinct` over `groupBy` + `findMany OR` for "latest-per-group" queries in Prisma.
