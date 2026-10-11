## 2025-01-24 - Prisma Latest Record Anti-Pattern
**Learning:** Using groupBy followed by findMany with a large dynamically generated OR array to fetch the latest record per user creates severe query performance bottlenecks.
**Action:** Use a single findMany with distinct: ['userId'] and orderBy: { startTime: 'desc' } to natively and efficiently retrieve the most recent records.
