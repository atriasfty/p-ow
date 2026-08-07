## 2024-05-24 - Prisma Latest Record Anti-pattern
**Learning:** Using groupBy followed by findMany with a large dynamically generated OR array is a major performance bottleneck and anti-pattern when fetching the latest record per user in Prisma.
**Action:** Use a single findMany with distinct (e.g., distinct: ["userId"]) and orderBy. When using PostgreSQL, the field used in distinct MUST be the first element in the orderBy array to avoid ConnectorErrors.
