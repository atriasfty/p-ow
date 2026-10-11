## 2026-08-02 - Prisma Distinct OrderBy Anti-pattern
**Learning:** When fetching the 'latest' record per user in Prisma, using `groupBy` followed by `findMany` with a dynamically generated `OR` array is an anti-pattern and scales poorly (especially when the OR array grows). Using `distinct` with `orderBy` is much more efficient.
**Action:** Use a single `findMany` combining `distinct` and `orderBy`. When using PostgreSQL, the field used in `distinct` must be the first element in the `orderBy` array (e.g., `orderBy: [{ userId: 'asc' }, { startTime: 'desc' }]`) to prevent ConnectorErrors.
