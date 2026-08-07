## 2024-07-23 - Database Query Pattern - Prisma Latest Record
**Learning:** In Prisma with PostgreSQL, fetching the latest record per user using groupBy followed by findMany with a large dynamically generated OR array is an anti-pattern that can cause large payload errors and slow performance.
**Action:** Instead, use a single findMany with distinct: ["userId"] combined with orderBy. For PostgreSQL, the field used in distinct MUST be the first element in the orderBy array to avoid ConnectorErrors.
