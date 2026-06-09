## 2024-05-24 - Prisma Latest Record Query Anti-Pattern
**Learning:** When fetching the latest record per user in Prisma, using groupBy followed by a findMany with a large dynamically generated OR array is an anti-pattern that causes extremely slow query times.
**Action:** Execute a single findMany using distinct: ["userId"] combined with orderBy: { startTime: "desc" } to natively and efficiently retrieve the most recent records.
