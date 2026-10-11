## 2025-06-23 - Optimize getting latest shift per user
**Learning:** When fetching the latest record per user in Prisma, `groupBy` followed by `findMany` with a dynamically generated `OR` array is an anti-pattern that creates inefficient queries and can exceed query limits. A single `findMany` with `distinct: [userId]` and `orderBy: [{ userId: asc }, { startTime: desc }]` is much more efficient.
**Action:** Use `distinct` and `orderBy` instead of `groupBy` + `OR` for fetching latest per-group records.
