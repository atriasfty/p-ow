## 2026-06-19 - Database Queries
**Learning:** When fetching the 'latest' record per user in Prisma, avoid the anti-pattern of using `groupBy` followed by `findMany` with a large dynamically generated `OR` array. Instead, execute a single `findMany` using `distinct: ['userId']` combined with `orderBy`. Crucially, when using PostgreSQL, the field used in `distinct` MUST be the first element in the `orderBy` array to avoid ConnectorErrors.
**Action:** Use `distinct` and `orderBy` instead of `groupBy` and `OR` arrays for these types of queries.
