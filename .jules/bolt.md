## 2024-07-28 - Prisma GroupBy Anti-Pattern
**Learning:** Using groupBy to get max timestamps followed by findMany with a dynamically generated OR array is slow and creates huge queries.
**Action:** Use a single findMany combining distinct and orderBy. When using PostgreSQL, the field used in distinct must be the first element in the orderBy array to prevent ConnectorErrors.
