## 2024-05-18 - Optimize latest records retrieval in Prisma
**Learning:** Using groupBy followed by findMany with a dynamically generated OR array for retrieving the most recent records is an anti-pattern that leads to extremely slow query times.
**Action:** Use a single findMany with distinct: ['userId'] and orderBy: { startTime: 'desc' } to natively and efficiently retrieve the most recent records.
