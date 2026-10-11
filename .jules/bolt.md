## 2026-06-11 - Prisma Query Performance: Latest Record per User
**Learning:** When fetching the 'latest' record per user in Prisma, using `groupBy` followed by `findMany` with a large dynamically generated `OR` array causes extremely slow query times.
**Action:** Execute a single `findMany` using `distinct: ['userId']` combined with `orderBy: { startTime: 'desc' }` to natively and efficiently retrieve the most recent records.
