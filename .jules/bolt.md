## 2024-03-24 - Prisma Latest Record Anti-pattern
**Learning:** Using groupBy followed by a findMany with a large dynamically generated OR array to fetch the latest record per user is extremely slow and blocks the database.
**Action:** Execute a single findMany using distinct: ['userId'] combined with orderBy: { startTime: 'desc' } to natively and efficiently retrieve the most recent records.
