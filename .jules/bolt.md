## YYYY-MM-DD - Initial
**Learning:** Initial setup.
**Action:** None.

## 2024-08-01 - Optimize latest record fetch in Prisma
**Learning:** Avoid the anti-pattern of using `groupBy` followed by `findMany` with a dynamically generated `OR` array when fetching the latest record per user. Instead, use a single `findMany` combining `distinct` and `orderBy`. When using PostgreSQL, the field used in `distinct` must be the first element in the `orderBy` array to prevent ConnectorErrors.
**Action:** Use a single `findMany` with `distinct` and `orderBy` for retrieving latest records.
